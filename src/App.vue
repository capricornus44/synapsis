<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useVault, type NoteInfo } from "./composables/useVault";
import NoteEditor from "./components/NoteEditor.vue";
import NotePreview from "./components/NotePreview.vue";
import FileTreeItem from "./components/FileTreeItem.vue";
import DeleteConfirmationDialog from "./dialogs/DeleteConfirmationDialog.vue";
import {
  FolderOpen as FolderOpenIcon,
  Plus as PlusIcon,
  FolderPlus as FolderPlusIcon,
  Search as SearchIcon,
  Save as SaveIcon,
  Columns2 as Columns2Icon,
  PenLine as PenLineIcon,
  Eye as EyeIcon,
  Link2 as Link2Icon,
  RotateCcw as RotateCcwIcon,
  FileText as FileTextIcon,
  Sparkles as SparklesIcon,
} from "@lucide/vue";

const {
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
} = useVault();

type ViewMode = "split" | "edit" | "preview";
type CreateMode = "note" | "folder";

const viewMode = ref<ViewMode>("split");
const searchQuery = ref("");
const createMode = ref<CreateMode | null>(null);
const createTargetFolder = ref<NoteInfo | null>(null);
const createInputTitle = ref("");
const deleteTarget = ref<NoteInfo | null>(null);

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
  }
};

const cancelDelete = () => {
  deleteTarget.value = null;
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
};

// Keyboard shortcut handler (Cmd/Ctrl + S to save, Cmd/Ctrl + N to new note, Escape to close modals)
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
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
  if (isModifier && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (activeNotePath.value) {
      saveNote();
    }
  } else if (isModifier && e.key.toLowerCase() === "n") {
    e.preventDefault();
    if (vaultPath.value) {
      startCreateNote();
    }
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div
    class="flex h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden select-none"
  >
    <!-- Left Sidebar -->
    <aside
      class="w-72 bg-neutral-900/95 border-r border-neutral-800 flex flex-col shrink-0"
    >
      <!-- App Header -->
      <div
        class="h-14 px-4 border-b border-neutral-800 flex items-center justify-between"
      >
        <div class="flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold"
          >
            <SparklesIcon class="w-4 h-4" />
          </div>
          <h1 class="font-bold text-base tracking-wide text-neutral-100">
            Synapsis
          </h1>
        </div>
        <button
          v-if="vaultPath"
          @click="selectVault"
          title="Switch Vault"
          class="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
        >
          <FolderOpenIcon class="w-4 h-4" />
        </button>
      </div>

      <!-- Vault Banner / Actions -->
      <div class="p-3 border-b border-neutral-800/80">
        <template v-if="!vaultPath">
          <button
            @click="selectVault"
            class="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors shadow-sm cursor-pointer"
          >
            <FolderOpenIcon class="w-4 h-4" />
            <span>Open Vault</span>
          </button>
        </template>

        <template v-else>
          <div class="flex items-center justify-between mb-2">
            <div
              class="flex items-center gap-1.5 truncate text-xs text-neutral-400"
            >
              <span class="font-medium text-neutral-200 truncate">{{
                vaultFolderName
              }}</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                @click="refreshFileTree"
                title="Refresh Vault"
                class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <RotateCcwIcon class="w-3.5 h-3.5" />
              </button>
              <button
                @click="startCreateFolder()"
                title="New Folder"
                class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <FolderPlusIcon class="w-4 h-4" />
              </button>
              <button
                @click="startCreateNote()"
                title="New Note (Ctrl/Cmd+N)"
                class="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <PlusIcon class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- New Note / Folder Inline Input -->
          <div v-if="createMode" class="mt-2 mb-1">
            <form
              @submit.prevent="submitCreate"
              class="flex flex-col gap-1.5 bg-neutral-800/90 p-2 rounded-lg border border-neutral-700"
            >
              <div
                class="flex items-center justify-between text-[11px] text-neutral-400"
              >
                <span>
                  New {{ createMode === "folder" ? "Folder" : "Note" }}
                  <span
                    v-if="createTargetFolder"
                    class="text-neutral-200 font-medium truncate"
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
                class="w-full px-2 py-1 text-xs bg-neutral-900 rounded border border-neutral-700 text-white focus:outline-none focus:border-emerald-500"
              />
              <div class="flex justify-end gap-1.5">
                <button
                  type="button"
                  @click="cancelCreate"
                  class="px-2 py-0.5 text-xs rounded hover:bg-neutral-700 text-neutral-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="px-2 py-0.5 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  Create
                </button>
              </div>
            </form>
          </div>

          <!-- Search Filter -->
          <div class="relative">
            <SearchIcon
              class="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter notes..."
              class="w-full pl-8 pr-2.5 py-1 text-xs bg-neutral-800/80 rounded-md border border-transparent focus:border-neutral-700 text-neutral-200 placeholder-neutral-500 focus:outline-none"
            />
          </div>
        </template>
      </div>

      <!-- File Explorer Tree -->
      <div class="flex-1 overflow-y-auto p-2">
        <div
          v-if="vaultPath && displayedTree.length === 0"
          class="p-4 text-center text-xs text-neutral-500"
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
          <FolderOpenIcon class="w-8 h-8 text-neutral-600" />
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
          @open="handleSelectNote"
          @delete="handleDeleteNote"
          @create-note-in="startCreateNote($event)"
          @create-folder-in="startCreateFolder($event)"
        />
      </div>

      <!-- Backlinks Panel -->
      <div
        v-if="activeNoteName"
        class="border-t border-neutral-800 bg-neutral-900/60 p-3 max-h-48 flex flex-col"
      >
        <div
          class="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 mb-2"
        >
          <Link2Icon class="w-3.5 h-3.5 text-emerald-400" />
          <span>Backlinks ({{ backlinks.length }})</span>
        </div>
        <div class="overflow-y-auto flex-1 space-y-1">
          <div
            v-for="sourceNote in backlinks"
            :key="sourceNote"
            @click="handleOpenBacklink(sourceNote)"
            class="flex items-center gap-1.5 py-1 px-2 rounded text-xs text-neutral-300 hover:bg-neutral-800 hover:text-emerald-400 cursor-pointer transition-colors"
          >
            <FileTextIcon class="w-3 h-3 text-neutral-500 shrink-0" />
            <span class="truncate">[[{{ sourceNote }}]]</span>
          </div>
          <div
            v-if="backlinks.length === 0"
            class="text-xs text-neutral-500 italic px-2 py-1"
          >
            No backlinks referencing this note
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Workspace Area -->
    <main class="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden">
      <!-- Top Workspace Toolbar -->
      <header
        class="h-14 px-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50 shrink-0"
      >
        <div class="flex items-center gap-3">
          <FileTextIcon
            v-if="activeNoteName"
            class="w-4 h-4 text-emerald-400"
          />
          <h2 class="font-medium text-sm text-neutral-200">
            {{ activeNoteName ? `${activeNoteName}.md` : "No note selected" }}
          </h2>
          <span
            v-if="isDirty"
            class="w-2 h-2 rounded-full bg-amber-400"
            title="Unsaved changes"
          ></span>
          <span v-if="isSaving" class="text-xs text-neutral-400"
            >Saving...</span
          >
        </div>

        <div v-if="activeNoteName" class="flex items-center gap-3">
          <!-- View Mode Toggle -->
          <div
            class="flex items-center bg-neutral-800/80 rounded-lg p-0.5 border border-neutral-700/60 text-xs"
          >
            <button
              @click="viewMode = 'edit'"
              :class="[
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer',
                viewMode === 'edit'
                  ? 'bg-neutral-700 text-white font-medium'
                  : 'text-neutral-400 hover:text-neutral-200',
              ]"
              title="Edit Mode"
            >
              <PenLineIcon class="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              @click="viewMode = 'split'"
              :class="[
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer',
                viewMode === 'split'
                  ? 'bg-neutral-700 text-white font-medium'
                  : 'text-neutral-400 hover:text-neutral-200',
              ]"
              title="Split Mode (Side-by-side)"
            >
              <Columns2Icon class="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              @click="viewMode = 'preview'"
              :class="[
                'flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer',
                viewMode === 'preview'
                  ? 'bg-neutral-700 text-white font-medium'
                  : 'text-neutral-400 hover:text-neutral-200',
              ]"
              title="Preview Mode"
            >
              <EyeIcon class="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          <!-- Save Button -->
          <button
            @click="saveNote"
            :disabled="!isDirty || isSaving"
            :class="[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              isDirty
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer'
                : 'bg-neutral-800 text-neutral-500 cursor-default',
            ]"
            title="Save Note (Ctrl/Cmd+S)"
          >
            <SaveIcon class="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </header>

      <!-- Main Body Container -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Empty State -->
        <div
          v-if="!activeNoteName"
          class="flex-1 flex flex-col items-center justify-center gap-4 text-neutral-500 p-8 text-center"
        >
          <div
            class="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600"
          >
            <FileTextIcon class="w-8 h-8 text-neutral-600" />
          </div>
          <div>
            <h3 class="text-base font-medium text-neutral-300 mb-1">
              No note open
            </h3>
            <p class="text-xs text-neutral-500 max-w-sm">
              Select a markdown file from the left sidebar, or open a vault to
              start writing and interlinking your ideas.
            </p>
          </div>
          <div v-if="vaultPath" class="flex gap-2">
            <button
              @click="startCreateFolder()"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <FolderPlusIcon class="w-3.5 h-3.5" />
              <span>New Folder</span>
            </button>
            <button
              @click="startCreateNote()"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <PlusIcon class="w-3.5 h-3.5" />
              <span>New Note</span>
            </button>
          </div>
        </div>

        <!-- Note Active: Split / Edit / Preview -->
        <template v-else>
          <!-- Editor Pane -->
          <div
            v-if="viewMode === 'edit' || viewMode === 'split'"
            :class="[
              'h-full overflow-hidden flex flex-col',
              viewMode === 'split' ? 'w-1/2' : 'w-full',
            ]"
          >
            <NoteEditor
              :model-value="activeNoteContent"
              @update:model-value="updateContent"
            />
          </div>

          <!-- Preview Pane -->
          <div
            v-if="viewMode === 'preview' || viewMode === 'split'"
            :class="[
              'h-full overflow-hidden flex flex-col',
              viewMode === 'split' ? 'w-1/2' : 'w-full',
            ]"
          >
            <NotePreview
              :content="activeNoteContent"
              @open-note="handleWikiLinkClick"
            />
          </div>
        </template>
      </div>
    </main>

    <!-- Delete Confirmation Modal Component -->
    <DeleteConfirmationDialog
      :item="deleteTarget"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>
