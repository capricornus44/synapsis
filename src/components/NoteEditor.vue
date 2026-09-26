<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { synapsisEditorTheme } from "../editor/theme";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const editorContainer = ref<HTMLElement | null>(null);
let view: EditorView | null = null;

onMounted(() => {
  if (!editorContainer.value) return;

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      markdown(),
      synapsisEditorTheme,
      keymap.of(defaultKeymap),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit("update:modelValue", update.state.doc.toString());
        }
      }),
    ],
  });

  view = new EditorView({
    state: startState,
    parent: editorContainer.value,
  });
});

onUnmounted(() => {
  view?.destroy();
  view = null;
});

// Syncing external changes (e.g., when switching files)
watch(
  () => props.modelValue,
  (newVal) => {
    if (view && newVal !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: newVal },
      });
    }
  },
);
</script>

<template>
  <div
    ref="editorContainer"
    class="h-full w-full border-r border-neutral-200 dark:border-neutral-800 text-left overflow-auto bg-(--editor-bg) transition-colors"
  ></div>
</template>

<style>
/* CodeMirror styling for a minimalist editor */
.cm-editor {
  height: 100%;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 14px;
}
.cm-scroller {
  overflow: auto;
  padding: 1rem;
}
.cm-editor.cm-focused {
  outline: none;
}
</style>
