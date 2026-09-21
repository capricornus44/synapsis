<script setup lang="ts">
import { ref } from "vue";
import type { NoteInfo } from "../composables/useVault";
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  FileText as FileTextIcon,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  Trash2 as Trash2Icon,
  Plus as PlusIcon,
  FolderPlus as FolderPlusIcon,
} from "@lucide/vue";

const props = defineProps<{
  item: NoteInfo;
  activePath: string | null;
  depth?: number;
}>();

const emit = defineEmits<{
  (e: "open", item: NoteInfo): void;
  (e: "delete", item: NoteInfo): void;
  (e: "create-note-in", folder: NoteInfo): void;
  (e: "create-folder-in", folder: NoteInfo): void;
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

const handleDelete = () => {
  emit("delete", props.item);
};
</script>

<template>
  <div class="select-none text-sm">
    <div
      @click="handleClick"
      :style="{ paddingLeft: `${(props.depth || 0) * 12 + 8}px` }"
      :class="[
        'group flex items-center justify-between py-1 px-2 rounded-md cursor-pointer transition-colors duration-150',
        props.activePath === props.item.path
          ? 'bg-neutral-800 text-white font-medium'
          : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200',
      ]"
    >
      <div class="flex items-center gap-1.5 min-w-0 truncate">
        <template v-if="props.item.is_dir">
          <component
            :is="isOpen ? ChevronDownIcon : ChevronRightIcon"
            class="w-3.5 h-3.5 text-neutral-500 shrink-0"
          />
          <component
            :is="isOpen ? FolderOpenIcon : FolderIcon"
            class="w-4 h-4 text-amber-400/80 shrink-0"
          />
          <span class="truncate">{{ props.item.name }}</span>
        </template>

        <template v-else>
          <span class="w-3.5 shrink-0"></span>
          <FileTextIcon class="w-4 h-4 text-emerald-400/70 shrink-0" />
          <span class="truncate">{{
            props.item.name.replace(/\.md$/, "")
          }}</span>
        </template>
      </div>

      <!-- Action buttons (visible on hover) -->
      <div
        class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-1"
      >
        <template v-if="props.item.is_dir">
          <button
            @click.stop="emit('create-note-in', props.item)"
            :title="`New note inside ${props.item.name}`"
            class="p-1 rounded hover:bg-neutral-700/80 text-neutral-400 hover:text-emerald-400 transition-colors"
          >
            <PlusIcon class="w-3.5 h-3.5" />
          </button>
          <button
            @click.stop="emit('create-folder-in', props.item)"
            :title="`New subfolder inside ${props.item.name}`"
            class="p-1 rounded hover:bg-neutral-700/80 text-neutral-400 hover:text-amber-400 transition-colors"
          >
            <FolderPlusIcon class="w-3.5 h-3.5" />
          </button>
        </template>
        <button
          @click.stop="handleDelete"
          :title="`Delete ${props.item.name}`"
          class="p-1 rounded hover:bg-neutral-700/80 text-neutral-400 hover:text-red-400 transition-colors"
        >
          <Trash2Icon class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Recursive children for folders -->
    <div v-if="props.item.is_dir && isOpen && props.item.children">
      <FileTreeItem
        v-for="child in props.item.children"
        :key="child.path"
        :item="child"
        :active-path="props.activePath"
        :depth="(props.depth || 0) + 1"
        @open="emit('open', $event)"
        @delete="emit('delete', $event)"
        @create-note-in="emit('create-note-in', $event)"
        @create-folder-in="emit('create-folder-in', $event)"
      />
    </div>
  </div>
</template>
