import type { FlowRun, FlowRunNode, Prisma } from "@prisma/client";
import { billingModeFromProvider, normalizeBillingMode, type BillingMode } from "@/lib/providers/model-provider";

import { parseStoredFlowGraph } from "@/lib/flows/parse";
import { getFlowRunRealtimeConfig } from "@/lib/flows/realtime";

type FlowRunWithNodes = FlowRun & {
  nodes: FlowRunNode[];
};

function billingModeFromParams(params: Prisma.JsonValue | null): BillingMode {
  const providerId = params && typeof params === "object" && !Array.isArray(params) && typeof (params as Record<string, unknown>).providerId === "string"
    ? (params as Record<string, unknown>).providerId as string
    : "fal";
  const declaredBillingMode = params && typeof params === "object" && !Array.isArray(params)
    ? (params as Record<string, unknown>).billingMode
    : undefined;
  if (declaredBillingMode !== undefined) return normalizeBillingMode(declaredBillingMode, providerId);
  return billingModeFromProvider(providerId);
}

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
      billingMode: deriveRunBillingMode(run.nodes),
    },
    totalActualCost: {
      usd: decimalToNumber(run.totalActualCostUsd),
      brl: decimalToNumber(run.totalActualCostBrl),
      billingMode: deriveRunBillingMode(run.nodes),
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
          billingMode: billingModeFromParams(node.params),
        },
        actualCost: {
          usd: decimalToNumber(node.actualCostUsd),
          brl: decimalToNumber(node.actualCostBrl),
          billingMode: billingModeFromParams(node.params),
        },
        startedAt: node.startedAt?.toISOString() ?? null,
        completedAt: node.completedAt?.toISOString() ?? null,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
      })),
    realtime: getFlowRunRealtimeConfig(run.id),
  };
}

function deriveRunBillingMode(nodes: FlowRunNode[]): BillingMode {
  const modes = [...new Set(nodes
    .filter((node) => Number(node.estimatedCostUsd.toString()) !== 0 || Number(node.actualCostUsd.toString()) !== 0)
    .map((node) => billingModeFromParams(node.params)))];
  return modes.length === 1 ? modes[0] : "local";
}

function decimalToNumber(value: Prisma.Decimal) {
  return Number(value.toString());
}
