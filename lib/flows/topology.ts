import type { Edge } from "@xyflow/react";

import type { FlowGraph, LabFlowNode } from "@/lib/flows/graph";
import { validateFlowGraph } from "@/lib/flows/validation";

export type PlannedFlowNode = {
  node: LabFlowNode;
  nodeId: string;
  type: string;
  sequence: number;
  dependencyNodeIds: string[];
  incomingEdges: Edge[];
  outgoingEdges: Edge[];
};

export type FlowExecutionPlan = {
  nodes: PlannedFlowNode[];
  nodeOrder: string[];
  rootNodeIds: string[];
};

export function buildExecutionPlan(
  graph: FlowGraph,
  options: {
    targetNodeId?: string | null;
  } = {},
): FlowExecutionPlan {
  const validation = validateFlowGraph(graph);

  if (!validation.valid) {
    throw new Error(
      `Grafo inválido para execução: ${validation.issues
        .map((issue) => issue.message)
        .join(" ")}`,
    );
  }

  const includedNodeIds = getIncludedNodeIds(graph, options.targetNodeId);
  const orderedNodeIds = topologicalSort(graph, includedNodeIds);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const includedEdges = graph.edges.filter(
    (edge) => includedNodeIds.has(edge.source) && includedNodeIds.has(edge.target),
  );

  const plannedNodes = orderedNodeIds.map((nodeId, sequence) => {
    const node = nodesById.get(nodeId);

    if (!node) {
      throw new Error(`Nó não encontrado no plano: ${nodeId}`);
    }

    const incomingEdges = includedEdges.filter((edge) => edge.target === nodeId);
    const outgoingEdges = includedEdges.filter((edge) => edge.source === nodeId);

    return {
      node,
      nodeId,
      type: node.data.kind,
      sequence,
      dependencyNodeIds: incomingEdges.map((edge) => edge.source),
      incomingEdges,
      outgoingEdges,
    };
  });

  return {
    nodes: plannedNodes,
    nodeOrder: orderedNodeIds,
    rootNodeIds: plannedNodes
      .filter((node) => node.dependencyNodeIds.length === 0)
      .map((node) => node.nodeId),
  };
}

function getIncludedNodeIds(graph: FlowGraph, targetNodeId?: string | null) {
  if (!targetNodeId) {
    return new Set(graph.nodes.map((node) => node.id));
  }

  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  if (!nodeIds.has(targetNodeId)) {
    throw new Error(`Nó alvo não existe no grafo: ${targetNodeId}`);
  }

  const reverseEdges = new Map<string, string[]>();

  for (const node of graph.nodes) {
    reverseEdges.set(node.id, []);
  }

  for (const edge of graph.edges) {
    reverseEdges.get(edge.target)?.push(edge.source);
  }

  const included = new Set<string>();
  const stack = [targetNodeId];

  while (stack.length > 0) {
    const nodeId = stack.pop();

    if (!nodeId || included.has(nodeId)) {
      continue;
    }

    included.add(nodeId);
    stack.push(...(reverseEdges.get(nodeId) ?? []));
  }

  return included;
}

function topologicalSort(graph: FlowGraph, includedNodeIds: Set<string>) {
  const originalOrder = new Map(
    graph.nodes.map((node, index) => [node.id, index]),
  );
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const nodeId of includedNodeIds) {
    outgoing.set(nodeId, []);
    indegree.set(nodeId, 0);
  }

  for (const edge of graph.edges) {
    if (!includedNodeIds.has(edge.source) || !includedNodeIds.has(edge.target)) {
      continue;
    }

    outgoing.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const ready = Array.from(indegree.entries())
    .filter(([, count]) => count === 0)
    .map(([nodeId]) => nodeId)
    .sort((a, b) => (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0));
  const ordered: string[] = [];

  while (ready.length > 0) {
    const nodeId = ready.shift();

    if (!nodeId) {
      continue;
    }

    ordered.push(nodeId);

    const nextNodes = [...(outgoing.get(nodeId) ?? [])].sort(
      (a, b) => (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0),
    );

    for (const nextNodeId of nextNodes) {
      const nextIndegree = (indegree.get(nextNodeId) ?? 0) - 1;
      indegree.set(nextNodeId, nextIndegree);

      if (nextIndegree === 0) {
        ready.push(nextNodeId);
      }
    }

    ready.sort(
      (a, b) => (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0),
    );
  }

  if (ordered.length !== includedNodeIds.size) {
    throw new Error("Grafo possui ciclo e não pode ser ordenado.");
  }

  return ordered;
}
