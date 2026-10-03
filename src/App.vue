<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useVault, type NoteInfo } from "./composables/useVault";
import { useTheme } from "./composables/useTheme";
import { TREE_ROOT_DROP, useFileTreeDrag } from "./composables/useFileTreeDrag";
import type { GraphData } from "./types/graph";
import FileTreeItem from "./components/FileTreeItem.vue";
import ContextMenu from "./components/ContextMenu.vue";
import WorkspacePane from "./components/WorkspacePane.vue";
import GraphView from "./components/GraphView.vue";
import DeleteConfirmationDialog from "./dialogs/DeleteConfirmationDialog.vue";
import MoveItemDialog from "./dialogs/MoveItemDialog.vue";
import SettingsDialog from "./dialogs/SettingsDialog.vue";
import {
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon,
  Settings as SettingsIcon,
  Plus as PlusIcon,
  FolderPlus as FolderPlusIcon,
  Search as SearchIcon,
  Link2 as Link2Icon,
  RotateCcw as RotateCcwIcon,
  FileText as FileTextIcon,
  Sparkles as SparklesIcon,
  Share2 as GraphIcon,
} from "@lucide/vue";

const {
  vaultPath,
  fileTree,
  panes,
  activePaneId,
  activeTab,
  activeNotePath,
  activeNoteName,
  hasOpenNotes,
  backlinks,
  initVault,
  selectVault,
  refreshFileTree,
  fetchGraphData,
  openNote,
  openNoteByName,
  createNote,
  createFolder,
  renamePath,
  movePath,
  deleteNote,
  getNoteBreadcrumb,
  updateTabContent,
  toggleChecklistItemForTab,
  setTabViewMode,
  splitActiveTabView,
  unlinkTab,
  activatePane,
  activateTab,
  closeTab,
} = useVault();

const { initTheme, accentColor } = useTheme();
const { dragSource, dropTarget, dropTargetPath, dragPosition, isDragging } =
  useFileTreeDrag();

type CreateMode = "note" | "folder";
const searchQuery = ref("");
const isSettingsOpen = ref(false);
const isGraphOpen = ref(false);
const graphData = ref<GraphData>({ nodes: [], edges: [] });
const hoveredLinkGroupId = ref<string | null>(null);
const createMode = ref<CreateMode | null>(null);
const createTargetFolder = ref<NoteInfo | null>(null);
const createInputTitle = ref("");
const deleteTarget = ref<NoteInfo | null>(null);
const moveTarget = ref<NoteInfo | null>(null);
const renamingPath = ref<string | null>(null);
const contextMenuTarget = ref<{ item: NoteInfo; x: number; y: number } | null>(
  null,
);

const vaultFolderName = computed(() => {
  if (!vaultPath.value) return "";
  const parts = vaultPath.value.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || vaultPath.value;
});

// Recursive filter for search query
const filterTree = (items: NoteInfo[], query: string): NoteInfo[] => {
  if (!query.trim()) return items;
  const q = query.toLowerCase();

  return items
    .map((item) => {
      if (item.is_dir) {
        const filteredChildren = item.children
          ? filterTree(item.children, query)
          : [];
        if (
          filteredChildren.length > 0 ||
          item.name.toLowerCase().includes(q)
        ) {
          return { ...item, children: filteredChildren };
        }
        return null;
      }
      return item.name.toLowerCase().includes(q) ? item : null;
    })
    .filter((item): item is NoteInfo => item !== null);
};

const displayedTree = computed(() =>
  filterTree(fileTree.value, searchQuery.value),
);

const handleSelectNote = (item: NoteInfo) => {
  if (!item.is_dir) {
    openNote(item.name, item.path);
  }
};

const handleDeleteNote = (item: NoteInfo) => {
  deleteTarget.value = item;
};

const confirmDelete = async () => {
  if (deleteTarget.value) {
    const path = deleteTarget.value.path;
    deleteTarget.value = null;
    await deleteNote(path);
    if (isGraphOpen.value) {
      await refreshGraph();
    }
  }
};

const cancelDelete = () => {
  deleteTarget.value = null;
};

const startMove = (item: NoteInfo) => {
  moveTarget.value = item;
};

const confirmMove = async (targetDirPath: string) => {
  if (moveTarget.value) {
    const item = moveTarget.value;
    moveTarget.value = null;
    await movePath(item, targetDirPath);
    if (isGraphOpen.value) {
      await refreshGraph();
    }
  }
};

const cancelMove = () => {
  moveTarget.value = null;
};

const openInNewTab = (item: NoteInfo) => {
  openNote(item.name, item.path, { newTab: true });
};

const handleContextMenu = (item: NoteInfo, event: MouseEvent) => {
  contextMenuTarget.value = { item, x: event.clientX, y: event.clientY };
};

const isRootDropTarget = computed(
  () => isDragging.value && dropTargetPath.value === TREE_ROOT_DROP,
);

const handleTreeDragDrop = async (event: Event) => {
  const { source, targetPath } = (
    event as CustomEvent<{ source: NoteInfo; targetPath: string }>
  ).detail;
  if (!vaultPath.value) return;
  const destination =
    targetPath === TREE_ROOT_DROP ? vaultPath.value : targetPath;
  await movePath(source, destination);
  if (isGraphOpen.value) {
    await refreshGraph();
  }
};

const handleTabZoneDrop = async (event: Event) => {
  const { source, paneId, insertIndex } = (
    event as CustomEvent<{
      source: NoteInfo;
      paneId: string;
      insertIndex: number;
    }>
  ).detail;
  if (source.is_dir) return;
  await openNote(source.name, source.path, {
    paneId,
    newTab: true,
    insertIndex,
  });
};

const handleFileNameZoneDrop = async (event: Event) => {
  const { source, paneId } = (
    event as CustomEvent<{
      source: NoteInfo;
      paneId: string;
    }>
  ).detail;
  if (source.is_dir) return;
  await openNote(source.name, source.path, {
    paneId,
    newTab: false,
    replaceActive: true,
  });
};

const closeContextMenu = () => {
  contextMenuTarget.value = null;
};

const startRename = (item: NoteInfo) => {
  renamingPath.value = item.path;
};

const cancelRename = () => {
  renamingPath.value = null;
};

const submitRename = async (item: NoteInfo, newName: string) => {
  renamingPath.value = null;
  await renamePath(item, newName);
  if (isGraphOpen.value) {
    await refreshGraph();
  }
};

const handleOpenBacklink = (targetName: string) => {
  openNoteByName(targetName);
};

const handleWikiLinkClick = (targetName: string) => {
  openNoteByName(targetName);
};

const startCreateNote = (folder?: NoteInfo) => {
  createMode.value = "note";
  createTargetFolder.value = folder || null;
  createInputTitle.value = "";
};

const startCreateFolder = (folder?: NoteInfo) => {
  createMode.value = "folder";
  createTargetFolder.value = folder || null;
  createInputTitle.value = "";
};

const cancelCreate = () => {
  createMode.value = null;
  createTargetFolder.value = null;
  createInputTitle.value = "";
};

const handleViewModeClick = (
  event: MouseEvent,
  targetMode: "edit" | "preview",
  tabId: string,
) => {
  if (event.metaKey || event.ctrlKey) {
    activateTab(tabId);
    splitActiveTabView();
    return;
  }
  setTabViewMode(tabId, targetMode);
};

const handleUnlinkTab = (tabId: string) => {
  unlinkTab(tabId);
  hoveredLinkGroupId.value = null;
};

const getPaneBreadcrumb = (tabPath: string) => getNoteBreadcrumb(tabPath);

const visiblePanes = computed(() =>
  panes.value.filter((pane) => pane.tabs.length > 0),
);

const submitCreate = async () => {
  const trimmed = createInputTitle.value.trim();
  if (!trimmed) return;
  const parentPath = createTargetFolder.value?.path;
  if (createMode.value === "folder") {
    await createFolder(trimmed, parentPath);
  } else if (createMode.value === "note") {
    await createNote(trimmed, parentPath);
  }
  cancelCreate();
  if (isGraphOpen.value) {
    await refreshGraph();
  }
};

const openGraphView = async () => {
  if (!vaultPath.value) return;
  graphData.value = await fetchGraphData();
  isGraphOpen.value = true;
};

const refreshGraph = async () => {
  if (vaultPath.value) {
    graphData.value = await fetchGraphData();
  }
};

const handleOpenNoteFromGraph = async (
  noteName: string,
  path: string | null,
  newTab: boolean,
) => {
  isGraphOpen.value = false;
  if (path) {
    await openNote(`${noteName}.md`, path, { newTab });
  } else {
    await openNoteByName(noteName);
  }
};

// Keyboard shortcut handler (Cmd/Ctrl + N to new note,
// Cmd/Ctrl + F to new folder, Cmd/Ctrl + R to refresh vault, Cmd/Ctrl + G to Graph View, Cmd/Ctrl + , to settings, Escape to close modals)
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    if (isGraphOpen.value) {
      isGraphOpen.value = false;
      return;
    }
    if (isSettingsOpen.value) {
      isSettingsOpen.value = false;
      return;
    }
    if (contextMenuTarget.value) {
      closeContextMenu();
      return;
    }
    if (moveTarget.value) {
      cancelMove();
      return;
    }
    if (deleteTarget.value) {
      cancelDelete();
      return;
    }
    if (createMode.value) {
      cancelCreate();
      return;
    }
  }

  const isModifier = e.metaKey || e.ctrlKey;
  if (isModifier && e.key === ",") {
    e.preventDefault();
    isSettingsOpen.value = !isSettingsOpen.value;
  } else if (isModifier && e.key.toLowerCase() === "g") {
    e.preventDefault();
    if (isGraphOpen.value) {
      isGraphOpen.value = false;
    } else if (vaultPath.value) {
      openGraphView();
    }
  } else if (isModifier && e.key.toLowerCase() === "n") {
    e.preventDefault();
    if (vaultPath.value) {
      startCreateNote();
    }
  } else if (isModifier && e.key.toLowerCase() === "f") {
    e.preventDefault();
    if (vaultPath.value) {
      startCreateFolder();
    }
  } else if (isModifier && e.key.toLowerCase() === "r") {
    e.preventDefault();
    if (vaultPath.value) {
      refreshFileTree();
      if (isGraphOpen.value) {
        refreshGraph();
      }
    }
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("tree-drag-drop", handleTreeDragDrop);
  window.addEventListener("tab-zone-drop", handleTabZoneDrop);
  window.addEventListener("file-name-zone-drop", handleFileNameZoneDrop);
  initTheme();
  initVault();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("tree-drag-drop", handleTreeDragDrop);
  window.removeEventListener("tab-zone-drop", handleTabZoneDrop);
  window.removeEventListener("file-name-zone-drop", handleFileNameZoneDrop);
});
</script>

<template>
  <div
    class="flex h-screen w-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden select-none transition-colors"
  >
    <!-- Left Sidebar -->
    <aside
      class="w-72 bg-neutral-50 dark:bg-neutral-900/95 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 transition-colors"
    >
      <!-- App Header -->
      <div
        class="h-14 px-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between transition-colors"
      >
        <div class="flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-lg flex items-center justify-center font-bold transition-colors"
            :style="{ backgroundColor: accentColor + '20', color: accentColor }"
          >
            <SparklesIcon class="w-4 h-4" />
          </div>
          <h1
            class="font-bold text-base tracking-wide text-neutral-900 dark:text-neutral-100"
          >
            Synapsis
          </h1>
        </div>
        <div class="flex items-center gap-1">
          <button
            v-if="vaultPath"
            @click="openGraphView"
            title="Graph View (Ctrl/Cmd+G)"
            class="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <GraphIcon class="w-4 h-4" />
          </button>
          <button
            v-if="vaultPath"
            @click="selectVault"
            title="Switch Vault"
            class="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <FolderOpenIcon class="w-4 h-4" />
          </button>
          <button
            @click="isSettingsOpen = true"
            title="Settings (Ctrl/Cmd+,)"
            class="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <SettingsIcon class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Vault Banner / Actions -->
      <div
        class="p-3 border-b border-neutral-200 dark:border-neutral-800/80 transition-colors"
      >
        <template v-if="!vaultPath">
          <button
            @click="selectVault"
            class="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-white font-medium text-sm transition-opacity hover:opacity-90 shadow-xs cursor-pointer"
            :style="{ backgroundColor: accentColor }"
          >
            <FolderOpenIcon class="w-4 h-4" />
            <span>Open Vault</span>
          </button>
        </template>

        <template v-else>
          <div class="flex items-center justify-between mb-2">
            <div
              class="flex items-center gap-1.5 truncate text-xs text-neutral-500 dark:text-neutral-400"
            >
              <span
                class="font-medium text-neutral-800 dark:text-neutral-200 truncate"
                >{{ vaultFolderName }}</span
              >
            </div>
            <div class="flex items-center gap-1">
              <button
                @click="refreshFileTree"
                title="Refresh Vault (Ctrl/Cmd+R)"
                class="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <RotateCcwIcon class="w-3.5 h-3.5" />
              </button>
              <button
                @click="startCreateFolder()"
                title="New Folder (Ctrl/Cmd+F)"
                class="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <FolderPlusIcon class="w-3.5 h-3.5" />
              </button>
              <button
                @click="startCreateNote()"
                title="New Note (Ctrl/Cmd+N)"
                class="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <PlusIcon class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- New Note / Folder Inline Input -->
          <div v-if="createMode" class="mt-2 mb-1">
            <form
              @submit.prevent="submitCreate"
              class="flex flex-col gap-1.5 bg-neutral-100 dark:bg-neutral-800/90 p-2 rounded-lg border border-neutral-300 dark:border-neutral-700 transition-colors"
            >
              <div
                class="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400"
              >
                <span>
                  New {{ createMode === "folder" ? "Folder" : "Note" }}
                  <span
                    v-if="createTargetFolder"
                    class="text-neutral-800 dark:text-neutral-200 font-medium truncate"
                  >
                    in /{{ createTargetFolder.name }}
                  </span>
                </span>
              </div>
              <input
                v-model="createInputTitle"
                type="text"
                autofocus
                :placeholder="
                  createMode === 'folder' ? 'Folder name...' : 'Note title...'
                "
                class="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-900 rounded border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
              />
              <div class="flex justify-end gap-1.5">
                <button
                  type="button"
                  @click="cancelCreate"
                  class="px-2 py-0.5 text-xs rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="px-2 py-0.5 text-xs rounded text-white cursor-pointer hover:opacity-90 transition-opacity"
                  :style="{ backgroundColor: accentColor }"
                >
                  Create
                </button>
              </div>
            </form>
          </div>

          <!-- Search Filter -->
          <div class="relative">
            <SearchIcon
              class="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter notes..."
              class="w-full pl-8 pr-2.5 py-1 text-xs bg-neutral-200/70 dark:bg-neutral-800/80 rounded-md border border-transparent focus:border-neutral-300 dark:focus:border-neutral-700 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none transition-colors"
            />
          </div>
        </template>
      </div>

      <!-- File Explorer Tree -->
      <div
        data-tree-drop-root="true"
        class="flex-1 overflow-y-auto p-2 transition-colors"
        :class="
          isRootDropTarget
            ? 'bg-accent/10 ring-1 ring-inset ring-accent/40 rounded-md'
            : ''
        "
      >
        <div
          v-if="vaultPath && displayedTree.length === 0"
          class="p-4 text-center text-xs text-neutral-400 dark:text-neutral-500"
        >
          {{
            searchQuery
              ? "No matching notes found."
              : "Vault is empty. Create your first note or folder!"
          }}
        </div>

        <div
          v-if="!vaultPath"
          class="p-6 text-center text-xs text-neutral-500 flex flex-col items-center gap-2"
        >
          <FolderOpenIcon
            class="w-8 h-8 text-neutral-400 dark:text-neutral-600"
          />
          <span
            >No vault folder opened. Click "Open Vault" to select a
            folder.</span
          >
        </div>

        <FileTreeItem
          v-for="item in displayedTree"
          :key="item.path"
          :item="item"
          :active-path="activeNotePath"
          :renaming-path="renamingPath"
          :parent-path="vaultPath"
          @open="handleSelectNote"
          @rename="submitRename"
          @rename-cancel="cancelRename"
          @context-menu="handleContextMenu"
        />
      </div>

      <!-- Drag ghost -->
      <Teleport to="body">
        <div
          v-if="isDragging && dragSource && dragPosition"
          id="tree-drag-ghost"
          class="fixed z-[100] pointer-events-none px-2.5 py-1.5 rounded-md text-xs font-medium shadow-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 max-w-[240px] truncate flex items-center gap-1.5"
          :style="{
            left: `${dragPosition.x + 12}px`,
            top: `${dragPosition.y + 12}px`,
          }"
        >
          <FileTextIcon
            v-if="!dragSource.is_dir"
            class="w-3.5 h-3.5 shrink-0"
            :style="{ color: accentColor }"
          />
          <FolderIcon v-else class="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span class="truncate">{{
            dragSource.is_dir
              ? dragSource.name
              : dragSource.name.replace(/\.md$/, "")
          }}</span>
          <span
            v-if="dropTarget?.type === 'tab-zone'"
            class="ml-1 px-1.5 py-0.5 rounded text-[10px] text-white font-medium shrink-0 shadow-xs"
            :style="{ backgroundColor: accentColor }"
          >
            New tab
          </span>
          <span
            v-else-if="dropTarget?.type === 'file-name-zone'"
            class="ml-1 px-1.5 py-0.5 rounded text-[10px] text-white font-medium shrink-0 shadow-xs"
            :style="{ backgroundColor: accentColor }"
          >
            Replace
          </span>
        </div>
      </Teleport>

      <!-- Backlinks Panel -->
      <div
        v-if="activeNoteName"
        class="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-900/60 p-3 max-h-48 flex flex-col transition-colors"
      >
        <div
          class="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 mb-2"
        >
          <Link2Icon class="w-3.5 h-3.5" :style="{ color: accentColor }" />
          <span>Backlinks ({{ backlinks.length }})</span>
        </div>
        <div class="overflow-y-auto flex-1 space-y-1">
          <div
            v-for="sourceNote in backlinks"
            :key="sourceNote"
            @click="handleOpenBacklink(sourceNote)"
            class="flex items-center gap-1.5 py-1 px-2 rounded text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-accent cursor-pointer transition-colors"
          >
            <FileTextIcon
              class="w-3 h-3 text-neutral-400 dark:text-neutral-500 shrink-0"
            />
            <span class="truncate">[[{{ sourceNote }}]]</span>
          </div>
          <div
            v-if="backlinks.length === 0"
            class="text-xs text-neutral-400 dark:text-neutral-500 italic px-2 py-1"
          >
            No backlinks referencing this note
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Workspace Area -->
    <main
      class="flex-1 flex min-h-0 h-full bg-neutral-100/50 dark:bg-neutral-950 overflow-hidden transition-colors"
    >
      <!-- Empty State -->
      <div
        v-if="!hasOpenNotes"
        class="flex-1 flex flex-col items-center justify-center gap-4 text-neutral-400 dark:text-neutral-500 p-8 text-center"
      >
        <div
          class="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-400 dark:text-neutral-600 transition-colors"
        >
          <FileTextIcon
            class="w-8 h-8 text-neutral-400 dark:text-neutral-600"
          />
        </div>
        <div>
          <h3
            class="text-base font-medium text-neutral-800 dark:text-neutral-300 mb-1"
          >
            No note open
          </h3>
          <p class="text-xs text-neutral-500 dark:text-neutral-500 max-w-sm">
            Select a markdown file from the left sidebar, or open a vault to
            start writing and interlinking your ideas.
          </p>
        </div>
        <div v-if="vaultPath" class="flex gap-2">
          <button
            @click="openGraphView"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <GraphIcon class="w-3.5 h-3.5" />
            <span>Graph View</span>
          </button>
          <button
            @click="startCreateFolder()"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <FolderPlusIcon class="w-3.5 h-3.5" />
            <span>New Folder</span>
          </button>
          <button
            @click="startCreateNote()"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-opacity hover:opacity-90 cursor-pointer"
            :style="{ backgroundColor: accentColor }"
          >
            <PlusIcon class="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      <!-- Obsidian-style panes -->
      <template v-else>
        <WorkspacePane
          v-for="(pane, index) in visiblePanes"
          :key="pane.id"
          :pane="pane"
          :is-active="pane.id === activePaneId"
          :accent-color="accentColor"
          :highlighted-link-group-id="hoveredLinkGroupId"
          :breadcrumb-folder="
            pane.activeTabId
              ? getPaneBreadcrumb(
                  pane.tabs.find((t) => t.id === pane.activeTabId)?.path ?? '',
                ).folder
              : ''
          "
          :breadcrumb-name="
            pane.activeTabId
              ? getPaneBreadcrumb(
                  pane.tabs.find((t) => t.id === pane.activeTabId)?.path ?? '',
                ).name
              : ''
          "
          :class="[
            'flex-1 min-h-0 min-w-0',
            index < visiblePanes.length - 1
              ? 'border-r border-neutral-200 dark:border-neutral-800'
              : '',
          ]"
          @activate="activatePane(pane.id)"
          @select-tab="activateTab($event, pane.id)"
          @close-tab="closeTab(pane.id, $event)"
          @unlink-tab="handleUnlinkTab"
          @link-hover="hoveredLinkGroupId = $event"
          @view-mode-click="
            (event, mode) =>
              handleViewModeClick(
                event,
                mode,
                pane.activeTabId ?? activeTab?.id ?? '',
              )
          "
          @update-content="(tabId, content) => updateTabContent(tabId, content)"
          @open-note="handleWikiLinkClick"
          @toggle-checkbox="
            (tabId, lineIndex) => toggleChecklistItemForTab(tabId, lineIndex)
          "
        />
      </template>
    </main>

    <!-- Graph View Modal Component -->
    <GraphView
      :is-open="isGraphOpen"
      :graph-data="graphData"
      :active-note-name="activeNoteName"
      :accent-color="accentColor"
      @close="isGraphOpen = false"
      @open-note="handleOpenNoteFromGraph"
      @refresh="refreshGraph"
    />

    <!-- Settings Dialog Component -->
    <SettingsDialog
      :is-open="isSettingsOpen"
      :vault-name="vaultFolderName"
      @close="isSettingsOpen = false"
    />

    <!-- Delete Confirmation Modal Component -->
    <DeleteConfirmationDialog
      :item="deleteTarget"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- Move Item Dialog Component -->
    <MoveItemDialog
      :item="moveTarget"
      :vault-path="vaultPath"
      :file-tree="fileTree"
      @move="confirmMove"
      @cancel="cancelMove"
    />

    <!-- Right-click Context Menu -->
    <ContextMenu
      v-if="contextMenuTarget"
      :item="contextMenuTarget.item"
      :x="contextMenuTarget.x"
      :y="contextMenuTarget.y"
      @rename="startRename(contextMenuTarget.item)"
      @move="startMove(contextMenuTarget.item)"
      @delete="handleDeleteNote(contextMenuTarget.item)"
      @create-note="startCreateNote(contextMenuTarget.item)"
      @create-folder="startCreateFolder(contextMenuTarget.item)"
      @open-new-tab="openInNewTab(contextMenuTarget.item)"
      @close="closeContextMenu"
    />
  </div>
</template>
