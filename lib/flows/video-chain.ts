import type { Edge } from "@xyflow/react";

import type { LabFlowNode } from "@/lib/flows/graph";

function getNodeKind(nodesById: Map<string, LabFlowNode>, nodeId: string) {
  return nodesById.get(nodeId)?.data.kind;
}

function countUpstreamExtends({
  nodeId,
  edgesByTarget,
  nodesById,
  visited,
}: {
  nodeId: string;
  edgesByTarget: Map<string, Edge[]>;
  nodesById: Map<string, LabFlowNode>;
  visited: Set<string>;
}): number {
  if (visited.has(nodeId) || getNodeKind(nodesById, nodeId) !== "video-extend") {
    return 0;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(nodeId);
  const incomingEdges = edgesByTarget.get(nodeId) ?? [];
  const upstreamDepth = incomingEdges.reduce((maxDepth, edge) => {
    return Math.max(
      maxDepth,
      countUpstreamExtends({
        nodeId: edge.source,
        edgesByTarget,
        nodesById,
        visited: nextVisited,
      }),
    );
  }, 0);

  return upstreamDepth + 1;
}

export function countConsecutiveVideoExtends({
  nodes,
  edges,
  nodeId,
}: {
  nodes: LabFlowNode[];
  edges: Edge[];
  nodeId: string;
}) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edgesByTarget = edges.reduce((map, edge) => {
    const current = map.get(edge.target) ?? [];
    current.push(edge);
    map.set(edge.target, current);
    return map;
  }, new Map<string, Edge[]>());

  return countUpstreamExtends({
    nodeId,
    edgesByTarget,
    nodesById,
    visited: new Set(),
  });
}
