<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import type {
  GraphData,
  SimNode,
  SimLink,
  GraphSettings,
  LabelDisplayMode,
} from "../types/graph";
import { DEFAULT_GRAPH_SETTINGS } from "../types/graph";
import {
  Search as SearchIcon,
  SlidersHorizontal as SlidersIcon,
  Maximize2 as MaximizeIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RotateCcw as ResetIcon,
  X as CloseIcon,
  Share2 as GraphIcon,
  Folder as FolderIcon,
} from "@lucide/vue";

const props = defineProps<{
  isOpen: boolean;
  graphData: GraphData;
  activeNoteName?: string;
  accentColor?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (
    e: "open-note",
    noteName: string,
    path: string | null,
    newTab: boolean,
  ): void;
  (e: "refresh"): void;
}>();

const STORAGE_SETTINGS_KEY = "synapsis:graph_settings";

// Settings state
const settings = ref<GraphSettings>({ ...DEFAULT_GRAPH_SETTINGS });

const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
    if (saved) {
      settings.value = { ...DEFAULT_GRAPH_SETTINGS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to load graph settings", e);
  }
};

const saveSettings = () => {
  try {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings.value));
  } catch (e) {
    console.error("Failed to save graph settings", e);
  }
};

const resetSettings = () => {
  settings.value = { ...DEFAULT_GRAPH_SETTINGS };
  saveSettings();
  rebuildGraph();
};

// UI state
const searchQuery = ref("");
const isControlsOpen = ref(true);
const activeTab = ref<"filters" | "forces">("filters");

// Canvas and Simulation
const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

let simulation: Simulation<SimNode, SimLink> | null = null;
let animationFrameId: number | null = null;

// Camera state (Pan & Zoom)
const panX = ref(0);
const panY = ref(0);
const zoom = ref(1);

// Interaction state
const hoveredNode = ref<SimNode | null>(null);
const tooltipPos = ref({ x: 0, y: 0 });
const isDraggingCanvas = ref(false);
const isDraggingNode = ref(false);
const draggedNode = ref<SimNode | null>(null);
let dragStartMouse = { x: 0, y: 0 };
let dragStartPan = { x: 0, y: 0 };
let hasDraggedSignificant = false;

// Graph data caches
const processedNodes = ref<SimNode[]>([]);
const processedLinks = ref<SimLink[]>([]);
const connectedNodeIds = computed(() => {
  if (!hoveredNode.value) return new Set<string>();
  const set = new Set<string>();
  set.add(hoveredNode.value.id);
  processedLinks.value.forEach((link) => {
    const sourceId =
      typeof link.source === "object" ? link.source.id : link.source;
    const targetId =
      typeof link.target === "object" ? link.target.id : link.target;
    if (sourceId === hoveredNode.value?.id) {
      set.add(targetId);
    } else if (targetId === hoveredNode.value?.id) {
      set.add(sourceId);
    }
  });
  return set;
});

// Search highlight set
const searchMatchedNodeIds = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return null;
  const matches = new Set<string>();
  processedNodes.value.forEach((node) => {
    if (
      node.title.toLowerCase().includes(q) ||
      node.folder.toLowerCase().includes(q)
    ) {
      matches.add(node.id);
    }
  });
  return matches;
});

// Vibrant Harmonious Palette for Folders
const FOLDER_PALETTE = [
  "#38bdf8", // Sky
  "#818cf8", // Indigo
  "#a78bfa", // Purple
  "#c084fc", // Fuchsia
  "#f472b6", // Pink
  "#fb7185", // Rose
  "#fb923c", // Orange
  "#fbbf24", // Amber
  "#34d399", // Emerald
  "#2dd4bf", // Teal
  "#22d3ee", // Cyan
  "#a3e635", // Lime
  "#4ade80", // Green
  "#94a3b8", // Slate
];

const folderColorMap = new Map<string, string>();

const getFolderColor = (folder: string): string => {
  if (!folder) return props.accentColor || "#6366f1";
  if (!folderColorMap.has(folder)) {
    let hash = 0;
    for (let i = 0; i < folder.length; i++) {
      hash = (hash << 5) - hash + folder.charCodeAt(i);
      hash |= 0;
    }
    const colorIndex = Math.abs(hash) % FOLDER_PALETTE.length;
    folderColorMap.set(folder, FOLDER_PALETTE[colorIndex]);
  }
  return folderColorMap.get(folder)!;
};

// Compute Node Colors & Sizes
const computeNodeVisuals = (node: SimNode) => {
  if (!node.is_existing) {
    node.color = "#94a3b8"; // Muted for phantom/unresolved
  } else if (settings.value.colorByFolder && node.folder) {
    node.color = getFolderColor(node.folder);
  } else {
    node.color = props.accentColor || "#6366f1";
  }

  // Base radius scaled by connections degree
  const baseR = 4.5;
  const scaleR = Math.sqrt(node.degree) * 2.2;
  node.radius = Math.max(
    4,
    Math.min(22, (baseR + scaleR) * settings.value.nodeScale),
  );
};

// Rebuild and Run Simulation
const rebuildGraph = () => {
  if (!props.isOpen || !props.graphData) return;

  const rawNodes = props.graphData.nodes || [];
  const rawEdges = props.graphData.edges || [];

  // Calculate degrees & map
  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();

  rawEdges.forEach((edge) => {
    outDegreeMap.set(edge.source, (outDegreeMap.get(edge.source) || 0) + 1);
    inDegreeMap.set(edge.target, (inDegreeMap.get(edge.target) || 0) + 1);
  });

  // Filter nodes according to settings
  const filteredNodes: SimNode[] = [];
  const nodeMap = new Map<string, SimNode>();

  // Preserve existing node positions if re-filtering
  const oldPosMap = new Map<
    string,
    { x?: number; y?: number; vx?: number; vy?: number }
  >();
  processedNodes.value.forEach((n) => {
    oldPosMap.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy });
  });

  rawNodes.forEach((node) => {
    const inDeg = inDegreeMap.get(node.id) || 0;
    const outDeg = outDegreeMap.get(node.id) || 0;
    const degree = inDeg + outDeg;

    if (!settings.value.showUnresolved && !node.is_existing) {
      return;
    }
    if (!settings.value.showOrphans && degree === 0) {
      return;
    }

    const old = oldPosMap.get(node.id);
    const simNode: SimNode = {
      ...node,
      inDegree: inDeg,
      outDegree: outDeg,
      degree,
      radius: 5,
      x: old?.x ?? (Math.random() - 0.5) * 400,
      y: old?.y ?? (Math.random() - 0.5) * 400,
      vx: old?.vx,
      vy: old?.vy,
    };

    computeNodeVisuals(simNode);
    filteredNodes.push(simNode);
    nodeMap.set(node.id, simNode);
  });

  // Filter edges (both source and target must exist in filtered nodes)
  const filteredLinks: SimLink[] = [];
  rawEdges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (sourceNode && targetNode) {
      filteredLinks.push({
        source: sourceNode,
        target: targetNode,
      });
    }
  });

  processedNodes.value = filteredNodes;
  processedLinks.value = filteredLinks;

  startSimulation();
};

const startSimulation = () => {
  if (simulation) {
    simulation.stop();
  }

  const nodes = processedNodes.value;
  const links = processedLinks.value;

  simulation = forceSimulation<SimNode>(nodes)
    .force(
      "charge",
      forceManyBody<SimNode>().strength(settings.value.chargeStrength),
    )
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(settings.value.linkDistance)
        .strength(0.7),
    )
    .force(
      "collide",
      forceCollide<SimNode>()
        .radius((d) => d.radius + 6)
        .iterations(2),
    )
    .force("center", forceCenter(0, 0).strength(settings.value.centerStrength))
    .force("x", forceX(0).strength(0.04))
    .force("y", forceY(0).strength(0.04))
    .alpha(0.8)
    .alphaDecay(0.028)
    .on("tick", () => {
      // canvas will be drawn on animation frame
    });
};

const restartPhysics = () => {
  if (simulation) {
    simulation.alpha(1).restart();
  }
};

// Canvas drawing loop
const isDarkTheme = ref(true);

const checkTheme = () => {
  isDarkTheme.value = document.documentElement.classList.contains("dark");
};

const renderCanvas = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const dpr = window.devicePixelRatio || 1;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Background grid pattern / subtle ambiance
  const isDark = isDarkTheme.value;
  const bgColor = isDark ? "#0f1117" : "#f8fafc";
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Center coordinate transformation with Pan & Zoom
  const originX = width / (2 * dpr) + panX.value;
  const originY = height / (2 * dpr) + panY.value;
  const currentZoom = zoom.value;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.translate(originX, originY);
  ctx.scale(currentZoom, currentZoom);

  const hovered = hoveredNode.value;
  const searchMatches = searchMatchedNodeIds.value;
  const connectedIds = connectedNodeIds.value;

  const hasFocus = hovered !== null || searchMatches !== null;

  // 1. Draw Links / Edges
  processedLinks.value.forEach((link) => {
    const source = link.source as SimNode;
    const target = link.target as SimNode;
    if (
      source.x === undefined ||
      source.y === undefined ||
      target.x === undefined ||
      target.y === undefined
    ) {
      return;
    }

    const isConnectedToHover =
      hovered && (source.id === hovered.id || target.id === hovered.id);

    let alpha = isDark ? 0.18 : 0.22;
    let strokeColor = isDark ? "#64748b" : "#94a3b8";
    let lineWidth = 1.0;

    if (hasFocus) {
      if (isConnectedToHover) {
        alpha = 0.9;
        strokeColor = props.accentColor || "#6366f1";
        lineWidth = 2.0;
      } else {
        alpha = 0.04;
      }
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();

    // Draw Arrowhead if enabled
    if (settings.value.showArrows) {
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.hypot(dx, dy);
      if (dist > target.radius + 6) {
        const arrowDist = target.radius + 3;
        const arrowX = target.x - (dx / dist) * arrowDist;
        const arrowY = target.y - (dy / dist) * arrowDist;
        const angle = Math.atan2(dy, dx);
        const arrowLength = 5;

        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
          arrowY - arrowLength * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
          arrowY - arrowLength * Math.sin(angle + Math.PI / 6),
        );
        ctx.closePath();
        ctx.fillStyle = strokeColor;
        ctx.fill();
      }
    }
    ctx.restore();
  });

  // 2. Draw Nodes
  processedNodes.value.forEach((node) => {
    if (node.x === undefined || node.y === undefined) return;

    const isHovered = hovered?.id === node.id;
    const isNeighbor = hovered && connectedIds.has(node.id);
    const isSearchMatch = searchMatches && searchMatches.has(node.id);
    const isActiveNote =
      props.activeNoteName &&
      props.activeNoteName.toLowerCase() === node.title.toLowerCase();

    let alpha = 1.0;
    if (hasFocus) {
      if (isHovered || isNeighbor || isSearchMatch) {
        alpha = 1.0;
      } else {
        alpha = 0.12;
      }
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    const r = node.radius;

    // Glowing halo for active note / hovered note / search match
    if (isActiveNote || isHovered || isSearchMatch) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4.5, 0, Math.PI * 2);
      ctx.fillStyle = (props.accentColor || "#6366f1") + "33";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = props.accentColor || "#6366f1";
      ctx.stroke();
    }

    // Node body
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

    if (node.is_existing) {
      ctx.fillStyle = node.color || props.accentColor || "#6366f1";
      ctx.fill();
    } else {
      // Hollow / dashed for unresolved
      ctx.fillStyle = isDark ? "#1e293b" : "#e2e8f0";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = "#94a3b8";
      ctx.stroke();
    }

    // Border highlight
    if (isHovered) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }

    ctx.restore();
  });

  // 3. Draw Labels
  const labelMode = settings.value.labelMode;
  ctx.font =
    '500 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  processedNodes.value.forEach((node) => {
    if (node.x === undefined || node.y === undefined) return;

    const isHovered = hovered?.id === node.id;
    const isNeighbor = hovered && connectedIds.has(node.id);
    const isSearchMatch = searchMatches && searchMatches.has(node.id);
    const isActiveNote =
      props.activeNoteName &&
      props.activeNoteName.toLowerCase() === node.title.toLowerCase();

    // Determine whether to show label
    let shouldShowLabel = false;
    if (isHovered || isNeighbor || isSearchMatch || isActiveNote) {
      shouldShowLabel = true;
    } else if (labelMode === "all") {
      shouldShowLabel = true;
    } else if (labelMode === "zoom") {
      shouldShowLabel = currentZoom >= 0.8 || node.degree >= 3;
    }

    if (!shouldShowLabel) return;

    let alpha = 0.85;
    if (hasFocus) {
      if (isHovered || isNeighbor || isSearchMatch || isActiveNote) {
        alpha = 1.0;
      } else {
        alpha = 0.12;
      }
    }

    ctx.save();
    ctx.globalAlpha = alpha;

    const textY = node.y + node.radius + 3;

    // Crisp text halo background for legibility
    ctx.lineWidth = 3;
    ctx.strokeStyle = isDark
      ? "rgba(15, 17, 23, 0.85)"
      : "rgba(248, 250, 252, 0.85)";
    ctx.strokeText(node.title, node.x, textY);

    ctx.fillStyle = isDark
      ? isHovered
        ? "#ffffff"
        : "#cbd5e1"
      : isHovered
        ? "#000000"
        : "#334155";
    if (!node.is_existing) {
      ctx.fillStyle = "#94a3b8";
    }
    ctx.fillText(node.title, node.x, textY);

    ctx.restore();
  });

  ctx.restore();
  ctx.restore();
};

const tickRender = () => {
  renderCanvas();
  animationFrameId = requestAnimationFrame(tickRender);
};

// Canvas Resize
const resizeCanvas = () => {
  const canvas = canvasRef.value;
  const container = containerRef.value;
  if (!canvas || !container) return;

  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  renderCanvas();
};

// Center & Fit view
const fitView = () => {
  const container = containerRef.value;
  if (!container || processedNodes.value.length === 0) {
    panX.value = 0;
    panY.value = 0;
    zoom.value = 1;
    return;
  }

  const rect = container.getBoundingClientRect();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  processedNodes.value.forEach((node) => {
    if (node.x !== undefined && node.y !== undefined) {
      minX = Math.min(minX, node.x - node.radius);
      maxX = Math.max(maxX, node.x + node.radius);
      minY = Math.min(minY, node.y - node.radius);
      maxY = Math.max(maxY, node.y + node.radius);
    }
  });

  if (minX === Infinity) {
    panX.value = 0;
    panY.value = 0;
    zoom.value = 1;
    return;
  }

  const graphWidth = maxX - minX + 100;
  const graphHeight = maxY - minY + 100;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const scaleX = rect.width / graphWidth;
  const scaleY = rect.height / graphHeight;
  const targetZoom = Math.max(
    0.25,
    Math.min(1.8, Math.min(scaleX, scaleY) * 0.85),
  );

  panX.value = -centerX * targetZoom;
  panY.value = -centerY * targetZoom;
  zoom.value = targetZoom;
};

// Coordinate helpers
const screenToWorld = (screenX: number, screenY: number) => {
  const container = containerRef.value;
  if (!container) return { x: 0, y: 0 };
  const rect = container.getBoundingClientRect();
  const mouseX = screenX - rect.left;
  const mouseY = screenY - rect.top;

  const originX = rect.width / 2 + panX.value;
  const originY = rect.height / 2 + panY.value;

  return {
    x: (mouseX - originX) / zoom.value,
    y: (mouseY - originY) / zoom.value,
  };
};

const findNodeAt = (worldX: number, worldY: number): SimNode | null => {
  for (let i = processedNodes.value.length - 1; i >= 0; i--) {
    const node = processedNodes.value[i];
    if (node.x !== undefined && node.y !== undefined) {
      const dist = Math.hypot(worldX - node.x, worldY - node.y);
      if (dist <= node.radius + 5) {
        return node;
      }
    }
  }
  return null;
};

// Mouse / Wheel Event Handlers
const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const container = containerRef.value;
  if (!container) return;

  const rect = container.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const originX = rect.width / 2 + panX.value;
  const originY = rect.height / 2 + panY.value;

  const worldX = (mouseX - originX) / zoom.value;
  const worldY = (mouseY - originY) / zoom.value;

  const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
  const newZoom = Math.max(0.1, Math.min(4.0, zoom.value * zoomFactor));

  // Keep mouse cursor point stable during zoom
  panX.value = mouseX - rect.width / 2 - worldX * newZoom;
  panY.value = mouseY - rect.height / 2 - worldY * newZoom;
  zoom.value = newZoom;
};

const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return; // Primary button only

  const world = screenToWorld(e.clientX, e.clientY);
  const clickedNode = findNodeAt(world.x, world.y);

  dragStartMouse = { x: e.clientX, y: e.clientY };
  hasDraggedSignificant = false;

  if (clickedNode) {
    isDraggingNode.value = true;
    draggedNode.value = clickedNode;
    clickedNode.fx = clickedNode.x;
    clickedNode.fy = clickedNode.y;
    if (simulation) {
      simulation.alphaTarget(0.3).restart();
    }
  } else {
    isDraggingCanvas.value = true;
    dragStartPan = { x: panX.value, y: panY.value };
  }
};

const handleMouseMove = (e: MouseEvent) => {
  const container = containerRef.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();

  tooltipPos.value = {
    x: e.clientX - rect.left + 14,
    y: e.clientY - rect.top + 14,
  };

  const deltaDist = Math.hypot(
    e.clientX - dragStartMouse.x,
    e.clientY - dragStartMouse.y,
  );
  if (deltaDist > 4) {
    hasDraggedSignificant = true;
  }

  if (isDraggingNode.value && draggedNode.value) {
    const world = screenToWorld(e.clientX, e.clientY);
    draggedNode.value.fx = world.x;
    draggedNode.value.fy = world.y;
    return;
  }

  if (isDraggingCanvas.value) {
    panX.value = dragStartPan.x + (e.clientX - dragStartMouse.x);
    panY.value = dragStartPan.y + (e.clientY - dragStartMouse.y);
    return;
  }

  // Hover detection
  const world = screenToWorld(e.clientX, e.clientY);
  const node = findNodeAt(world.x, world.y);
  hoveredNode.value = node;
};

const handleMouseUp = (e: MouseEvent) => {
  if (isDraggingNode.value && draggedNode.value) {
    if (!hasDraggedSignificant) {
      // Clicked on node!
      const isNewTab = e.metaKey || e.ctrlKey;
      emit(
        "open-note",
        draggedNode.value.title,
        draggedNode.value.path,
        isNewTab,
      );
    }
    draggedNode.value.fx = null;
    draggedNode.value.fy = null;
    if (simulation) {
      simulation.alphaTarget(0);
    }
    isDraggingNode.value = false;
    draggedNode.value = null;
  }

  isDraggingCanvas.value = false;
};

const handleDoubleClick = (e: MouseEvent) => {
  const world = screenToWorld(e.clientX, e.clientY);
  const node = findNodeAt(world.x, world.y);
  if (node) {
    emit("open-note", node.title, node.path, false);
  } else {
    fitView();
  }
};

// Zoom button controls
const zoomIn = () => {
  zoom.value = Math.min(4.0, zoom.value * 1.25);
};

const zoomOut = () => {
  zoom.value = Math.max(0.1, zoom.value / 1.25);
};

// Watchers
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      checkTheme();
      loadSettings();
      nextTick(() => {
        resizeCanvas();
        rebuildGraph();
        setTimeout(fitView, 100);
        if (!animationFrameId) {
          tickRender();
        }
      });
    } else {
      if (simulation) {
        simulation.stop();
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
  },
  { immediate: true },
);

watch(
  () => props.graphData,
  () => {
    if (props.isOpen) {
      rebuildGraph();
    }
  },
  { deep: true },
);

watch(
  settings,
  () => {
    saveSettings();
    if (props.isOpen) {
      rebuildGraph();
    }
  },
  { deep: true },
);

const handleKeydown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;
  if (e.key === "Escape") {
    emit("close");
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", resizeCanvas);
  checkTheme();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("resize", resizeCanvas);
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  if (simulation) {
    simulation.stop();
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-98"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-98"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex flex-col bg-neutral-950/80 backdrop-blur-md select-none overflow-hidden"
      >
        <!-- Top Toolbar Header -->
        <header
          class="h-13 px-4 border-b border-neutral-200/20 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md flex items-center justify-between z-10 shrink-0 transition-colors"
        >
          <!-- Left: Title & Stats -->
          <div class="flex items-center gap-3">
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center font-bold"
              :style="{
                backgroundColor: (accentColor || '#6366f1') + '20',
                color: accentColor || '#6366f1',
              }"
            >
              <GraphIcon class="w-4 h-4" />
            </div>
            <div class="flex items-center gap-2">
              <h2
                class="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
              >
                Graph View
              </h2>
              <span
                class="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
              >
                {{ processedNodes.length }} notes ·
                {{ processedLinks.length }} links
              </span>
            </div>
          </div>

          <!-- Middle: Quick Search -->
          <div class="relative w-64 max-w-sm">
            <SearchIcon
              class="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search notes..."
              class="w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white text-xs rounded-lg pl-8 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent transition-all placeholder:text-neutral-400"
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5"
            >
              <CloseIcon class="w-3 h-3" />
            </button>
          </div>

          <!-- Right: Action Controls -->
          <div class="flex items-center gap-1">
            <button
              @click="zoomIn"
              title="Zoom In (+)"
              class="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
            >
              <ZoomInIcon class="w-4 h-4" />
            </button>
            <button
              @click="zoomOut"
              title="Zoom Out (-)"
              class="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
            >
              <ZoomOutIcon class="w-4 h-4" />
            </button>
            <button
              @click="fitView"
              title="Fit to Screen"
              class="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
            >
              <MaximizeIcon class="w-4 h-4" />
            </button>
            <button
              @click="restartPhysics"
              title="Restart Physics Simulation"
              class="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
            >
              <ResetIcon class="w-4 h-4" />
            </button>

            <div class="h-4 w-px bg-neutral-200 dark:bg-neutral-800 mx-1"></div>

            <button
              @click="isControlsOpen = !isControlsOpen"
              :title="isControlsOpen ? 'Hide Filters' : 'Show Filters'"
              :class="[
                'p-1.5 rounded-md transition-colors cursor-pointer',
                isControlsOpen
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                  : 'hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400',
              ]"
            >
              <SlidersIcon class="w-4 h-4" />
            </button>

            <button
              @click="emit('close')"
              title="Close Graph (Esc)"
              class="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer ml-1"
            >
              <CloseIcon class="w-4 h-4" />
            </button>
          </div>
        </header>

        <!-- Main Interactive Graph Area -->
        <div
          ref="containerRef"
          class="relative flex-1 w-full h-full overflow-hidden"
          :class="[
            isDraggingCanvas
              ? 'cursor-grabbing'
              : isDraggingNode
                ? 'cursor-grabbing'
                : hoveredNode
                  ? 'cursor-pointer'
                  : 'cursor-grab',
          ]"
          @wheel="handleWheel"
          @mousedown="handleMouseDown"
          @mousemove="handleMouseMove"
          @mouseup="handleMouseUp"
          @dblclick="handleDoubleClick"
        >
          <canvas ref="canvasRef" class="block w-full h-full"></canvas>

          <!-- Floating Obsidian-Style Settings Drawer -->
          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 -translate-x-4"
            enter-to-class="opacity-100 translate-x-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-x-0"
            leave-to-class="opacity-0 -translate-x-4"
          >
            <div
              v-if="isControlsOpen"
              class="absolute top-4 left-4 z-20 w-72 max-h-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-2xl p-4 text-neutral-900 dark:text-neutral-100 space-y-4"
              @mousedown.stop
              @wheel.stop
            >
              <!-- Drawer Header / Tabs -->
              <div
                class="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2"
              >
                <div class="flex gap-1">
                  <button
                    @click="activeTab = 'filters'"
                    :class="[
                      'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer',
                      activeTab === 'filters'
                        ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300',
                    ]"
                  >
                    Filters & View
                  </button>
                  <button
                    @click="activeTab = 'forces'"
                    :class="[
                      'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer',
                      activeTab === 'forces'
                        ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300',
                    ]"
                  >
                    Forces
                  </button>
                </div>

                <button
                  @click="resetSettings"
                  title="Reset to defaults"
                  class="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 rounded-md transition-colors"
                >
                  <ResetIcon class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- Tab: Filters & Display -->
              <div v-if="activeTab === 'filters'" class="space-y-3.5 text-xs">
                <!-- Toggle: Orphans -->
                <label
                  class="flex items-center justify-between cursor-pointer group"
                >
                  <span
                    class="text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white"
                  >
                    Show orphan notes
                  </span>
                  <input
                    v-model="settings.showOrphans"
                    type="checkbox"
                    :style="{
                      accentColor: accentColor || 'var(--color-accent)',
                    }"
                    class="w-4 h-4 rounded cursor-pointer transition-colors"
                  />
                </label>

                <!-- Toggle: Unresolved links -->
                <label
                  class="flex items-center justify-between cursor-pointer group"
                >
                  <span
                    class="text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white"
                  >
                    Show unresolved notes
                  </span>
                  <input
                    v-model="settings.showUnresolved"
                    type="checkbox"
                    :style="{
                      accentColor: accentColor || 'var(--color-accent)',
                    }"
                    class="w-4 h-4 rounded cursor-pointer transition-colors"
                  />
                </label>

                <!-- Toggle: Link Arrows -->
                <label
                  class="flex items-center justify-between cursor-pointer group"
                >
                  <span
                    class="text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white"
                  >
                    Show link arrows
                  </span>
                  <input
                    v-model="settings.showArrows"
                    type="checkbox"
                    :style="{
                      accentColor: accentColor || 'var(--color-accent)',
                    }"
                    class="w-4 h-4 rounded cursor-pointer transition-colors"
                  />
                </label>

                <!-- Toggle: Color by Folder -->
                <label
                  class="flex items-center justify-between cursor-pointer group"
                >
                  <span
                    class="text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white"
                  >
                    Color by folder
                  </span>
                  <input
                    v-model="settings.colorByFolder"
                    type="checkbox"
                    :style="{
                      accentColor: accentColor || 'var(--color-accent)',
                    }"
                    class="w-4 h-4 rounded cursor-pointer transition-colors"
                  />
                </label>

                <!-- Label Display Mode -->
                <div class="space-y-1.5 pt-1">
                  <span
                    class="text-neutral-700 dark:text-neutral-300 font-medium"
                  >
                    Show node labels
                  </span>
                  <div
                    class="grid grid-cols-3 gap-1 bg-neutral-100 dark:bg-neutral-800 p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700"
                  >
                    <button
                      v-for="mode in [
                        'all',
                        'zoom',
                        'hover',
                      ] as LabelDisplayMode[]"
                      :key="mode"
                      @click="settings.labelMode = mode"
                      :class="[
                        'py-1 text-[11px] font-medium rounded-md capitalize transition-colors cursor-pointer',
                        settings.labelMode === mode
                          ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                          : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200',
                      ]"
                    >
                      {{ mode }}
                    </button>
                  </div>
                </div>
              </div>

              <!-- Tab: Forces Physics -->
              <div v-if="activeTab === 'forces'" class="space-y-4 text-xs">
                <!-- Repulsion / Charge Force -->
                <div class="space-y-1">
                  <div
                    class="flex justify-between text-neutral-600 dark:text-neutral-400"
                  >
                    <span>Repulsion (Spacing)</span>
                    <span class="font-mono text-[11px]">{{
                      Math.abs(settings.chargeStrength)
                    }}</span>
                  </div>
                  <input
                    v-model.number="settings.chargeStrength"
                    type="range"
                    min="-800"
                    max="-50"
                    step="25"
                    :style="{
                      accentColor: accentColor || 'var(--color-accent)',
                    }"
                    class="w-full cursor-pointer"
                  />
                </div>

                <!-- Link Distance -->
                <div class="space-y-1">
                  <div
                    class="flex justify-between text-neutral-600 dark:text-neutral-400"
                  >
                    <span>Link distance</span>
                    <span class="font-mono text-[11px]"
                      >{{ settings.linkDistance }}px</span
                    >
                  </div>
                  <input
                    v-model.number="settings.linkDistance"
                    type="range"
                    min="30"
                    max="300"
                    step="10"
                    :style="{
                      accentColor: accentColor || 'var(--color-accent)',
                    }"
                    class="w-full cursor-pointer"
                  />
                </div>

                <!-- Center Force -->
                <div class="space-y-1">
                  <div
                    class="flex justify-between text-neutral-600 dark:text-neutral-400"
                  >
                    <span>Center gravity</span>
                    <span class="font-mono text-[11px]"
                      >{{ (settings.centerStrength * 100).toFixed(0) }}%</span
                    >
                  </div>
                  <input
                    v-model.number="settings.centerStrength"
                    type="range"
                    min="0.01"
                    max="0.3"
                    step="0.01"
                    :style="{
                      accentColor: accentColor || 'var(--color-accent)',
                    }"
                    class="w-full cursor-pointer"
                  />
                </div>

                <!-- Node Scale -->
                <div class="space-y-1">
                  <div
                    class="flex justify-between text-neutral-600 dark:text-neutral-400"
                  >
                    <span>Node size</span>
                    <span class="font-mono text-[11px]"
                      >{{ settings.nodeScale.toFixed(1) }}x</span
                    >
                  </div>
                  <input
                    v-model.number="settings.nodeScale"
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.1"
                    :style="{
                      accentColor: accentColor || 'var(--color-accent)',
                    }"
                    class="w-full cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </Transition>

          <!-- Floating Node Hover Tooltip Card -->
          <div
            v-if="hoveredNode && !isDraggingCanvas && !isDraggingNode"
            class="pointer-events-none fixed z-30 min-w-44 max-w-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-2xl p-3 text-neutral-900 dark:text-neutral-100 transition-all text-xs space-y-1.5"
            :style="{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
            }"
          >
            <div class="flex items-center gap-1.5">
              <div
                class="w-2.5 h-2.5 rounded-full shrink-0"
                :style="{ backgroundColor: hoveredNode.color || accentColor }"
              ></div>
              <span class="font-semibold text-sm truncate">
                {{ hoveredNode.title }}
              </span>
            </div>

            <div
              class="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400"
            >
              <FolderIcon v-if="hoveredNode.folder" class="w-3 h-3 shrink-0" />
              <span class="truncate">
                {{
                  hoveredNode.folder
                    ? hoveredNode.folder
                    : hoveredNode.is_existing
                      ? "Root folder"
                      : "Unresolved note"
                }}
              </span>
            </div>

            <div
              class="pt-1 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-400"
            >
              <span>Links: {{ hoveredNode.degree }}</span>
              <span class="text-[10px] text-neutral-400"
                >({{ hoveredNode.inDegree }} in /
                {{ hoveredNode.outDegree }} out)</span
              >
            </div>

            <div
              class="text-[10px] text-neutral-400 dark:text-neutral-500 italic pt-0.5"
            >
              {{
                hoveredNode.is_existing
                  ? "Click to open · ⌘+Click new tab"
                  : "Click to create note"
              }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
