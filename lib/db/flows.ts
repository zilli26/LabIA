import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { isFlowGraph, starterFlowGraph, type FlowGraph } from "@/lib/flows/graph";

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

export function parseStoredFlowGraph(graph: Prisma.JsonValue): FlowGraph {
  return isFlowGraph(graph) ? graph : starterFlowGraph;
}
