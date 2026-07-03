import type { FlowRun, FlowRunNode, Prisma } from "@prisma/client";

import { parseStoredFlowGraph } from "@/lib/db/flows";
import { getFlowRunRealtimeConfig } from "@/lib/flows/realtime";

type FlowRunWithNodes = FlowRun & {
  nodes: FlowRunNode[];
};

export function serializeFlowRun(run: FlowRunWithNodes) {
  return {
    id: run.id,
    workspaceId: run.workspaceId,
    flowId: run.flowId,
    status: run.status,
    graph: parseStoredFlowGraph(run.graph),
    nodeOrder: run.nodeOrder,
    targetNodeId: run.targetNodeId,
    totalEstimatedCost: {
      usd: decimalToNumber(run.totalEstimatedCostUsd),
      brl: decimalToNumber(run.totalEstimatedCostBrl),
    },
    totalActualCost: {
      usd: decimalToNumber(run.totalActualCostUsd),
      brl: decimalToNumber(run.totalActualCostBrl),
    },
    outputs: run.outputs,
    error: run.error,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    nodes: run.nodes
      .sort((a, b) => a.sequence - b.sequence)
      .map((node) => ({
        id: node.id,
        flowRunId: node.flowRunId,
        nodeId: node.nodeId,
        type: node.type,
        sequence: node.sequence,
        status: node.status,
        dependencyNodeIds: node.dependencyNodeIds,
        params: node.params,
        inputs: node.inputs,
        outputs: node.outputs,
        error: node.error,
        pgBossJobId: node.pgBossJobId,
        estimatedCost: {
          usd: decimalToNumber(node.estimatedCostUsd),
          brl: decimalToNumber(node.estimatedCostBrl),
        },
        actualCost: {
          usd: decimalToNumber(node.actualCostUsd),
          brl: decimalToNumber(node.actualCostBrl),
        },
        startedAt: node.startedAt?.toISOString() ?? null,
        completedAt: node.completedAt?.toISOString() ?? null,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
      })),
    realtime: getFlowRunRealtimeConfig(run.id),
  };
}

function decimalToNumber(value: Prisma.Decimal) {
  return Number(value.toString());
}
