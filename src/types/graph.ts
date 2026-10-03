import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";

export interface GraphNode {
  id: string;
  title: string;
  path: string | null;
  folder: string;
  is_existing: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SimNode extends GraphNode, SimulationNodeDatum {
  inDegree: number;
  outDegree: number;
  degree: number;
  radius: number;
  color?: string;
}

export interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode;
  target: SimNode;
}

export type LabelDisplayMode = "all" | "hover" | "zoom";

export interface GraphSettings {
  showOrphans: boolean;
  showUnresolved: boolean;
  showArrows: boolean;
  labelMode: LabelDisplayMode;
  colorByFolder: boolean;
  chargeStrength: number;
  linkDistance: number;
  centerStrength: number;
  nodeScale: number;
}

export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  showOrphans: true,
  showUnresolved: true,
  showArrows: true,
  labelMode: "all",
  colorByFolder: true,
  chargeStrength: -200,
  linkDistance: 80,
  centerStrength: 0.06,
  nodeScale: 1.0,
};
