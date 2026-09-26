<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { NoteInfo } from "../composables/useVault";
import {
  FolderInput as FolderInputIcon,
  Folder as FolderIcon,
  FolderRoot as FolderRootIcon,
  Search as SearchIcon,
  Check as CheckIcon,
} from "@lucide/vue";

interface FolderOption {
  name: string;
  path: string;
  relativePath: string;
  isCurrent: boolean;
}

const props = defineProps<{
  item: NoteInfo | null;
  vaultPath: string | null;
  fileTree: NoteInfo[];
}>();

const emit = defineEmits<{
  (e: "move", targetDirPath: string): void;
  (e: "cancel"): void;
}>();

const searchQuery = ref("");
const selectedIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

const getParentDir = (path: string) => {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx === -1 ? "" : path.slice(0, idx);
};

const allFolders = computed<FolderOption[]>(() => {
  if (!props.item || !props.vaultPath) return [];

  const currentParent = getParentDir(props.item.path);
  const result: FolderOption[] = [];

  // 1. Vault root
  result.push({
    name: "Vault root",
    path: props.vaultPath,
    relativePath: "/",
    isCurrent: currentParent === props.vaultPath,
  });

  // 2. Recursive folders
  const traverse = (items: NoteInfo[]) => {
    for (const entry of items) {
      if (!entry.is_dir) continue;

      // Cannot move a folder into itself or its descendants
      if (
        props.item?.is_dir &&
        (entry.path === props.item.path ||
          entry.path.startsWith(`${props.item.path}/`) ||
          entry.path.startsWith(`${props.item.path}\\`))
      ) {
        continue;
      }

      const rawRel = entry.path.slice(props.vaultPath!.length);
      const rel = rawRel.replace(/^[/\\]/, "").replace(/\\/g, "/");

      result.push({
        name: entry.name,
        path: entry.path,
        relativePath: `/${rel}`,
        isCurrent: currentParent === entry.path,
      });

      if (entry.children) {
        traverse(entry.children);
      }
    }
  };

  traverse(props.fileTree);
  return result;
});

const filteredFolders = computed<FolderOption[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allFolders.value;
  return allFolders.value.filter(
    (f) =>
      f.name.toLowerCase().includes(q) ||
      f.relativePath.toLowerCase().includes(q),
  );
});

watch(
  () => props.item,
  (newItem) => {
    if (newItem) {
      searchQuery.value = "";
      selectedIndex.value = 0;
      nextTick(() => {
        inputRef.value?.focus();
      });
    }
  },
);

watch(filteredFolders, () => {
  selectedIndex.value = 0;
});

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (filteredFolders.value.length > 0) {
      selectedIndex.value =
        (selectedIndex.value + 1) % filteredFolders.value.length;
      scrollToSelected();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (filteredFolders.value.length > 0) {
      selectedIndex.value =
        (selectedIndex.value - 1 + filteredFolders.value.length) %
        filteredFolders.value.length;
      scrollToSelected();
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (filteredFolders.value[selectedIndex.value]) {
      confirmMove(filteredFolders.value[selectedIndex.value]);
    }
  } else if (e.key === "Escape") {
    emit("cancel");
  }
};

const scrollToSelected = () => {
  nextTick(() => {
    const el = document.getElementById(`move-folder-item-${selectedIndex.value}`);
    el?.scrollIntoView({ block: "nearest" });
  });
};

const confirmMove = (folder: FolderOption) => {
  if (folder.isCurrent) {
    emit("cancel");
    return;
  }
  emit("move", folder.path);
};
</script>

<template>
  <div
    v-if="item"
    class="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-xs p-4"
    @click.self="emit('cancel')"
  >
    <div
      class="bg-neutral-900 border border-neutral-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
      @keydown="handleKeyDown"
    >
      <!-- Header -->
      <div class="p-4 border-b border-neutral-800 flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0"
        >
          <FolderInputIcon class="w-5 h-5" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold text-neutral-100 text-sm truncate">
            Move "{{ item.name }}"
          </h3>
          <p class="text-xs text-neutral-400 truncate">
            Select a destination folder in your vault
          </p>
        </div>
      </div>

      <!-- Search Input -->
      <div class="p-3 border-b border-neutral-800 bg-neutral-950/40">
        <div class="relative">
          <SearchIcon
            class="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            ref="inputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Type folder name..."
            class="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-900 rounded-lg border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      <!-- Folder List -->
      <div class="flex-1 overflow-y-auto p-2 space-y-0.5">
        <div
          v-if="filteredFolders.length === 0"
          class="p-6 text-center text-xs text-neutral-500"
        >
          No matching folders found
        </div>

        <button
          v-for="(folder, idx) in filteredFolders"
          :id="`move-folder-item-${idx}`"
          :key="folder.path"
          type="button"
          @click="confirmMove(folder)"
          @mouseenter="selectedIndex = idx"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left',
            selectedIndex === idx
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-300 hover:bg-neutral-800/60 hover:text-white',
          ]"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <FolderRootIcon
              v-if="folder.relativePath === '/'"
              class="w-4 h-4 text-emerald-400 shrink-0"
            />
            <FolderIcon
              v-else
              class="w-4 h-4 text-neutral-400 shrink-0"
            />
            <div class="flex flex-col min-w-0">
              <span class="font-medium truncate">{{ folder.name }}</span>
              <span class="text-[11px] text-neutral-500 truncate">{{
                folder.relativePath
              }}</span>
            </div>
          </div>

          <div v-if="folder.isCurrent" class="flex items-center gap-1 shrink-0 ml-2">
            <span
              class="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 font-medium"
            >
              current
            </span>
          </div>
          <div
            v-else-if="selectedIndex === idx"
            class="shrink-0 text-emerald-400 text-[11px] flex items-center gap-1 ml-2"
          >
            <span>Move here</span>
            <CheckIcon class="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      <!-- Footer -->
      <div
        class="p-3 border-t border-neutral-800 bg-neutral-900/60 flex items-center justify-between text-[11px] text-neutral-500"
      >
        <span>
          <kbd class="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400 text-[10px]">↑</kbd>
          <kbd class="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400 text-[10px] ml-1">↓</kbd>
          to navigate,
          <kbd class="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400 text-[10px] ml-1">Enter</kbd>
          to select
        </span>
        <button
          type="button"
          @click="emit('cancel')"
          class="px-2.5 py-1 text-xs rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
