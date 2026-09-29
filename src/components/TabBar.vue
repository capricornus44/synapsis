<script setup lang="ts">
import {
  FileText as FileTextIcon,
  Link2 as Link2Icon,
  X as XIcon,
} from "@lucide/vue";
import type { NoteTab } from "../composables/useVault";

defineProps<{
  tabs: NoteTab[];
  activeTabId: string | null;
  accentColor: string;
}>();

const emit = defineEmits<{
  (e: "select", id: string): void;
  (e: "close", id: string): void;
  (e: "unlink", id: string): void;
  (e: "link-hover", linkGroupId: string | null): void;
}>();
</script>

<template>
  <div
    class="flex items-stretch bg-neutral-100/80 dark:bg-neutral-900/80 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto shrink-0 min-h-[36px] transition-colors"
  >
    <div
      v-for="tab in tabs"
      :key="tab.id"
      @click="emit('select', tab.id)"
      :class="[
        'group relative flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 border-r border-neutral-200/80 dark:border-neutral-800 cursor-pointer text-xs shrink-0 max-w-[220px] transition-colors',
        tab.id === activeTabId
          ? 'bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100'
          : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 hover:text-neutral-800 dark:hover:text-neutral-200',
      ]"
    >
      <span
        v-if="tab.id === activeTabId"
        class="absolute top-0 left-0 right-0 h-0.5"
        :style="{ backgroundColor: accentColor }"
      />
      <FileTextIcon
        class="w-3 h-3 shrink-0"
        :class="
          tab.id === activeTabId
            ? ''
            : 'text-neutral-400 dark:text-neutral-500'
        "
        :style="
          tab.id === activeTabId ? { color: accentColor } : undefined
        "
      />
      <span class="truncate">{{ tab.name }}</span>
      <button
        v-if="tab.linkGroupId"
        @click.stop="emit('unlink', tab.id)"
        @mouseenter="emit('link-hover', tab.linkGroupId)"
        @mouseleave="emit('link-hover', null)"
        title="Unlink tab"
        class="p-0.5 rounded hover:bg-neutral-300/70 dark:hover:bg-neutral-700 shrink-0 cursor-pointer transition-colors"
        :style="{ color: accentColor }"
      >
        <Link2Icon class="w-3 h-3" />
      </button>
      <button
        @click.stop="emit('close', tab.id)"
        title="Close tab"
        class="p-0.5 rounded hover:bg-neutral-300/70 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
      >
        <XIcon class="w-3 h-3" />
      </button>
    </div>
  </div>
</template>
