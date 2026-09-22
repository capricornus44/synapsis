import { computed, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

export interface NoteInfo {
  name: string;
  path: string;
  is_dir: boolean;
  children?: NoteInfo[];
}

export interface NoteTab {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}

const AUTOSAVE_DELAY_MS = 1200;

export function useVault() {
  const vaultPath = ref<string | null>(null);
  const fileTree = ref<NoteInfo[]>([]);
  const tabs = ref<NoteTab[]>([]);
  const activeTabPath = ref<string | null>(null);
  const backlinks = ref<string[]>([]);
  const isSaving = ref<boolean>(false);
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  const activeTab = computed(
    () => tabs.value.find((t) => t.path === activeTabPath.value) ?? null,
  );
  const activeNotePath = computed(() => activeTab.value?.path ?? null);
  const activeNoteName = computed(() => activeTab.value?.name ?? "");
  const activeNoteContent = computed(() => activeTab.value?.content ?? "");
  const isDirty = computed(() => activeTab.value?.isDirty ?? false);

  const clearAutosaveTimer = () => {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
  };

  const persistTab = async (tab: NoteTab) => {
    isSaving.value = true;
    try {
      await invoke("write_note", { path: tab.path, content: tab.content });
      tab.isDirty = false;
    } finally {
      isSaving.value = false;
    }
  };

  const scheduleAutosave = (tab: NoteTab) => {
    clearAutosaveTimer();
    autosaveTimer = setTimeout(async () => {
      autosaveTimer = null;
      if (!tab.isDirty) return;
      await persistTab(tab);
      await fetchBacklinksFor(tab.name);
    }, AUTOSAVE_DELAY_MS);
  };

  const selectVault = async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      clearAutosaveTimer();
      vaultPath.value = selected;
      tabs.value = [];
      activeTabPath.value = null;
      backlinks.value = [];
      await refreshFileTree();
    }
  };

  const refreshFileTree = async () => {
    if (!vaultPath.value) return;
    fileTree.value = await invoke<NoteInfo[]>("open_vault", {
      path: vaultPath.value,
    });
  };

  const fetchBacklinksFor = async (noteName: string) => {
    if (!vaultPath.value || !noteName) {
      backlinks.value = [];
      return;
    }
    backlinks.value = await invoke<string[]>("get_backlinks", {
      vaultPath: vaultPath.value,
      noteName,
    });
  };

  const activateTab = async (path: string) => {
    activeTabPath.value = path;
    const tab = tabs.value.find((t) => t.path === path);
    await fetchBacklinksFor(tab?.name ?? "");
  };

  const openNote = async (
    noteName: string,
    path: string,
    options?: { newTab?: boolean },
  ) => {
    const existing = tabs.value.find((t) => t.path === path);
    if (existing) {
      await activateTab(path);
      return;
    }

    const name = noteName.replace(/\.md$/, "");
    const content = await invoke<string>("read_note", { path });
    const newTab: NoteTab = { path, name, content, isDirty: false };

    if (options?.newTab || tabs.value.length === 0) {
      tabs.value.push(newTab);
    } else {
      const activeIdx = tabs.value.findIndex(
        (t) => t.path === activeTabPath.value,
      );
      if (activeIdx !== -1) {
        const current = tabs.value[activeIdx];
        clearAutosaveTimer();
        if (current.isDirty) {
          await persistTab(current);
        }
        tabs.value.splice(activeIdx, 1, newTab);
      } else {
        tabs.value.push(newTab);
      }
    }

    activeTabPath.value = path;
    await fetchBacklinksFor(name);
  };

  const closeTab = async (path: string) => {
    const idx = tabs.value.findIndex((t) => t.path === path);
    if (idx === -1) return;
    const tab = tabs.value[idx];
    if (tab.path === activeTabPath.value) {
      clearAutosaveTimer();
    }
    if (tab.isDirty) {
      await persistTab(tab);
    }
    tabs.value.splice(idx, 1);

    if (activeTabPath.value === path) {
      const next = tabs.value[idx] ?? tabs.value[idx - 1] ?? null;
      if (next) {
        await activateTab(next.path);
      } else {
        activeTabPath.value = null;
        backlinks.value = [];
      }
    }
  };

  const findNoteByName = (tree: NoteInfo[], name: string): NoteInfo | null => {
    const cleanTarget = name.replace(/\.md$/, "").toLowerCase();
    for (const item of tree) {
      if (!item.is_dir) {
        const itemName = item.name.replace(/\.md$/, "").toLowerCase();
        if (itemName === cleanTarget) {
          return item;
        }
      } else if (item.children) {
        const found = findNoteByName(item.children, name);
        if (found) return found;
      }
    }
    return null;
  };

  const openNoteByName = async (noteName: string) => {
    const found = findNoteByName(fileTree.value, noteName);
    if (found) {
      await openNote(found.name, found.path);
    } else if (vaultPath.value) {
      await createNote(noteName);
    }
  };

  const createNote = async (name: string, targetDir?: string) => {
    if (!vaultPath.value) return;
    const cleanName = name.replace(/\.md$/, "");
    const fileName = `${cleanName}.md`;
    const baseDir = targetDir || vaultPath.value;
    const newPath = `${baseDir}/${fileName}`;
    const initialContent = `# ${cleanName}\n\n`;
    await invoke("write_note", {
      path: newPath,
      content: initialContent,
    });
    await refreshFileTree();
    await openNote(fileName, newPath);
  };

  const createFolder = async (name: string, targetDir?: string) => {
    if (!vaultPath.value) return;
    const folderName = name.trim();
    if (!folderName) return;
    const baseDir = targetDir || vaultPath.value;
    const newPath = `${baseDir}/${folderName}`;
    await invoke("create_folder", {
      path: newPath,
    });
    await refreshFileTree();
  };

  const getParentDir = (path: string) => {
    const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return idx === -1 ? "" : path.slice(0, idx);
  };

  const renamePath = async (item: NoteInfo, newName: string) => {
    if (!vaultPath.value) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    const parentDir = getParentDir(item.path);
    const finalName = item.is_dir
      ? trimmed
      : `${trimmed.replace(/\.md$/, "")}.md`;
    const newPath = `${parentDir}/${finalName}`;
    if (newPath === item.path) return;

    await invoke("rename_path", { oldPath: item.path, newPath });

    if (item.is_dir) {
      tabs.value.forEach((t) => {
        if (t.path === item.path || t.path.startsWith(`${item.path}/`)) {
          t.path = newPath + t.path.slice(item.path.length);
        }
      });
      if (
        activeTabPath.value &&
        (activeTabPath.value === item.path ||
          activeTabPath.value.startsWith(`${item.path}/`))
      ) {
        activeTabPath.value =
          newPath + activeTabPath.value.slice(item.path.length);
      }
    } else {
      const tab = tabs.value.find((t) => t.path === item.path);
      if (tab) {
        tab.path = newPath;
        tab.name = finalName.replace(/\.md$/, "");
      }
      if (activeTabPath.value === item.path) {
        activeTabPath.value = newPath;
      }
    }

    await refreshFileTree();
  };

  const deleteNote = async (path: string) => {
    if (
      activeTabPath.value &&
      (activeTabPath.value === path ||
        activeTabPath.value.startsWith(`${path}/`))
    ) {
      clearAutosaveTimer();
    }
    await invoke("delete_note", { path });
    tabs.value = tabs.value.filter(
      (t) => t.path !== path && !t.path.startsWith(`${path}/`),
    );
    if (!tabs.value.find((t) => t.path === activeTabPath.value)) {
      const next = tabs.value[0] ?? null;
      if (next) {
        await activateTab(next.path);
      } else {
        activeTabPath.value = null;
        backlinks.value = [];
      }
    }
    await refreshFileTree();
  };

  const saveNote = async () => {
    const tab = activeTab.value;
    if (!tab) return;
    clearAutosaveTimer();
    await persistTab(tab);
    await fetchBacklinksFor(tab.name);
  };

  const updateContent = (newContent: string) => {
    const tab = activeTab.value;
    if (tab && tab.content !== newContent) {
      tab.content = newContent;
      tab.isDirty = true;
      scheduleAutosave(tab);
    }
  };

  const toggleChecklistItem = (lineIndex: number) => {
    const tab = activeTab.value;
    if (!tab) return;
    const lines = tab.content.split("\n");
    const line = lines[lineIndex];
    if (line === undefined) return;
    const match = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s.*)$/);
    if (!match) return;
    const toggled = match[2].trim() === "" ? "x" : " ";
    lines[lineIndex] = `${match[1]}${toggled}${match[3]}`;
    tab.content = lines.join("\n");
    tab.isDirty = true;
    scheduleAutosave(tab);
  };

  return {
    vaultPath,
    fileTree,
    tabs,
    activeNotePath,
    activeNoteName,
    activeNoteContent,
    backlinks,
    isSaving,
    isDirty,
    selectVault,
    refreshFileTree,
    openNote,
    openNoteByName,
    createNote,
    createFolder,
    renamePath,
    deleteNote,
    saveNote,
    updateContent,
    toggleChecklistItem,
    activateTab,
    closeTab,
  };
}
