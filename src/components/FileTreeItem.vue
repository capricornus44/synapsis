<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { NoteInfo } from "../composables/useVault";
import {
  beginTreeDrag,
  consumeTreeDragClickSuppression,
  useFileTreeDrag,
} from "../composables/useFileTreeDrag";
import { ChevronRight as ChevronRightIcon } from "@lucide/vue";

const props = defineProps<{
  item: NoteInfo;
  activePath: string | null;
  renamingPath?: string | null;
  depth?: number;
  parentPath?: string | null;
}>();

const emit = defineEmits<{
  (e: "open", item: NoteInfo): void;
  (e: "rename", item: NoteInfo, newName: string): void;
  (e: "rename-cancel"): void;
  (e: "context-menu", item: NoteInfo, event: MouseEvent): void;
}>();

const { dragSource, dropTargetPath } = useFileTreeDrag();

const isOpen = ref(true);
let expandTimer: ReturnType<typeof setTimeout> | null = null;

const toggleFolder = () => {
  isOpen.value = !isOpen.value;
};

const handleClick = () => {
  if (consumeTreeDragClickSuppression()) return;
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

const isDraggingSelf = computed(
  () => dragSource.value?.path === props.item.path,
);

const isDropTarget = computed(
  () =>
    props.item.is_dir &&
    dropTargetPath.value === props.item.path &&
    dragSource.value?.path !== props.item.path,
);

watch(isDropTarget, (active) => {
  if (expandTimer !== null) {
    clearTimeout(expandTimer);
    expandTimer = null;
  }
  if (active && props.item.is_dir && !isOpen.value) {
    expandTimer = setTimeout(() => {
      isOpen.value = true;
    }, 450);
  }
});

const handlePointerDown = (e: PointerEvent) => {
  beginTreeDrag(props.item, e, isRenaming.value);
};
</script>

<template>
  <div class="select-none text-sm">
    <div
      @click="handleClick"
      @contextmenu.prevent="handleContextMenu"
      @pointerdown="handlePointerDown"
      :data-tree-drop-folder="item.is_dir ? item.path : undefined"
      :data-tree-drop-parent="!item.is_dir ? parentPath || undefined : undefined"
      :style="{ paddingLeft: `${(props.depth || 0) * 12 + 8}px` }"
      :class="[
        'group flex items-center justify-between py-1.5 px-2 rounded-md cursor-pointer transition-colors duration-150',
        isDraggingSelf ? 'opacity-40' : '',
        isDropTarget
          ? 'bg-accent/20 ring-1 ring-inset ring-accent text-neutral-900 dark:text-white'
          : props.activePath === props.item.path
            ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-neutral-200',
      ]"
    >
      <div class="flex items-center gap-1.5 min-w-0 truncate flex-1">
        <template v-if="props.item.is_dir">
          <ChevronRightIcon
            :class="[
              'w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500 shrink-0 transition-transform duration-150 pointer-events-none',
              isOpen ? 'rotate-90' : '',
            ]"
          />
          <input
            v-if="isRenaming"
            ref="renameInputRef"
            v-model="renameValue"
            type="text"
            @click.stop
            @pointerdown.stop
            @keydown.enter="commitRename"
            @keydown.escape="cancelRename"
            @blur="commitRename"
            class="w-full min-w-0 bg-white dark:bg-neutral-950 border border-accent rounded px-1 py-0.5 text-xs text-neutral-900 dark:text-white focus:outline-none"
          />
          <span v-else class="truncate">{{ props.item.name }}</span>
        </template>

        <template v-else>
          <span class="w-3.5 shrink-0"></span>
          <input
            v-if="isRenaming"
            ref="renameInputRef"
            v-model="renameValue"
            type="text"
            @click.stop
            @pointerdown.stop
            @keydown.enter="commitRename"
            @keydown.escape="cancelRename"
            @blur="commitRename"
            class="w-full min-w-0 bg-white dark:bg-neutral-950 border border-accent rounded px-1 py-0.5 text-xs text-neutral-900 dark:text-white focus:outline-none"
          />
          <span v-else class="truncate">{{
            props.item.name.replace(/\.md$/, "")
          }}</span>
        </template>
      </div>
    </div>

    <div v-if="props.item.is_dir && isOpen && props.item.children">
      <FileTreeItem
        v-for="child in props.item.children"
        :key="child.path"
        :item="child"
        :active-path="props.activePath"
        :renaming-path="props.renamingPath"
        :parent-path="props.item.path"
        :depth="(props.depth || 0) + 1"
        @open="emit('open', $event)"
        @rename="(item, newName) => emit('rename', item, newName)"
        @rename-cancel="emit('rename-cancel')"
        @context-menu="(item, event) => emit('context-menu', item, event)"
      />
    </div>
  </div>
</template>
