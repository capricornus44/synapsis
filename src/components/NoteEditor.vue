<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { githubLight } from "@fsegurai/codemirror-theme-github-light";
import { useTheme } from "../composables/useTheme";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const { effectiveTheme } = useTheme();

const editorContainer = ref<HTMLElement | null>(null);
let view: EditorView | null = null;
const themeCompartment = new Compartment();

onMounted(() => {
  if (!editorContainer.value) return;

  const startState = EditorState.create({
    doc: props.modelValue,
    extensions: [
      markdown(),
      themeCompartment.of(
        effectiveTheme.value === "dark" ? oneDark : githubLight,
      ),
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

// Watch theme changes
watch(effectiveTheme, (newTheme) => {
  if (view) {
    view.dispatch({
      effects: themeCompartment.reconfigure(
        newTheme === "dark" ? oneDark : githubLight,
      ),
    });
  }
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
    class="h-full w-full border-r border-neutral-200 dark:border-neutral-800 text-left overflow-auto bg-white dark:bg-[#282c34] transition-colors"
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
