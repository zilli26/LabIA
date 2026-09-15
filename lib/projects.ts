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

export type CreateProjectForFlowInput = {
  flowId: string;
  scope: ProjectScope;
  name: string;
  objective?: string;
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

export async function createProjectForFlow({
  flowId,
  scope,
  name,
  objective,
}: CreateProjectForFlowInput) {
  return prisma.$transaction(async (tx) => {
    const flow = await tx.flow.findFirst({
      where: { id: flowId, workspaceId: scope.workspaceId },
      select: { id: true, name: true, projectId: true, graph: true },
    });

    if (!flow) return null;

    if (flow.projectId) {
      const existingProject = await tx.project.findFirst({
        where: { id: flow.projectId, workspaceId: scope.workspaceId },
        include: createdProjectInclude,
      });
      if (!existingProject) throw new Error("O Flow aponta para um Projeto inexistente.");

      return {
        project: {
          id: existingProject.id,
          name: existingProject.name,
          primaryFlowId: existingProject.primaryFlowId,
        },
        flow: {
          id: flow.id,
          projectId: flow.projectId,
          graph: flow.graph,
        },
      };
    }

    const project = await tx.project.create({
      data: {
        workspaceId: scope.workspaceId,
        name,
        type: "VIDEO",
        objective: objective?.trim() || "Organizar a produção deste Flow.",
        aspectRatio: "9:16",
        durationSeconds: 5,
        status: "DRAFT",
      },
    });
    const linked = await tx.flow.updateMany({
      where: { id: flow.id, workspaceId: scope.workspaceId, projectId: null },
      data: { projectId: project.id },
    });

    if (linked.count !== 1) {
      throw new Error("O Flow foi alterado antes da vinculação ao Projeto.");
    }

    await tx.project.update({
      where: { id: project.id },
      data: { primaryFlowId: flow.id },
    });

    return {
      project: {
        id: project.id,
        name: project.name,
        primaryFlowId: flow.id,
      },
      flow: {
        id: flow.id,
        projectId: project.id,
        graph: flow.graph,
      },
    };
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
