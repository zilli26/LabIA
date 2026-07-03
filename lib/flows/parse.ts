import type { Prisma } from "@prisma/client";

import { isFlowGraph, starterFlowGraph, type FlowGraph } from "@/lib/flows/graph";

export function parseStoredFlowGraph(graph: Prisma.JsonValue): FlowGraph {
  return isFlowGraph(graph) ? graph : starterFlowGraph;
}
