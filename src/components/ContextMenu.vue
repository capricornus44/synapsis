<script setup lang="ts">
import { computed } from "vue";
import type { NoteInfo } from "../composables/useVault";
import {
  Pencil as PencilIcon,
  Trash2 as Trash2Icon,
  Plus as PlusIcon,
  FolderPlus as FolderPlusIcon,
} from "@lucide/vue";

const props = defineProps<{
  item: NoteInfo;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  (e: "rename"): void;
  (e: "delete"): void;
  (e: "create-note"): void;
  (e: "create-folder"): void;
  (e: "close"): void;
}>();

const menuStyle = computed(() => {
  const menuWidth = 180;
  const menuHeight = props.item.is_dir ? 190 : 110;
  const left = Math.min(props.x, window.innerWidth - menuWidth - 8);
  const top = Math.min(props.y, window.innerHeight - menuHeight - 8);
  return { top: `${top}px`, left: `${left}px` };
});

const select = (action: "rename" | "delete" | "create-note" | "create-folder") => {
  if (action === "rename") emit("rename");
  else if (action === "delete") emit("delete");
  else if (action === "create-note") emit("create-note");
  else emit("create-folder");
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
        @click="select('rename')"
        class="w-full flex items-center gap-2 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors cursor-pointer"
      >
        <PencilIcon class="w-3.5 h-3.5" />
        <span>Rename</span>
      </button>

      <div class="my-1 border-t border-neutral-800"></div>

      <button
        @click="select('delete')"
        class="w-full flex items-center gap-2 px-3 py-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
      >
        <Trash2Icon class="w-3.5 h-3.5" />
        <span>Delete</span>
      </button>

      <template v-if="item.is_dir">
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
    </div>
  </div>
</template>
