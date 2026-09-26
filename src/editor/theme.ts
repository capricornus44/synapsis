import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// All colours come from CSS variables defined in style.css, so a single
// theme covers both light and dark mode and follows the accent colour.
const editorTheme = EditorView.theme({
  "&": {
    color: "var(--editor-fg)",
    backgroundColor: "var(--editor-bg)",
  },
  ".cm-content": {
    caretColor: "var(--color-accent)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--color-accent)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    {
      backgroundColor: "var(--editor-selection)",
    },
  ".cm-activeLine": {
    backgroundColor: "var(--editor-active-line)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--editor-bg)",
    color: "var(--editor-muted)",
    border: "none",
  },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "var(--editor-selection)",
    outline: "none",
  },
});

const highlightStyle = HighlightStyle.define([
  { tag: t.heading, color: "var(--editor-heading)", fontWeight: "700" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.url], color: "var(--color-accent)" },
  { tag: t.monospace, color: "var(--editor-code)" },
  { tag: t.quote, color: "var(--editor-muted)", fontStyle: "italic" },
  {
    tag: [t.processingInstruction, t.meta, t.contentSeparator, t.labelName],
    color: "var(--editor-muted)",
  },
  { tag: t.list, color: "var(--editor-fg)" },
  { tag: t.comment, color: "var(--editor-muted)" },
]);

export const synapsisEditorTheme = [
  editorTheme,
  syntaxHighlighting(highlightStyle),
];
