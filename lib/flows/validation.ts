import type { Edge } from "@xyflow/react";

import type { FlowGraph, LabFlowNode } from "@/lib/flows/graph";
import { getNodeDefinition } from "@/lib/flows/registry";
import type {
  ConnectionValidationRequest,
  ConnectionValidationResult,
  FlowValidationIssue,
  FlowValidationResult,
  NodeDefinition,
  PortSpec,
} from "@/lib/flows/types";

export function getDefinitionTypeForNode(node: LabFlowNode) {
  return node.data.kind;
}

export function isPortCompatible(source: PortSpec, target: PortSpec) {
  return (
    source.type === "any" ||
    target.type === "any" ||
    source.type === target.type
  );
}

function getOutputPort(
  definition: NodeDefinition,
  handleId: string | null | undefined,
) {
  if (handleId) {
    return definition.outputs.find((port) => port.id === handleId);
  }

  return definition.outputs[0];
}

function getInputPort(
  definition: NodeDefinition,
  handleId: string | null | undefined,
) {
  if (handleId) {
    return definition.inputs.find((port) => port.id === handleId);
  }

  return definition.inputs[0];
}

export function validateConnection(
  graph: FlowGraph,
  request: ConnectionValidationRequest,
): ConnectionValidationResult {
  const sourceNode = graph.nodes.find(
    (node) => node.id === request.sourceNodeId,
  );
  const targetNode = graph.nodes.find(
    (node) => node.id === request.targetNodeId,
  );

  if (!sourceNode || !targetNode) {
    return {
      valid: false,
      reason: "Nó de origem ou destino não existe no grafo.",
    };
  }

  const sourceDefinition = getNodeDefinition(getDefinitionTypeForNode(sourceNode));
  const targetDefinition = getNodeDefinition(getDefinitionTypeForNode(targetNode));

  if (!sourceDefinition || !targetDefinition) {
    return {
      valid: false,
      reason: "Tipo de nó não registrado.",
    };
  }

  const outputPort = getOutputPort(sourceDefinition, request.sourceHandle);
  const inputPort = getInputPort(targetDefinition, request.targetHandle);

  if (!outputPort || !inputPort) {
    return {
      valid: false,
      reason: "Porta de origem ou destino não existe.",
    };
  }

  if (!isPortCompatible(outputPort, inputPort)) {
    return {
      valid: false,
      sourceType: outputPort.type,
      targetType: inputPort.type,
      reason: `Saída ${outputPort.type} não conecta em entrada ${inputPort.type}.`,
    };
  }

  return {
    valid: true,
    sourceType: outputPort.type,
    targetType: inputPort.type,
  };
}

export function validateFlowGraph(graph: FlowGraph): FlowValidationResult {
  const issues: FlowValidationIssue[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  for (const node of graph.nodes) {
    const definition = getNodeDefinition(getDefinitionTypeForNode(node));

    if (!definition) {
      issues.push({
        code: "unknown-node-type",
        message: `Tipo de nó não registrado: ${getDefinitionTypeForNode(node)}.`,
        nodeId: node.id,
      });
    }
  }

  for (const edge of graph.edges) {
    addEdgeValidationIssues(graph, edge, nodeIds, issues);
  }

  if (hasCycle(graph)) {
    issues.push({
      code: "cycle",
      message: "O grafo possui ciclo; execução de fluxo exige grafo acíclico.",
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

function addEdgeValidationIssues(
  graph: FlowGraph,
  edge: Edge,
  nodeIds: Set<string>,
  issues: FlowValidationIssue[],
) {
  if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
    issues.push({
      code: "unknown-node",
      edgeId: edge.id,
      message: "Aresta aponta para nó inexistente.",
    });
    return;
  }

  const result = validateConnection(graph, {
    sourceNodeId: edge.source,
    targetNodeId: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
  });

  if (!result.valid) {
    issues.push({
      code:
        result.reason === "Porta de origem ou destino não existe."
          ? "unknown-port"
          : "incompatible-port",
      edgeId: edge.id,
      message: result.reason ?? "Conexão inválida.",
    });
  }
}

function hasCycle(graph: FlowGraph) {
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const node of graph.nodes) {
    outgoing.set(node.id, []);
    indegree.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    if (!outgoing.has(edge.source) || !indegree.has(edge.target)) {
      continue;
    }

    outgoing.get(edge.source)?.push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const ready = Array.from(indegree.entries())
    .filter(([, count]) => count === 0)
    .map(([nodeId]) => nodeId);
  let visited = 0;

  while (ready.length > 0) {
    const nodeId = ready.shift();

    if (!nodeId) {
      continue;
    }

    visited += 1;

    for (const nextNodeId of outgoing.get(nodeId) ?? []) {
      const nextIndegree = (indegree.get(nextNodeId) ?? 0) - 1;
      indegree.set(nextNodeId, nextIndegree);

      if (nextIndegree === 0) {
        ready.push(nextNodeId);
      }
    }
  }

  return visited !== graph.nodes.length;
}
