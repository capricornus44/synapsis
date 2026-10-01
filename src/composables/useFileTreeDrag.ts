import { computed, ref } from "vue";
import type { NoteInfo } from "./useVault";

export const TREE_ROOT_DROP = "__vault_root__";

const dragSource = ref<NoteInfo | null>(null);
const dropTargetPath = ref<string | null>(null);
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

const resetDrag = () => {
  dragSource.value = null;
  dropTargetPath.value = null;
  dragPosition.value = null;
  session = null;
  document.body.style.removeProperty("cursor");
  document.body.style.removeProperty("user-select");
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

const resolveDropPath = (clientX: number, clientY: number): string | null => {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;

  const folder = el.closest<HTMLElement>("[data-tree-drop-folder]");
  if (folder?.dataset.treeDropFolder) {
    return folder.dataset.treeDropFolder;
  }

  const file = el.closest<HTMLElement>("[data-tree-drop-parent]");
  if (file?.dataset.treeDropParent) {
    return file.dataset.treeDropParent;
  }

  if (el.closest("[data-tree-drop-root]")) {
    return TREE_ROOT_DROP;
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
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  }

  dragPosition.value = { x: e.clientX, y: e.clientY };

  const target = resolveDropPath(e.clientX, e.clientY);
  if (target && isInvalidFolderTarget(session.item, target)) {
    dropTargetPath.value = null;
    return;
  }
  dropTargetPath.value = target;
};

const onPointerUp = (e: PointerEvent) => {
  if (!session || e.pointerId !== session.pointerId) return;

  const source = session.item;
  const wasActive = session.active;
  let target: string | null = null;

  if (wasActive) {
    target = resolveDropPath(e.clientX, e.clientY);
    if (target && isInvalidFolderTarget(source, target)) {
      target = null;
    }
  }

  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerUp);

  resetDrag();

  if (wasActive && target) {
    window.dispatchEvent(
      new CustomEvent("tree-drag-drop", {
        detail: { source, targetPath: target },
      }),
    );
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
    dropTargetPath,
    dragPosition,
    isDragging,
    TREE_ROOT_DROP,
  };
}
