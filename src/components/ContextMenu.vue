<script setup lang="ts">
import { computed } from "vue";
import type { NoteInfo } from "../composables/useVault";
import {
  Pencil as PencilIcon,
  FolderInput as FolderInputIcon,
  Trash2 as Trash2Icon,
  Plus as PlusIcon,
  FolderPlus as FolderPlusIcon,
  ExternalLink as ExternalLinkIcon,
} from "@lucide/vue";

const props = defineProps<{
  item: NoteInfo;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  (e: "rename"): void;
  (e: "move"): void;
  (e: "delete"): void;
  (e: "create-note"): void;
  (e: "create-folder"): void;
  (e: "open-new-tab"): void;
  (e: "close"): void;
}>();

const menuStyle = computed(() => {
  const menuWidth = 180;
  const menuHeight = props.item.is_dir ? 220 : 180;
  const left = Math.min(props.x, window.innerWidth - menuWidth - 8);
  const top = Math.min(props.y, window.innerHeight - menuHeight - 8);
  return { top: `${top}px`, left: `${left}px` };
});

type MenuAction =
  | "rename"
  | "move"
  | "delete"
  | "create-note"
  | "create-folder"
  | "open-new-tab";

const select = (action: MenuAction) => {
  if (action === "rename") emit("rename");
  else if (action === "move") emit("move");
  else if (action === "delete") emit("delete");
  else if (action === "create-note") emit("create-note");
  else if (action === "create-folder") emit("create-folder");
  else emit("open-new-tab");
  emit("close");
};
</script>

<template>
  <div
    class="fixed inset-0 z-50"
    @click="emit('close')"
    @contextmenu.prevent="emit('close')"
  >
    <div
      class="absolute min-w-[170px] bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl py-1 text-xs"
      :style="menuStyle"
      @click.stop
    >
      <button
        v-if="!item.is_dir"
        @click="select('open-new-tab')"
        class="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <ExternalLinkIcon class="w-3.5 h-3.5" />
        <span>Open in New Tab</span>
      </button>

      <button
        @click="select('rename')"
        class="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <PencilIcon class="w-3.5 h-3.5" />
        <span>Rename</span>
      </button>

      <button
        @click="select('move')"
        class="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <FolderInputIcon class="w-3.5 h-3.5" />
        <span>Move to...</span>
      </button>

      <template v-if="item.is_dir">
        <div class="my-1 border-t border-neutral-800"></div>

        <button
          @click="select('create-note')"
          class="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
        >
          <PlusIcon class="w-3.5 h-3.5" />
          <span>New Note</span>
        </button>
        <button
          @click="select('create-folder')"
          class="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
        >
          <FolderPlusIcon class="w-3.5 h-3.5" />
          <span>New Folder</span>
        </button>
      </template>

      <div class="my-1 border-t border-neutral-800"></div>

      <button
        @click="select('delete')"
        class="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
      >
        <Trash2Icon class="w-3.5 h-3.5" />
        <span>Delete</span>
      </button>
    </div>
  </div>
</template>
