<script setup lang="ts">
import { computed } from "vue";
import type { WorkspacePane } from "../composables/useVault";
import { useFileTreeDrag } from "../composables/useFileTreeDrag";
import TabBar from "./TabBar.vue";
import NoteEditor from "./NoteEditor.vue";
import NotePreview from "./NotePreview.vue";
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  PenLine as PenLineIcon,
  BookOpen as BookOpenIcon,
  MoreHorizontal as MoreHorizontalIcon,
} from "@lucide/vue";

const props = defineProps<{
  pane: WorkspacePane;
  isActive: boolean;
  accentColor: string;
  breadcrumbFolder: string;
  breadcrumbName: string;
  highlightedLinkGroupId?: string | null;
}>();

const emit = defineEmits<{
  (e: "activate"): void;
  (e: "select-tab", tabId: string): void;
  (e: "close-tab", tabId: string): void;
  (e: "unlink-tab", tabId: string): void;
  (e: "link-hover", linkGroupId: string | null): void;
  (
    e: "view-mode-click",
    event: MouseEvent,
    targetMode: "edit" | "preview",
  ): void;
  (e: "update-content", tabId: string, content: string): void;
  (e: "open-note", targetName: string): void;
  (e: "toggle-checkbox", tabId: string, lineIndex: number): void;
}>();

const { dropTarget, isDragging } = useFileTreeDrag();

const isHeaderDropTarget = computed(
  () =>
    dropTarget.value?.type === "file-name-zone" &&
    dropTarget.value.paneId === props.pane.id,
);

const activeTab = computed(
  () => props.pane.tabs.find((t) => t.id === props.pane.activeTabId) ?? null,
);

const isContentLinkedHighlight = computed(
  () =>
    !!props.highlightedLinkGroupId &&
    activeTab.value?.linkGroupId === props.highlightedLinkGroupId,
);
</script>

<template>
  <div
    class="flex flex-col h-full min-h-0 min-w-0 overflow-hidden transition-colors"
    :class="[
      isActive
        ? 'bg-white dark:bg-neutral-950'
        : 'bg-neutral-50/80 dark:bg-neutral-900/40',
    ]"
    @mousedown="emit('activate')"
  >
    <TabBar
      v-if="pane.tabs.length > 0"
      :pane-id="pane.id"
      :tabs="pane.tabs"
      :active-tab-id="pane.activeTabId"
      :accent-color="accentColor"
      @select="emit('select-tab', $event)"
      @close="emit('close-tab', $event)"
      @unlink="emit('unlink-tab', $event)"
      @link-hover="emit('link-hover', $event)"
    />

    <header
      v-if="activeTab"
      data-drop-zone="file-name-zone"
      :data-pane-id="pane.id"
      class="h-9 px-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-1 shrink-0 transition-colors relative select-none"
      :class="[
        isHeaderDropTarget
          ? 'bg-neutral-100 dark:bg-neutral-800 ring-1 ring-inset'
          : 'bg-white/80 dark:bg-neutral-950/80',
      ]"
      :style="
        isHeaderDropTarget
          ? {
              backgroundColor: accentColor + '18',
              borderColor: accentColor,
            }
          : undefined
      "
    >
      <div class="flex items-center shrink-0">
        <button
          disabled
          title="Navigate back"
          class="p-1 rounded text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
        >
          <ChevronLeftIcon class="w-4 h-4" />
        </button>
        <button
          disabled
          title="Navigate forward"
          class="p-1 rounded text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
        >
          <ChevronRightIcon class="w-4 h-4" />
        </button>
      </div>

      <div
        class="flex-1 min-w-0 flex items-center justify-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 truncate px-2 transition-all"
        :class="isHeaderDropTarget ? 'scale-[1.02]' : ''"
      >
        <template v-if="breadcrumbFolder">
          <span class="truncate">{{ breadcrumbFolder }}</span>
          <span class="text-neutral-400 dark:text-neutral-600 shrink-0">/</span>
        </template>
        <span
          class="truncate font-medium transition-colors"
          :style="{ color: accentColor }"
        >
          {{ breadcrumbName }}
        </span>
      </div>

      <div class="flex items-center gap-0.5 shrink-0">
        <button
          v-if="activeTab.viewMode === 'edit'"
          @click="emit('view-mode-click', $event, 'preview')"
          class="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          title="Current view: editing&#10;Click to read&#10;Cmd + Click to split view"
        >
          <PenLineIcon class="w-4 h-4" />
        </button>
        <button
          v-if="activeTab.viewMode === 'preview'"
          @click="emit('view-mode-click', $event, 'edit')"
          class="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          title="Current view: reading&#10;Click to edit&#10;Cmd + Click to split view"
        >
          <BookOpenIcon class="w-4 h-4" />
        </button>
        <button
          disabled
          title="More options"
          class="p-1.5 rounded text-neutral-300 dark:text-neutral-600 cursor-not-allowed"
        >
          <MoreHorizontalIcon class="w-4 h-4" />
        </button>
      </div>
    </header>

    <div
      class="relative flex-1 min-h-0 overflow-hidden transition-[box-shadow] duration-150"
      :class="isDragging ? 'pointer-events-none select-none' : ''"
      :style="
        isContentLinkedHighlight
          ? {
              boxShadow: `inset 0 0 0 2px ${accentColor}`,
            }
          : undefined
      "
    >
      <div
        v-if="isContentLinkedHighlight"
        class="pointer-events-none absolute inset-0 z-10 transition-opacity"
        :style="{ backgroundColor: accentColor + '14' }"
      />
      <NoteEditor
        v-if="activeTab?.viewMode === 'edit'"
        :model-value="activeTab.content"
        @update:model-value="emit('update-content', activeTab.id, $event)"
      />
      <NotePreview
        v-else-if="activeTab?.viewMode === 'preview'"
        :content="activeTab.content"
        @open-note="emit('open-note', $event)"
        @toggle-checkbox="emit('toggle-checkbox', activeTab.id, $event)"
      />
    </div>
  </div>
</template>
