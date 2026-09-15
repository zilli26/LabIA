import type { Edge, Node, Viewport } from "@xyflow/react";

export type LabNodeKind =
  | "text-input"
  | "asset-input"
  | "note"
  | "asset-output"
  | "prompt"
  | "image-generation"
  | "video-generation"
  | "video-extend"
  | "video-assembly"
  | "text2video";

export type LabFlowNodeData = {
  kind: LabNodeKind;
  title: string;
  description: string;
  status: "idle" | "ready" | "queued" | "running" | "done" | "failed";
  costLabel?: string;
  extendChainDepth?: number;
  params?: Record<string, unknown>;
};

export type LabFlowNode = Node<LabFlowNodeData, "labNode">;

export type FlowGraph = {
  nodes: LabFlowNode[];
  edges: Edge[];
  viewport?: Viewport;
};

export const starterFlowGraph: FlowGraph = {
  nodes: [
    {
      id: "input-briefing",
      type: "labNode",
      position: { x: 96, y: 120 },
      data: {
        kind: "text-input",
        title: "Briefing",
        description: "Entrada de texto para orientar o fluxo.",
        status: "idle",
      },
    },
    {
      id: "note-context",
      type: "labNode",
      position: { x: 448, y: 80 },
      data: {
        kind: "note",
        title: "Notas de direção",
        description: "Anotações internas para manter contexto.",
        status: "idle",
      },
    },
    {
      id: "asset-output",
      type: "labNode",
      position: { x: 800, y: 160 },
      data: {
        kind: "asset-output",
        title: "Saída",
        description: "Destino lógico do resultado do fluxo.",
        status: "idle",
      },
    },
  ],
  edges: [
    {
      id: "input-briefing-note-context",
      source: "input-briefing",
      target: "note-context",
      type: "smoothstep",
    },
    {
      id: "note-context-asset-output",
      source: "note-context",
      target: "asset-output",
      type: "smoothstep",
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

export function isFlowGraph(value: unknown): value is FlowGraph {
  if (!value || typeof value !== "object") {
    return false;
  }

  const graph = value as Partial<FlowGraph>;
  return Array.isArray(graph.nodes) && Array.isArray(graph.edges);
}
