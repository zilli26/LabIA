import "server-only";

import type { Prisma } from "@prisma/client";

import { hasDatabaseEnv } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { starterFlowGraph, type FlowGraph } from "@/lib/flows/graph";
import { createFlowTemplateGraph, type FlowTemplateId } from "@/lib/flows/templates";

export { parseStoredFlowGraph } from "@/lib/flows/parse";

const DEFAULT_WORKSPACE_SLUG =
  process.env.DEFAULT_WORKSPACE_SLUG ?? "felipe-labia";

export async function ensureDefaultWorkspace() {
  return prisma.workspace.upsert({
    where: {
      slug: DEFAULT_WORKSPACE_SLUG,
    },
    update: {},
    create: {
      name: "Felipe Zilli",
      slug: DEFAULT_WORKSPACE_SLUG,
    },
  });
}

export async function getOrCreateStarterFlow() {
  const workspace = await ensureDefaultWorkspace();

  const existingFlow = await prisma.flow.findFirst({
    where: {
      workspaceId: workspace.id,
      isTemplate: false,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existingFlow) {
    return existingFlow;
  }

  return prisma.flow.create({
    data: {
      workspaceId: workspace.id,
      name: "Fluxo inicial",
      graph: starterFlowGraph as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function createFlow(name = "Novo fluxo", template?: FlowTemplateId) {
  const workspace = await ensureDefaultWorkspace();

  return prisma.flow.create({
    data: {
      workspaceId: workspace.id,
      name,
      graph: (template ? createFlowTemplateGraph(template) : starterFlowGraph) as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getFlowById(flowId: string) {
  return prisma.flow.findUnique({
    where: {
      id: flowId,
    },
  });
}

export async function listRecentFlows(limit = 6) {
  if (!hasDatabaseEnv()) {
    return [];
  }

  const workspace = await ensureDefaultWorkspace();

  return prisma.flow.findMany({
    where: {
      workspaceId: workspace.id,
      isTemplate: false,
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: limit,
    include: {
      runs: {
        orderBy: {
          createdAt: "desc",
        },
        select: {
          totalActualCostBrl: true,
          totalEstimatedCostBrl: true,
        },
        take: 1,
      },
    },
  });
}

export async function getCurrentMonthSpendBrl() {
  if (!hasDatabaseEnv()) {
    return 0;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await prisma.generation.aggregate({
    where: {
      createdAt: {
        gte: monthStart,
      },
    },
    _sum: {
      actualCostBrl: true,
    },
  });

  return Number(result._sum.actualCostBrl ?? 0);
}

export async function updateFlowGraph({
  flowId,
  name,
  graph,
}: {
  flowId: string;
  name: string;
  graph: FlowGraph;
}) {
  return prisma.flow.update({
    where: {
      id: flowId,
    },
    data: {
      name,
      graph: graph as unknown as Prisma.InputJsonValue,
    },
  });
}
