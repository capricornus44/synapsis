<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

const props = defineProps<{ content: string }>();
const emit = defineEmits<{
  (e: "open-note", noteName: string): void;
  (e: "toggle-checkbox", lineIndex: number): void;
}>();

// Custom rendering of WikiLinks: [[My Note]] -> <a href="#" data-note="My Note">My Note</a>
const processWikiLinks = (text: string) => {
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  return text.replace(wikiLinkRegex, (_, target, alias) => {
    const label = alias ? alias : target;
    return `<a href="#" class="wikilink text-emerald-600 dark:text-emerald-400 font-medium underline underline-offset-2 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors" data-note="${target.trim()}">${label.trim()}</a>`;
  });
};

// Source line numbers of GFM task list items, in document order, so rendered
// checkboxes can be mapped back to the line marked toggles in the raw markdown.
const getChecklistLines = (text: string): number[] => {
  const taskLineRegex = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s/;
  return text.split("\n").reduce<number[]>((lines, line, index) => {
    if (taskLineRegex.test(line)) lines.push(index);
    return lines;
  }, []);
};

// marked renders task checkboxes as `<input disabled type=\"checkbox\">`; swap in
// a data-line index (so clicks can be mapped to source) and drop `disabled`.
const makeChecklistInteractive = (html: string, lineNumbers: number[]) => {
  let i = 0;
  return html.replace(
    /<input([^>]*?)type="checkbox"([^>]*?)>/g,
    (match, before, after) => {
      const lineIndex = lineNumbers[i++];
      if (lineIndex === undefined) return match;
      const checked = /checked/.test(before) || /checked/.test(after);
      return `<input type="checkbox"${checked ? " checked" : ""} data-line="${lineIndex}">`;
    },
  );
};

const parsedHtml = computed(() => {
  const htmlWithWiki = processWikiLinks(props.content);
  const rawHtml = String(marked.parse(htmlWithWiki));
  const interactiveHtml = makeChecklistInteractive(
    rawHtml,
    getChecklistLines(props.content),
  );
  return DOMPurify.sanitize(interactiveHtml);
});

const handleHtmlClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;

  if (target instanceof HTMLInputElement && target.type === "checkbox") {
    e.preventDefault();
    const lineIndex = target.getAttribute("data-line");
    if (lineIndex !== null) {
      emit("toggle-checkbox", Number(lineIndex));
    }
    return;
  }

  const wikilink = target.closest(".wikilink") as HTMLElement | null;
  if (wikilink) {
    e.preventDefault();
    const noteName = wikilink.getAttribute("data-note");
    if (noteName) {
      emit("open-note", noteName);
    }
  }
};
</script>

<template>
  <div
    @click="handleHtmlClick"
    v-html="parsedHtml"
    class="prose dark:prose-invert max-w-none h-full w-full p-8 overflow-auto text-left bg-neutral-50/50 dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 transition-colors"
  ></div>
</template>

<style scoped>
div :deep(li:has(> input[type="checkbox"])) {
  list-style: none;
  margin-left: -1.5em;
}

div :deep(input[type="checkbox"]) {
  appearance: none;
  -webkit-appearance: none;
  width: 1.2em;
  height: 1.2em;
  margin-right: 0.6em;
  vertical-align: -0.22em;
  flex-shrink: 0;
  border: 2px solid #cbd5e1;
  border-radius: 0.35em;
  background-color: #f1f5f9;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease;
}

:global(.dark) div :deep(input[type="checkbox"]) {
  border-color: #525252;
  background-color: #262626;
}

div :deep(input[type="checkbox"]:hover) {
  border-color: #34d399;
  transform: scale(1.08);
}

div :deep(input[type="checkbox"]:active) {
  transform: scale(0.9);
}

div :deep(input[type="checkbox"]:checked) {
  background-color: #10b981;
  border-color: #10b981;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='2.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='3.5 8.5 6.5 11.5 12.5 4.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: 68%;
}
</style>
