import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  createFlowTemplateGraph,
  type FlowTemplateId,
  type ProductFlowTemplateId,
} from "@/lib/flows/templates";

export const PROJECT_TYPES = ["IMAGE", "VIDEO"] as const;
export const PROJECT_STATUSES = ["DRAFT", "IN_PROGRESS", "REVIEW", "APPROVED", "ARCHIVED"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectFlowTemplateId = FlowTemplateId | ProductFlowTemplateId;
export type ProjectScope = { ownerId: string; workspaceId: string };
export type CreateProjectInput = {
  ownerId: string;
  workspaceId: string;
  name: string;
  type: ProjectType;
  objective: string;
  aspectRatio: string;
  durationSeconds: number | null;
  status?: ProjectStatus;
  flowTemplate?: ProjectFlowTemplateId;
};

const projectInclude = {
  primaryFlow: { select: { id: true, name: true } },
  _count: { select: { flows: true, assets: true } },
} satisfies Prisma.ProjectInclude;

const createdProjectInclude = {
  primaryFlow: { select: { id: true, name: true, projectId: true, graph: true } },
  _count: { select: { flows: true, assets: true } },
} satisfies Prisma.ProjectInclude;

export async function createProject(input: CreateProjectInput) {
  const status = input.status ?? "DRAFT";
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        type: input.type,
        objective: input.objective,
        aspectRatio: input.aspectRatio,
        durationSeconds: input.durationSeconds,
        status,
      },
    });
    const flowTemplate = input.flowTemplate ?? (input.type === "VIDEO" ? "image-to-video" : "image-only");
    const flow = await tx.flow.create({
      data: {
        workspaceId: input.workspaceId,
        projectId: project.id,
        name: `${input.name} · Flow principal`,
        isTemplate: false,
        graph: createFlowTemplateGraph(flowTemplate) as unknown as Prisma.InputJsonValue,
      },
    });
    return tx.project.update({
      where: { id: project.id },
      data: { primaryFlowId: flow.id },
      include: createdProjectInclude,
    });
  });
}

export async function listProjects(scope: ProjectScope) {
  return prisma.project.findMany({
    where: { workspaceId: scope.workspaceId },
    orderBy: { updatedAt: "desc" },
    include: projectInclude,
  });
}

export async function getProject(projectId: string, scope: ProjectScope) {
  return prisma.project.findFirst({
    where: { id: projectId, workspaceId: scope.workspaceId },
    include: projectInclude,
  });
}

export async function updateProject(projectId: string, scope: ProjectScope, data: Partial<Pick<CreateProjectInput, "name" | "objective" | "aspectRatio" | "durationSeconds" | "status">>) {
  const updated = await prisma.project.updateMany({
    where: { id: projectId, workspaceId: scope.workspaceId },
    data,
  });
  if (updated.count !== 1) return null;
  return getProject(projectId, scope);
}

export async function archiveProject(projectId: string, scope: ProjectScope) {
  return updateProject(projectId, scope, { status: "ARCHIVED" });
}
