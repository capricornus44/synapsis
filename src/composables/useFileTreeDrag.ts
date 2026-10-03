import { computed, ref } from "vue";
import type { NoteInfo } from "./useVault";

export const TREE_ROOT_DROP = "__vault_root__";

export type DropTarget =
  | { type: "tree"; path: string }
  | { type: "tab-zone"; paneId: string; insertIndex: number }
  | { type: "file-name-zone"; paneId: string }
  | null;

const dragSource = ref<NoteInfo | null>(null);
const dropTarget = ref<DropTarget>(null);
const dropTargetPath = computed(() =>
  dropTarget.value?.type === "tree" ? dropTarget.value.path : null,
);
const dragPosition = ref<{ x: number; y: number } | null>(null);
const isDragging = computed(() => dragSource.value !== null);

const DRAG_THRESHOLD_PX = 6;

type PointerSession = {
  item: NoteInfo;
  startX: number;
  startY: number;
  active: boolean;
  pointerId: number;
};

let session: PointerSession | null = null;
let suppressNextClick = false;

const preventDefaultHandler = (e: Event) => {
  e.preventDefault();
};

const clearTextSelection = () => {
  try {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      sel.removeAllRanges();
    }
  } catch {}
};

const resetDrag = () => {
  dragSource.value = null;
  dropTarget.value = null;
  dragPosition.value = null;
  session = null;
  document.documentElement.classList.remove("is-tree-dragging");
  document.body.classList.remove("is-tree-dragging");
  document.body.style.removeProperty("cursor");
  document.body.style.removeProperty("user-select");
  document.body.style.removeProperty("-webkit-user-select");
  window.removeEventListener("selectstart", preventDefaultHandler, {
    capture: true,
  });
  window.removeEventListener("dragstart", preventDefaultHandler, {
    capture: true,
  });
  clearTextSelection();
};

const isInvalidFolderTarget = (source: NoteInfo, targetPath: string) => {
  if (targetPath === TREE_ROOT_DROP) return false;
  if (source.path === targetPath) return true;
  if (
    source.is_dir &&
    (targetPath.startsWith(`${source.path}/`) ||
      targetPath.startsWith(`${source.path}\\`))
  ) {
    return true;
  }
  return false;
};

const resolveDropTarget = (
  clientX: number,
  clientY: number,
  source: NoteInfo,
): DropTarget => {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;

  // 1. If it's a note (not a directory), check workspace pane drop zones
  if (!source.is_dir) {
    // Check file name zone (header / breadcrumbs)
    const headerZone = el.closest<HTMLElement>(
      '[data-drop-zone="file-name-zone"]',
    );
    if (headerZone?.dataset.paneId) {
      return {
        type: "file-name-zone",
        paneId: headerZone.dataset.paneId,
      };
    }

    // Check tab zone (tab bar)
    const tabZone = el.closest<HTMLElement>('[data-drop-zone="tab-zone"]');
    if (tabZone?.dataset.paneId) {
      const paneId = tabZone.dataset.paneId;
      const tabElements = Array.from(
        tabZone.querySelectorAll<HTMLElement>("[data-tab-index]"),
      );

      if (tabElements.length === 0) {
        return { type: "tab-zone", paneId, insertIndex: 0 };
      }

      // Check if dropped directly on a tab element
      const currentTab = el.closest<HTMLElement>("[data-tab-index]");
      if (currentTab?.dataset.tabIndex !== undefined) {
        const idx = parseInt(currentTab.dataset.tabIndex, 10);
        const rect = currentTab.getBoundingClientRect();
        const insertIndex =
          clientX < rect.left + rect.width / 2 ? idx : idx + 1;
        return { type: "tab-zone", paneId, insertIndex };
      }

      // If hovering empty space to the right or left of tabs
      const firstRect = tabElements[0].getBoundingClientRect();
      const lastRect =
        tabElements[tabElements.length - 1].getBoundingClientRect();

      if (clientX < firstRect.left) {
        return { type: "tab-zone", paneId, insertIndex: 0 };
      }
      if (clientX >= lastRect.right) {
        return { type: "tab-zone", paneId, insertIndex: tabElements.length };
      }

      for (let i = 0; i < tabElements.length; i++) {
        const rect = tabElements[i].getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          const insertIndex = clientX < rect.left + rect.width / 2 ? i : i + 1;
          return { type: "tab-zone", paneId, insertIndex };
        }
      }

      return { type: "tab-zone", paneId, insertIndex: tabElements.length };
    }
  }

  // 2. Tree drop targets (folder / parent folder / root)
  const folder = el.closest<HTMLElement>("[data-tree-drop-folder]");
  if (folder?.dataset.treeDropFolder) {
    const targetPath = folder.dataset.treeDropFolder;
    if (!isInvalidFolderTarget(source, targetPath)) {
      return { type: "tree", path: targetPath };
    }
    return null;
  }

  const file = el.closest<HTMLElement>("[data-tree-drop-parent]");
  if (file?.dataset.treeDropParent) {
    const targetPath = file.dataset.treeDropParent;
    if (!isInvalidFolderTarget(source, targetPath)) {
      return { type: "tree", path: targetPath };
    }
    return null;
  }

  if (el.closest("[data-tree-drop-root]")) {
    return { type: "tree", path: TREE_ROOT_DROP };
  }

  return null;
};

const onPointerMove = (e: PointerEvent) => {
  if (!session || e.pointerId !== session.pointerId) return;

  const dx = e.clientX - session.startX;
  const dy = e.clientY - session.startY;

  if (!session.active) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    session.active = true;
    suppressNextClick = true;
    dragSource.value = session.item;
    document.documentElement.classList.add("is-tree-dragging");
    document.body.classList.add("is-tree-dragging");
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";
    clearTextSelection();
  }

  if (session.active) {
    e.preventDefault();
    clearTextSelection();
  }

  dragPosition.value = { x: e.clientX, y: e.clientY };
  dropTarget.value = resolveDropTarget(e.clientX, e.clientY, session.item);
};

const onPointerUp = (e: PointerEvent) => {
  if (!session || e.pointerId !== session.pointerId) return;

  const source = session.item;
  const wasActive = session.active;
  let target: DropTarget = null;

  if (wasActive) {
    target = resolveDropTarget(e.clientX, e.clientY, source);
  }

  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);

  resetDrag();

  if (wasActive && target) {
    if (target.type === "tree") {
      window.dispatchEvent(
        new CustomEvent("tree-drag-drop", {
          detail: { source, targetPath: target.path },
        }),
      );
    } else if (target.type === "tab-zone") {
      window.dispatchEvent(
        new CustomEvent("tab-zone-drop", {
          detail: {
            source,
            paneId: target.paneId,
            insertIndex: target.insertIndex,
          },
        }),
      );
    } else if (target.type === "file-name-zone") {
      window.dispatchEvent(
        new CustomEvent("file-name-zone-drop", {
          detail: {
            source,
            paneId: target.paneId,
          },
        }),
      );
    }
  }
};

export function beginTreeDrag(
  item: NoteInfo,
  e: PointerEvent,
  disabled = false,
) {
  if (disabled || e.button !== 0) return;
  if ((e.target as HTMLElement | null)?.closest("input")) return;

  session = {
    item,
    startX: e.clientX,
    startY: e.clientY,
    active: false,
    pointerId: e.pointerId,
  };

  window.addEventListener("selectstart", preventDefaultHandler, {
    capture: true,
  });
  window.addEventListener("dragstart", preventDefaultHandler, {
    capture: true,
  });
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

export function consumeTreeDragClickSuppression() {
  if (!suppressNextClick) return false;
  suppressNextClick = false;
  return true;
}

export function useFileTreeDrag() {
  return {
    dragSource,
    dropTarget,
    dropTargetPath,
    dragPosition,
    isDragging,
    TREE_ROOT_DROP,
  };
}
