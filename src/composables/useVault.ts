import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

export interface NoteInfo {
  name: string;
  path: string;
  is_dir: boolean;
  children?: NoteInfo[];
}

export function useVault() {
  const vaultPath = ref<string | null>(null);
  const fileTree = ref<NoteInfo[]>([]);
  const activeNotePath = ref<string | null>(null);
  const activeNoteName = ref<string>("");
  const activeNoteContent = ref<string>("");
  const backlinks = ref<string[]>([]);
  const isSaving = ref<boolean>(false);
  const isDirty = ref<boolean>(false);

  const selectVault = async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      vaultPath.value = selected;
      await refreshFileTree();
    }
  };

  const refreshFileTree = async () => {
    if (!vaultPath.value) return;
    fileTree.value = await invoke<NoteInfo[]>("open_vault", {
      path: vaultPath.value,
    });
  };

  const openNote = async (noteName: string, path: string) => {
    if (isDirty.value && activeNotePath.value) {
      await saveNote();
    }
    activeNotePath.value = path;
    activeNoteName.value = noteName.replace(/\.md$/, "");
    activeNoteContent.value = await invoke<string>("read_note", { path });
    isDirty.value = false;
    await fetchBacklinks();
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

  const deleteNote = async (path: string) => {
    await invoke("delete_note", { path });
    if (activeNotePath.value === path) {
      activeNotePath.value = null;
      activeNoteName.value = "";
      activeNoteContent.value = "";
      backlinks.value = [];
      isDirty.value = false;
    }
    await refreshFileTree();
  };

  const saveNote = async () => {
    if (!activeNotePath.value) return;
    isSaving.value = true;
    try {
      await invoke("write_note", {
        path: activeNotePath.value,
        content: activeNoteContent.value,
      });
      isDirty.value = false;
      await fetchBacklinks();
    } finally {
      isSaving.value = false;
    }
  };

  const updateContent = (newContent: string) => {
    if (activeNoteContent.value !== newContent) {
      activeNoteContent.value = newContent;
      isDirty.value = true;
    }
  };

  const fetchBacklinks = async () => {
    if (!vaultPath.value || !activeNoteName.value) return;
    backlinks.value = await invoke<string[]>("get_backlinks", {
      vaultPath: vaultPath.value,
      noteName: activeNoteName.value,
    });
  };

  return {
    vaultPath,
    fileTree,
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
    deleteNote,
    saveNote,
    updateContent,
  };
}
