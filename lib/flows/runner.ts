import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { estimateFlowCost, sumCosts } from "@/lib/flows/costs";
import type { FlowGraph } from "@/lib/flows/graph";
import { parseStoredFlowGraph } from "@/lib/flows/parse";
import {
  enqueueFlowRunNodeJob,
  registerFlowNodeWorker,
  type FlowNodeJobData,
} from "@/lib/flows/queue";
import { getNodeDefinition } from "@/lib/flows/registry";
import { serializeFlowRun } from "@/lib/flows/serialization";
import { isTerminalNodeStatus } from "@/lib/flows/status";
import {
  buildExecutionPlan,
  type FlowExecutionPlan,
  type PlannedFlowNode,
} from "@/lib/flows/topology";
import type { NodeExecutionResult } from "@/lib/flows/types";

export async function createFlowRun({
  flowId,
  targetNodeId,
}: {
  flowId: string;
  targetNodeId?: string | null;
}) {
  const flow = await prisma.flow.findUnique({
    where: {
      id: flowId,
    },
  });

  if (!flow) {
    throw new Error("Flow não encontrado.");
  }

  const graph = parseStoredFlowGraph(flow.graph);
  const plan = buildExecutionPlan(graph, { targetNodeId });
  const costEstimate = await estimateFlowCost(graph, {
    targetNodeId,
    plan,
  });
  const estimatedByNode = new Map(
    costEstimate.nodes.map((node) => [node.nodeId, node.estimatedCost]),
  );

  const run = await prisma.flowRun.create({
    data: {
      workspaceId: flow.workspaceId,
      flowId: flow.id,
      status: plan.rootNodeIds.length > 0 ? "running" : "done",
      graph: graph as unknown as Prisma.InputJsonValue,
      nodeOrder: plan.nodeOrder as unknown as Prisma.InputJsonValue,
      targetNodeId: targetNodeId ?? null,
      totalEstimatedCostUsd: costEstimate.total.usd,
      totalEstimatedCostBrl: costEstimate.total.brl,
      startedAt: plan.rootNodeIds.length > 0 ? new Date() : null,
      completedAt: plan.rootNodeIds.length === 0 ? new Date() : null,
      nodes: {
        create: plan.nodes.map((plannedNode) => {
          const estimatedCost = estimatedByNode.get(plannedNode.nodeId);

          return {
            nodeId: plannedNode.nodeId,
            type: plannedNode.type,
            sequence: plannedNode.sequence,
            status: plannedNode.dependencyNodeIds.length === 0 ? "queued" : "waiting",
            dependencyNodeIds:
              plannedNode.dependencyNodeIds as unknown as Prisma.InputJsonValue,
            params: (plannedNode.node.data.params ?? {}) as Prisma.InputJsonValue,
            estimatedCostUsd: estimatedCost?.usd ?? 0,
            estimatedCostBrl: estimatedCost?.brl ?? 0,
          };
        }),
      },
    },
    include: {
      nodes: true,
    },
  });

  try {
    await enqueueReadyNodes(run.id, plan.rootNodeIds);
  } catch (error) {
    await prisma.flowRun.update({
      where: {
        id: run.id,
      },
      data: {
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível enfileirar o FlowRun.",
        completedAt: new Date(),
      },
    });
  }

  return getFlowRun(run.id);
}

export async function getFlowRun(flowRunId: string) {
  const run = await prisma.flowRun.findUnique({
    where: {
      id: flowRunId,
    },
    include: {
      nodes: true,
    },
  });

  if (!run) {
    throw new Error("FlowRun não encontrado.");
  }

  return serializeFlowRun(run);
}

export async function executeFlowRunNode(job: FlowNodeJobData) {
  const run = await prisma.flowRun.findUnique({
    where: {
      id: job.flowRunId,
    },
    include: {
      nodes: true,
    },
  });

  if (!run || run.status === "failed" || run.status === "done") {
    return;
  }

  const runNode = run.nodes.find((node) => node.nodeId === job.nodeId);

  if (!runNode || isTerminalNodeStatus(runNode.status)) {
    return;
  }

  const graph = parseStoredFlowGraph(run.graph);
  const plan = buildExecutionPlan(graph, {
    targetNodeId: run.targetNodeId,
  });
  const plannedNode = plan.nodes.find((node) => node.nodeId === job.nodeId);

  if (!plannedNode) {
    await markNodeFailed(run.id, job.nodeId, "Nó não está no plano do FlowRun.");
    await settleFlowRun(run.id, graph, plan);
    return;
  }

  const dependencyState = getDependencyState(run.nodes, plannedNode);

  if (dependencyState.failed) {
    await skipBlockedBranch(run.id, graph, plan, job.nodeId);
    await settleFlowRun(run.id, graph, plan);
    return;
  }

  if (!dependencyState.ready) {
    await prisma.flowRunNode.update({
      where: {
        flowRunId_nodeId: {
          flowRunId: run.id,
          nodeId: job.nodeId,
        },
      },
      data: {
        status: "waiting",
      },
    });
    return;
  }

  await prisma.flowRunNode.update({
    where: {
      flowRunId_nodeId: {
        flowRunId: run.id,
        nodeId: job.nodeId,
      },
    },
    data: {
      status: "running",
      startedAt: new Date(),
    },
  });

  try {
    const result = await executeDefinition({
      flowRunId: run.id,
      workspaceId: run.workspaceId,
      graph,
      plan,
      plannedNode,
      runNodes: run.nodes,
    });

    await prisma.flowRunNode.update({
      where: {
        flowRunId_nodeId: {
          flowRunId: run.id,
          nodeId: job.nodeId,
        },
      },
      data: {
        status: "done",
        outputs: result.outputs as Prisma.InputJsonValue,
        actualCostUsd: result.actualCost?.usd ?? 0,
        actualCostBrl: result.actualCost?.brl ?? 0,
        completedAt: new Date(),
      },
    });

    await refreshFlowRunActualCost(run.id);
    await enqueueReadyDependents(run.id, graph, plan, job.nodeId);
  } catch (error) {
    await markNodeFailed(
      run.id,
      job.nodeId,
      error instanceof Error ? error.message : "Erro ao executar nó.",
    );
    await skipBlockedBranch(run.id, graph, plan, job.nodeId);
  }

  await settleFlowRun(run.id, graph, plan);
}

export async function registerDefaultFlowWorker() {
  return registerFlowNodeWorker((job) => executeFlowRunNode(job.data));
}

async function enqueueReadyNodes(flowRunId: string, nodeIds: string[]) {
  for (const nodeId of nodeIds) {
    const pgBossJobId = await enqueueFlowRunNodeJob({
      flowRunId,
      nodeId,
    });

    await prisma.flowRunNode.update({
      where: {
        flowRunId_nodeId: {
          flowRunId,
          nodeId,
        },
      },
      data: {
        status: "queued",
        pgBossJobId,
      },
    });
  }
}

async function executeDefinition({
  flowRunId,
  workspaceId,
  plannedNode,
  runNodes,
}: {
  flowRunId: string;
  workspaceId: string;
  graph: FlowGraph;
  plan: FlowExecutionPlan;
  plannedNode: PlannedFlowNode;
  runNodes: Array<{
    nodeId: string;
    outputs: Prisma.JsonValue | null;
  }>;
}): Promise<NodeExecutionResult> {
  const definition = getNodeDefinition(plannedNode.type);

  if (!definition) {
    throw new Error(`NodeDefinition não registrado: ${plannedNode.type}`);
  }

  return definition.execute({
    flowRunId,
    workspaceId,
    nodeId: plannedNode.nodeId,
    params: plannedNode.node.data.params ?? {},
    inputs: collectInputs(plannedNode, runNodes),
  });
}

function collectInputs(
  plannedNode: PlannedFlowNode,
  runNodes: Array<{
    nodeId: string;
    outputs: Prisma.JsonValue | null;
  }>,
) {
  const inputs: Record<string, unknown> = {};
  const nodesById = new Map(runNodes.map((node) => [node.nodeId, node]));

  for (const edge of plannedNode.incomingEdges) {
    const sourceOutputs = nodesById.get(edge.source)?.outputs;
    const targetInputId = edge.targetHandle ?? "input";
    const sourceOutputId = edge.sourceHandle ?? "output";

    if (isRecord(sourceOutputs) && sourceOutputId in sourceOutputs) {
      inputs[targetInputId] = sourceOutputs[sourceOutputId];
      continue;
    }

    inputs[targetInputId] = sourceOutputs;
  }

  return inputs;
}

function getDependencyState(
  runNodes: Array<{
    nodeId: string;
    status: string;
  }>,
  plannedNode: PlannedFlowNode,
) {
  const nodesById = new Map(runNodes.map((node) => [node.nodeId, node]));
  const dependencyStatuses = plannedNode.dependencyNodeIds.map(
    (nodeId) => nodesById.get(nodeId)?.status,
  );

  return {
    failed: dependencyStatuses.some(
      (status) => status === "failed" || status === "skipped",
    ),
    ready: dependencyStatuses.every((status) => status === "done"),
  };
}

async function enqueueReadyDependents(
  flowRunId: string,
  graph: FlowGraph,
  plan: FlowExecutionPlan,
  completedNodeId: string,
) {
  const latestRunNodes = await prisma.flowRunNode.findMany({
    where: {
      flowRunId,
    },
  });
  const dependents = graph.edges
    .filter((edge) => edge.source === completedNodeId)
    .map((edge) => edge.target);
  const readyDependents = plan.nodes
    .filter(
      (plannedNode) =>
        dependents.includes(plannedNode.nodeId) &&
        latestRunNodes.find((node) => node.nodeId === plannedNode.nodeId)
          ?.status === "waiting" &&
        getDependencyState(latestRunNodes, plannedNode).ready,
    )
    .map((plannedNode) => plannedNode.nodeId);

  await enqueueReadyNodes(flowRunId, readyDependents);
}

async function skipBlockedBranch(
  flowRunId: string,
  graph: FlowGraph,
  plan: FlowExecutionPlan,
  failedNodeId: string,
) {
  const descendants = collectDescendants(graph, failedNodeId);
  const plannedNodeIds = new Set(plan.nodes.map((node) => node.nodeId));

  for (const nodeId of descendants) {
    if (!plannedNodeIds.has(nodeId)) {
      continue;
    }

    await prisma.flowRunNode.updateMany({
      where: {
        flowRunId,
        nodeId,
        status: {
          in: ["waiting", "queued"],
        },
      },
      data: {
        status: "skipped",
        completedAt: new Date(),
        error: `Dependência falhou: ${failedNodeId}`,
      },
    });
  }
}

async function markNodeFailed(
  flowRunId: string,
  nodeId: string,
  error: string,
) {
  await prisma.flowRunNode.update({
    where: {
      flowRunId_nodeId: {
        flowRunId,
        nodeId,
      },
    },
    data: {
      status: "failed",
      error,
      completedAt: new Date(),
    },
  });
}

async function settleFlowRun(
  flowRunId: string,
  graph: FlowGraph,
  plan: FlowExecutionPlan,
) {
  const nodes = await prisma.flowRunNode.findMany({
    where: {
      flowRunId,
    },
  });

  if (!nodes.every((node) => isTerminalNodeStatus(node.status))) {
    return;
  }

  const hasFailure = nodes.some((node) => node.status === "failed");
  const terminalOutputs = collectTerminalOutputs(graph, plan, nodes);

  await prisma.flowRun.update({
    where: {
      id: flowRunId,
    },
    data: {
      status: hasFailure ? "failed" : "done",
      outputs: terminalOutputs as Prisma.InputJsonValue,
      completedAt: new Date(),
      error: hasFailure ? "Um ou mais nós falharam." : null,
    },
  });
}

async function refreshFlowRunActualCost(flowRunId: string) {
  const nodes = await prisma.flowRunNode.findMany({
    where: {
      flowRunId,
    },
  });
  const total = sumCosts(
    nodes.map((node) => ({
      usd: Number(node.actualCostUsd.toString()),
      brl: Number(node.actualCostBrl.toString()),
      usdBrlRate: 0,
      lineItems: [],
      source: "flow-run-node",
    })),
  );

  await prisma.flowRun.update({
    where: {
      id: flowRunId,
    },
    data: {
      totalActualCostUsd: total.usd,
      totalActualCostBrl: total.brl,
    },
  });
}

function collectDescendants(graph: FlowGraph, nodeId: string) {
  const descendants = new Set<string>();
  const stack = graph.edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => edge.target);

  while (stack.length > 0) {
    const nextNodeId = stack.pop();

    if (!nextNodeId || descendants.has(nextNodeId)) {
      continue;
    }

    descendants.add(nextNodeId);
    stack.push(
      ...graph.edges
        .filter((edge) => edge.source === nextNodeId)
        .map((edge) => edge.target),
    );
  }

  return descendants;
}

function collectTerminalOutputs(
  graph: FlowGraph,
  plan: FlowExecutionPlan,
  nodes: Array<{
    nodeId: string;
    outputs: Prisma.JsonValue | null;
  }>,
) {
  const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));
  const plannedNodeIds = new Set(plan.nodes.map((node) => node.nodeId));
  const sourceNodeIds = new Set(
    graph.edges
      .filter((edge) => plannedNodeIds.has(edge.source))
      .map((edge) => edge.source),
  );
  const terminalNodeIds = plan.nodes
    .filter((node) => !sourceNodeIds.has(node.nodeId))
    .map((node) => node.nodeId);

  return Object.fromEntries(
    terminalNodeIds.map((nodeId) => [nodeId, nodesById.get(nodeId)?.outputs]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
