import { computed, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

export interface NoteInfo {
  name: string;
  path: string;
  is_dir: boolean;
  children?: NoteInfo[];
}

export type TabViewMode = "edit" | "preview";

export interface NoteTab {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  viewMode: TabViewMode;
  /** Shared id for tabs created via Cmd+Click split; null = independent */
  linkGroupId: string | null;
}

export interface WorkspacePane {
  id: string;
  tabs: NoteTab[];
  activeTabId: string | null;
}

const AUTOSAVE_DELAY_MS = 500;
const STORAGE_KEY_LAST_VAULT = "synapsis:last_vault";

export function useVault() {
  const vaultPath = ref<string | null>(null);
  const fileTree = ref<NoteInfo[]>([]);
  const panes = ref<WorkspacePane[]>([]);
  const activePaneId = ref<string | null>(null);
  const backlinks = ref<string[]>([]);
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  const createId = () => crypto.randomUUID();

  const createEmptyPane = (): WorkspacePane => ({
    id: createId(),
    tabs: [],
    activeTabId: null,
  });

  const findTabById = (tabId: string) => {
    for (const pane of panes.value) {
      const tab = pane.tabs.find((t) => t.id === tabId);
      if (tab) return { pane, tab };
    }
    return null;
  };

  const getActivePane = (): WorkspacePane => {
    if (!panes.value.length) {
      const pane = createEmptyPane();
      panes.value.push(pane);
      activePaneId.value = pane.id;
    }
    if (!activePaneId.value) {
      activePaneId.value = panes.value[0].id;
    }
    return panes.value.find((p) => p.id === activePaneId.value) ?? panes.value[0];
  };

  const activePane = computed(
    () => panes.value.find((p) => p.id === activePaneId.value) ?? null,
  );

  const activeTab = computed(() => {
    const pane = activePane.value;
    if (!pane?.activeTabId) return null;
    return pane.tabs.find((t) => t.id === pane.activeTabId) ?? null;
  });

  const activeNotePath = computed(() => activeTab.value?.path ?? null);
  const activeNoteName = computed(() => activeTab.value?.name ?? "");
  const activeNoteContent = computed(() => activeTab.value?.content ?? "");

  const hasOpenNotes = computed(() =>
    panes.value.some((pane) => pane.tabs.length > 0),
  );

  const clearAutosaveTimer = () => {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
  };

  const persistTab = async (tab: NoteTab) => {
    await invoke("write_note", { path: tab.path, content: tab.content });
    tab.isDirty = false;
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

  const resetWorkspace = () => {
    clearAutosaveTimer();
    const pane = createEmptyPane();
    panes.value = [pane];
    activePaneId.value = pane.id;
    backlinks.value = [];
  };

  const openVaultPath = async (path: string) => {
    resetWorkspace();

    try {
      const tree = await invoke<NoteInfo[]>("open_vault", { path });
      vaultPath.value = path;
      fileTree.value = tree;
      localStorage.setItem(STORAGE_KEY_LAST_VAULT, path);
    } catch (err) {
      console.error("Failed to open vault at path:", path, err);
      vaultPath.value = null;
      fileTree.value = [];
      localStorage.removeItem(STORAGE_KEY_LAST_VAULT);
    }
  };

  const selectVault = async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      await openVaultPath(selected);
    }
  };

  const initVault = async () => {
    resetWorkspace();
    const savedPath = localStorage.getItem(STORAGE_KEY_LAST_VAULT);
    if (savedPath) {
      await openVaultPath(savedPath);
    }
  };

  const refreshFileTree = async () => {
    if (!vaultPath.value) return;
    try {
      fileTree.value = await invoke<NoteInfo[]>("open_vault", {
        path: vaultPath.value,
      });
    } catch (err) {
      console.error("Failed to refresh file tree:", err);
    }
  };

  const fetchBacklinksFor = async (noteName: string) => {
    if (!vaultPath.value || !noteName) {
      backlinks.value = [];
      return;
    }
    try {
      backlinks.value = await invoke<string[]>("get_backlinks", {
        vaultPath: vaultPath.value,
        noteName,
      });
    } catch (err) {
      console.error("Failed to fetch backlinks:", err);
      backlinks.value = [];
    }
  };

  const activatePane = (paneId: string) => {
    activePaneId.value = paneId;
  };

  const activateTab = async (tabId: string, paneId?: string) => {
    const found = paneId
      ? {
          pane: panes.value.find((p) => p.id === paneId),
          tab: panes.value
            .find((p) => p.id === paneId)
            ?.tabs.find((t) => t.id === tabId),
        }
      : findTabById(tabId);

    if (!found?.pane || !found.tab) return;

    activePaneId.value = found.pane.id;
    found.pane.activeTabId = tabId;
    await fetchBacklinksFor(found.tab.name);
  };

  const findExistingContent = (path: string) => {
    for (const pane of panes.value) {
      const tab = pane.tabs.find((t) => t.path === path);
      if (tab) return tab;
    }
    return null;
  };

  const openNote = async (
    noteName: string,
    path: string,
    options?: {
      newTab?: boolean;
      viewMode?: TabViewMode;
      paneId?: string;
      linkGroupId?: string | null;
    },
  ) => {
    const pane = options?.paneId
      ? (panes.value.find((p) => p.id === options.paneId) ?? getActivePane())
      : getActivePane();

    if (!options?.newTab) {
      const existing = pane.tabs.find((t) => t.path === path);
      if (existing) {
        await activateTab(existing.id, pane.id);
        return;
      }
    }

    try {
      const name = noteName.replace(/\.md$/, "");
      const existingSamePath = findExistingContent(path);
      const content = existingSamePath
        ? existingSamePath.content
        : await invoke<string>("read_note", { path });
      const newTab: NoteTab = {
        id: createId(),
        path,
        name,
        content,
        isDirty: existingSamePath?.isDirty ?? false,
        viewMode: options?.viewMode ?? "edit",
        linkGroupId: options?.linkGroupId ?? null,
      };

      if (options?.newTab || pane.tabs.length === 0) {
        pane.tabs.push(newTab);
      } else {
        const activeIdx = pane.tabs.findIndex((t) => t.id === pane.activeTabId);
        if (activeIdx !== -1) {
          const current = pane.tabs[activeIdx];
          clearAutosaveTimer();
          if (current.isDirty) {
            await persistTab(current);
          }
          const previousLinkGroupId = current.linkGroupId;
          pane.tabs.splice(activeIdx, 1, newTab);
          if (previousLinkGroupId) {
            clearOrphanedLinkGroups(previousLinkGroupId);
          }
        } else {
          pane.tabs.push(newTab);
        }
      }

      activePaneId.value = pane.id;
      pane.activeTabId = newTab.id;
      await fetchBacklinksFor(name);
    } catch (err) {
      console.error("Failed to open note:", path, err);
    }
  };

  const closeTab = async (paneId: string, tabId: string) => {
    const paneIdx = panes.value.findIndex((p) => p.id === paneId);
    if (paneIdx === -1) return;
    const pane = panes.value[paneIdx];
    const tabIdx = pane.tabs.findIndex((t) => t.id === tabId);
    if (tabIdx === -1) return;

    const tab = pane.tabs[tabIdx];
    if (pane.activeTabId === tabId) {
      clearAutosaveTimer();
    }
    if (tab.isDirty) {
      await persistTab(tab);
    }
    const closedLinkGroupId = tab.linkGroupId;
    pane.tabs.splice(tabIdx, 1);

    if (closedLinkGroupId) {
      clearOrphanedLinkGroups(closedLinkGroupId);
    }

    if (pane.tabs.length === 0) {
      if (panes.value.length > 1) {
        panes.value.splice(paneIdx, 1);
        if (activePaneId.value === paneId) {
          const nextPane =
            panes.value[paneIdx] ?? panes.value[paneIdx - 1] ?? null;
          if (nextPane) {
            activePaneId.value = nextPane.id;
            if (nextPane.activeTabId) {
              const nextTab = nextPane.tabs.find(
                (t) => t.id === nextPane.activeTabId,
              );
              await fetchBacklinksFor(nextTab?.name ?? "");
            } else {
              backlinks.value = [];
            }
          }
        }
      } else {
        pane.activeTabId = null;
        backlinks.value = [];
      }
      return;
    }

    if (pane.activeTabId === tabId) {
      const nextTab = pane.tabs[tabIdx] ?? pane.tabs[tabIdx - 1] ?? null;
      pane.activeTabId = nextTab?.id ?? null;
      if (activePaneId.value === paneId) {
        await fetchBacklinksFor(nextTab?.name ?? "");
      }
    }
  };

  const forEachTab = (fn: (tab: NoteTab) => void) => {
    panes.value.forEach((pane) => pane.tabs.forEach(fn));
  };

  const getLinkedTabs = (linkGroupId: string): NoteTab[] => {
    const linked: NoteTab[] = [];
    forEachTab((t) => {
      if (t.linkGroupId === linkGroupId) linked.push(t);
    });
    return linked;
  };

  const clearOrphanedLinkGroups = (linkGroupId: string) => {
    const remaining = getLinkedTabs(linkGroupId);
    if (remaining.length <= 1) {
      remaining.forEach((t) => {
        t.linkGroupId = null;
      });
    }
  };

  const unlinkTab = (tabId: string) => {
    const found = findTabById(tabId);
    if (!found?.tab.linkGroupId) return;
    const groupId = found.tab.linkGroupId;
    forEachTab((t) => {
      if (t.linkGroupId === groupId) {
        t.linkGroupId = null;
      }
    });
  };

  const setTabViewMode = (tabId: string, viewMode: TabViewMode) => {
    const found = findTabById(tabId);
    if (found) {
      found.tab.viewMode = viewMode;
    }
  };

  const splitActiveTabView = async () => {
    const pane = getActivePane();
    const tab = pane.tabs.find((t) => t.id === pane.activeTabId);
    if (!tab) return;

    const oppositeView: TabViewMode =
      tab.viewMode === "edit" ? "preview" : "edit";
    const linkGroupId = tab.linkGroupId ?? createId();
    tab.linkGroupId = linkGroupId;

    const paneIdx = panes.value.findIndex((p) => p.id === pane.id);
    const newPane = createEmptyPane();
    panes.value.splice(paneIdx + 1, 0, newPane);

    activePaneId.value = newPane.id;
    await openNote(`${tab.name}.md`, tab.path, {
      newTab: true,
      viewMode: oppositeView,
      paneId: newPane.id,
      linkGroupId,
    });
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

  const getNoteBreadcrumb = (notePath: string) => {
    if (!vaultPath.value) return { folder: "", name: "" };
    const vault = vaultPath.value.replace(/[/\\]$/, "");
    const relative = notePath.startsWith(vault)
      ? notePath.slice(vault.length).replace(/^[/\\]/, "")
      : notePath;
    const parts = relative.split(/[/\\]/).filter(Boolean);
    const fileName = parts.pop()?.replace(/\.md$/, "") ?? "";
    return {
      folder: parts.join(" / "),
      name: fileName,
    };
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

    forEachTab((t) => {
      if (t.path === item.path || t.path.startsWith(`${item.path}/`)) {
        t.path = newPath + t.path.slice(item.path.length);
        if (t.path === newPath && !item.is_dir) {
          t.name = finalName.replace(/\.md$/, "");
        }
      }
    });

    await refreshFileTree();
  };

  const movePath = async (item: NoteInfo, targetDirPath: string) => {
    if (!vaultPath.value) return;
    const parentDir = getParentDir(item.path);
    if (parentDir === targetDirPath) return;

    const baseName = item.path.split(/[/\\]/).pop() || item.name;
    const newPath = `${targetDirPath}/${baseName}`;
    if (newPath === item.path) return;

    await invoke("rename_path", { oldPath: item.path, newPath });

    forEachTab((t) => {
      if (t.path === item.path || t.path.startsWith(`${item.path}/`)) {
        t.path = newPath + t.path.slice(item.path.length);
      }
    });

    await refreshFileTree();
  };

  const deleteNote = async (path: string) => {
    if (
      activeTab.value &&
      (activeTab.value.path === path ||
        activeTab.value.path.startsWith(`${path}/`))
    ) {
      clearAutosaveTimer();
    }
    await invoke("delete_note", { path });

    panes.value.forEach((pane) => {
      pane.tabs = pane.tabs.filter(
        (t) => t.path !== path && !t.path.startsWith(`${path}/`),
      );
      if (
        pane.activeTabId &&
        !pane.tabs.find((t) => t.id === pane.activeTabId)
      ) {
        pane.activeTabId = pane.tabs[0]?.id ?? null;
      }
    });

    panes.value = panes.value.filter(
      (pane) => pane.tabs.length > 0 || panes.value.length === 1,
    );

    if (!activeTab.value) {
      const paneWithTab = panes.value.find((p) => p.tabs.length > 0);
      if (paneWithTab?.activeTabId) {
        await activateTab(paneWithTab.activeTabId, paneWithTab.id);
      } else {
        activePaneId.value = panes.value[0]?.id ?? null;
        backlinks.value = [];
      }
    }

    await refreshFileTree();
  };

  const syncTabContent = (sourceTab: NoteTab, newContent: string) => {
    if (sourceTab.content === newContent) return;
    forEachTab((t) => {
      if (t.path === sourceTab.path) {
        t.content = newContent;
        t.isDirty = true;
      }
    });
    scheduleAutosave(sourceTab);
  };

  const updateContent = (newContent: string) => {
    const tab = activeTab.value;
    if (tab) syncTabContent(tab, newContent);
  };

  const updateTabContent = (tabId: string, newContent: string) => {
    const found = findTabById(tabId);
    if (found) syncTabContent(found.tab, newContent);
  };

  const toggleChecklistItem = (lineIndex: number) => {
    const tab = activeTab.value;
    if (tab) toggleChecklistItemForTab(tab.id, lineIndex);
  };

  const toggleChecklistItemForTab = (tabId: string, lineIndex: number) => {
    const found = findTabById(tabId);
    if (!found) return;
    const tab = found.tab;
    const lines = tab.content.split("\n");
    const line = lines[lineIndex];
    if (line === undefined) return;
    const match = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\].*)$/);
    if (!match) return;
    const toggled = match[2].trim() === "" ? "x" : " ";
    lines[lineIndex] = `${match[1]}${toggled}${match[3]}`;
    syncTabContent(tab, lines.join("\n"));
  };

  return {
    vaultPath,
    fileTree,
    panes,
    activePane,
    activePaneId,
    activeTab,
    activeNotePath,
    activeNoteName,
    activeNoteContent,
    hasOpenNotes,
    backlinks,
    initVault,
    selectVault,
    openVaultPath,
    refreshFileTree,
    openNote,
    openNoteByName,
    createNote,
    createFolder,
    renamePath,
    movePath,
    getParentDir,
    getNoteBreadcrumb,
    deleteNote,
    updateContent,
    updateTabContent,
    toggleChecklistItem,
    toggleChecklistItemForTab,
    setTabViewMode,
    splitActiveTabView,
    unlinkTab,
    activatePane,
    activateTab,
    closeTab,
  };
}
