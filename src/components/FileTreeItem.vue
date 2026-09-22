<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { NoteInfo } from "../composables/useVault";
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  FileText as FileTextIcon,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
} from "@lucide/vue";

const props = defineProps<{
  item: NoteInfo;
  activePath: string | null;
  renamingPath?: string | null;
  depth?: number;
}>();

const emit = defineEmits<{
  (e: "open", item: NoteInfo): void;
  (e: "rename", item: NoteInfo, newName: string): void;
  (e: "rename-cancel"): void;
  (e: "context-menu", item: NoteInfo, event: MouseEvent): void;
}>();

const isOpen = ref(true);

const toggleFolder = () => {
  isOpen.value = !isOpen.value;
};

const handleClick = () => {
  if (props.item.is_dir) {
    toggleFolder();
  } else {
    emit("open", props.item);
  }
};

const handleContextMenu = (e: MouseEvent) => {
  emit("context-menu", props.item, e);
};

const isRenaming = computed(() => props.renamingPath === props.item.path);
const renameValue = ref("");
const renameInputRef = ref<HTMLInputElement | null>(null);
let suppressBlurCommit = false;

watch(isRenaming, (active) => {
  if (active) {
    renameValue.value = props.item.is_dir
      ? props.item.name
      : props.item.name.replace(/\.md$/, "");
    nextTick(() => {
      renameInputRef.value?.focus();
      renameInputRef.value?.select();
    });
  }
});

const commitRename = () => {
  if (suppressBlurCommit) {
    suppressBlurCommit = false;
    return;
  }
  const trimmed = renameValue.value.trim();
  emit("rename", props.item, trimmed || props.item.name);
};

const cancelRename = () => {
  suppressBlurCommit = true;
  emit("rename-cancel");
};
</script>

<template>
  <div class="select-none text-sm">
    <div
      @click="handleClick"
      @contextmenu.prevent="handleContextMenu"
      :style="{ paddingLeft: `${(props.depth || 0) * 12 + 8}px` }"
      :class="[
        'group flex items-center justify-between py-1 px-2 rounded-md cursor-pointer transition-colors duration-150',
        props.activePath === props.item.path
          ? 'bg-neutral-800 text-white font-medium'
          : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200',
      ]"
    >
      <div class="flex items-center gap-1.5 min-w-0 truncate flex-1">
        <template v-if="props.item.is_dir">
          <component
            :is="isOpen ? ChevronDownIcon : ChevronRightIcon"
            class="w-3.5 h-3.5 text-neutral-500 shrink-0"
          />
          <component
            :is="isOpen ? FolderOpenIcon : FolderIcon"
            class="w-4 h-4 text-amber-400/80 shrink-0"
          />
          <input
            v-if="isRenaming"
            ref="renameInputRef"
            v-model="renameValue"
            type="text"
            @click.stop
            @keydown.enter="commitRename"
            @keydown.escape="cancelRename"
            @blur="commitRename"
            class="w-full min-w-0 bg-neutral-950 border border-emerald-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
          />
          <span v-else class="truncate">{{ props.item.name }}</span>
        </template>

        <template v-else>
          <span class="w-3.5 shrink-0"></span>
          <FileTextIcon class="w-4 h-4 text-emerald-400/70 shrink-0" />
          <input
            v-if="isRenaming"
            ref="renameInputRef"
            v-model="renameValue"
            type="text"
            @click.stop
            @keydown.enter="commitRename"
            @keydown.escape="cancelRename"
            @blur="commitRename"
            class="w-full min-w-0 bg-neutral-950 border border-emerald-500 rounded px-1 py-0.5 text-xs text-white focus:outline-none"
          />
          <span v-else class="truncate">{{
            props.item.name.replace(/\.md$/, "")
          }}</span>
        </template>
      </div>
    </div>

    <!-- Recursive children for folders -->
    <div v-if="props.item.is_dir && isOpen && props.item.children">
      <FileTreeItem
        v-for="child in props.item.children"
        :key="child.path"
        :item="child"
        :active-path="props.activePath"
        :renaming-path="props.renamingPath"
        :depth="(props.depth || 0) + 1"
        @open="emit('open', $event)"
        @rename="(item, newName) => emit('rename', item, newName)"
        @rename-cancel="emit('rename-cancel')"
        @context-menu="(item, event) => emit('context-menu', item, event)"
      />
    </div>
  </div>
</template>
