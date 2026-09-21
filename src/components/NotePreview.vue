<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import DOMPurify from "dompurify";

const props = defineProps<{ content: string }>();
const emit = defineEmits<{
  (e: "open-note", noteName: string): void;
}>();

// Custom rendering of WikiLinks: [[My Note]] -> <a href="#" data-note="My Note">My Note</a>
const processWikiLinks = (text: string) => {
  const wikiLinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  return text.replace(wikiLinkRegex, (_, target, alias) => {
    const label = alias ? alias : target;
    return `<a href="#" class="wikilink text-emerald-400 font-medium underline underline-offset-2 hover:text-emerald-300 transition-colors" data-note="${target.trim()}">${label.trim()}</a>`;
  });
};

const parsedHtml = computed(() => {
  const htmlWithWiki = processWikiLinks(props.content);
  const rawHtml = String(marked.parse(htmlWithWiki));
  return DOMPurify.sanitize(rawHtml);
});

const handleHtmlClick = (e: MouseEvent) => {
  const target = (e.target as HTMLElement).closest(
    ".wikilink",
  ) as HTMLElement | null;
  if (target) {
    e.preventDefault();
    const noteName = target.getAttribute("data-note");
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
    class="prose prose-invert max-w-none h-full w-full p-8 overflow-auto text-left bg-neutral-900 text-neutral-200"
  ></div>
</template>
