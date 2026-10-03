import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const TASK_LINE_RE = /^(\s*)((?:[-*+]|\d+[.)])\s+)\[([ xX])\]/;

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }

  toDOM() {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.className = "cm-task-checkbox";
    input.tabIndex = -1;
    input.setAttribute("aria-label", "Toggle checklist item");
    return input;
  }

  ignoreEvent() {
    return false;
  }
}

function buildCheckboxDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const match = line.text.match(TASK_LINE_RE);
      if (match) {
        const start = line.from + match[1].length;
        const end = start + match[2].length + 3; // hide marker + replace "[ ]" / "[x]"
        const checked = match[3].trim() !== "";
        builder.add(
          start,
          end,
          Decoration.replace({
            widget: new CheckboxWidget(checked),
          }),
        );
      }
      pos = line.to + 1;
    }
  }

  return builder.finish();
}

function toggleCheckboxAt(view: EditorView, pos: number) {
  const line = view.state.doc.lineAt(pos);
  const match = line.text.match(TASK_LINE_RE);
  if (!match) return false;

  const checkCharFrom = line.from + match[1].length + match[2].length + 1; // char inside brackets
  const current = match[3];
  const next = current.trim() === "" ? "x" : " ";

  view.dispatch({
    changes: { from: checkCharFrom, to: checkCharFrom + 1, insert: next },
  });
  return true;
}

export const taskCheckboxes = [
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildCheckboxDecorations(view);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildCheckboxDecorations(update.view);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      eventHandlers: {
        mousedown(event, view) {
          const target = event.target;
          if (
            !(target instanceof HTMLInputElement) ||
            target.type !== "checkbox" ||
            !target.classList.contains("cm-task-checkbox")
          ) {
            return false;
          }

          event.preventDefault();
          const pos = view.posAtDOM(target);
          return toggleCheckboxAt(view, pos);
        },
      },
    },
  ),
  EditorView.baseTheme({
    ".cm-task-checkbox": {
      appearance: "none",
      "-webkit-appearance": "none",
      width: "1.05em",
      height: "1.05em",
      margin: "0 0.35em 0 0.1em",
      "vertical-align": "-0.15em",
      "flex-shrink": "0",
      border: "2px solid #cbd5e1",
      "border-radius": "0.3em",
      "background-color": "#f1f5f9",
      cursor: "pointer",
      position: "relative",
      top: "0.05em",
    },
    ".cm-task-checkbox:hover": {
      "border-color": "var(--color-accent)",
      transform: "scale(1.08)",
    },
    ".cm-task-checkbox:checked": {
      "background-color": "var(--color-accent)",
      "border-color": "var(--color-accent)",
      "background-image":
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='2.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='3.5 8.5 6.5 11.5 12.5 4.5'/%3E%3C/svg%3E\")",
      "background-repeat": "no-repeat",
      "background-position": "center",
      "background-size": "68%",
    },
  }),
];
