<script setup lang="ts">
import { FileText as FileTextIcon, X as XIcon } from "@lucide/vue";
import type { NoteTab } from "../composables/useVault";

defineProps<{
  tabs: NoteTab[];
  activePath: string | null;
}>();

const emit = defineEmits<{
  (e: "select", path: string): void;
  (e: "close", path: string): void;
}>();
</script>

<template>
  <div
    class="flex items-center bg-neutral-900/50 border-b border-neutral-800 overflow-x-auto shrink-0"
  >
    <div
      v-for="tab in tabs"
      :key="tab.path"
      @click="emit('select', tab.path)"
      :class="[
        'group flex items-center gap-2 pl-3 pr-2 py-2 border-r border-neutral-800 cursor-pointer text-xs shrink-0 max-w-[180px]',
        tab.path === activePath
          ? 'bg-neutral-950 text-white'
          : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200',
      ]"
    >
      <FileTextIcon
        :class="[
          'w-3.5 h-3.5 shrink-0',
          tab.path === activePath ? 'text-emerald-400' : 'text-neutral-500',
        ]"
      />
      <span class="truncate">{{ tab.name }}</span>
      <button
        @click.stop="emit('close', tab.path)"
        title="Close tab"
        class="p-0.5 rounded hover:bg-neutral-700 text-neutral-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
      >
        <XIcon class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>
