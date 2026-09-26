<script setup lang="ts">
import type { NoteInfo } from "../composables/useVault";
import { Trash2 as Trash2Icon } from "@lucide/vue";

defineProps<{
  item: NoteInfo | null;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();
</script>

<template>
  <div
    v-if="item"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    @click.self="emit('cancel')"
  >
    <div
      class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-neutral-800 dark:text-neutral-100 transition-colors"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-full bg-red-500/15 text-red-500 dark:text-red-400 flex items-center justify-center shrink-0"
        >
          <Trash2Icon class="w-5 h-5" />
        </div>
        <div>
          <h3
            class="font-semibold text-neutral-900 dark:text-neutral-100 text-sm"
          >
            Delete {{ item.is_dir ? "Folder" : "Note" }}
          </h3>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            This action cannot be undone.
          </p>
        </div>
      </div>

      <p class="text-xs text-neutral-600 dark:text-neutral-300">
        Are you sure you want to delete
        <span class="font-semibold text-neutral-900 dark:text-white"
          >"{{ item.name }}"</span
        >?
      </p>

      <div class="flex justify-end gap-2 pt-1">
        <button
          type="button"
          @click="emit('cancel')"
          class="px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="emit('confirm')"
          class="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors cursor-pointer"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
</template>
