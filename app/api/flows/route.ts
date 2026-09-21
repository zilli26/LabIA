import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import {
  createFlow,
  getOrCreateStarterFlow,
  listRecentFlows,
  parseStoredFlowGraph,
} from "@/lib/db/flows";
import { getOwnedExecutionScope } from "@/lib/flows/ownership";
import type { FlowTemplateId, ProductFlowTemplateId } from "@/lib/flows/templates";
import { createProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

type AcceptedFlowTemplateId = FlowTemplateId | ProductFlowTemplateId;

function isAcceptedFlowTemplate(value: unknown): value is AcceptedFlowTemplateId {
  return value === "image-to-video"
    || value === "image-only"
    || value === "product-imported-to-video"
    || value === "product-production-blueprint";
}

function isProjectFlowTemplate(
  value: AcceptedFlowTemplateId | undefined,
): value is ProductFlowTemplateId {
  return value === "product-imported-to-video" || value === "product-production-blueprint";
}

function parseImportedProductProject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Informe os dados mínimos do Projeto para este template." } as const;
  }

  const body = value as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const objective = typeof body.objective === "string" ? body.objective.trim() : "";
  const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio.trim() : "9:16";
  const durationSeconds = body.durationSeconds === undefined ? 5 : body.durationSeconds;

  if (!name || name.length > 160) {
    return { error: "Nome do Projeto é obrigatório e deve ter até 160 caracteres." } as const;
  }
  if (objective.length > 5000) {
    return { error: "Objetivo do Projeto deve ter até 5.000 caracteres." } as const;
  }
  if (!/^\d{1,2}:\d{1,2}$/.test(aspectRatio)) {
    return { error: "Proporção inválida. Use, por exemplo, 9:16." } as const;
  }
  if (
    typeof durationSeconds !== "number" ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds < 1 ||
    durationSeconds > 3600
  ) {
    return { error: "Duração em segundos deve ser um número entre 1 e 3.600." } as const;
  }

  return {
    value: {
      name,
      objective: objective || "Vídeo curto de produto",
      aspectRatio,
      durationSeconds,
    },
  } as const;
}

export async function GET() {
  if (!hasDatabaseEnv()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL e DIRECT_URL não estão configuradas. Preencha .env.local e rode as migrations do Prisma.",
      },
      { status: 503 },
    );
  }

  try {
    const flow = await getOrCreateStarterFlow();
    const flows = await listRecentFlows(24);

    return NextResponse.json({
      flow: {
        ...flow,
        graph: parseStoredFlowGraph(flow.graph),
      },
      flows: flows.map((item) => ({
        ...item,
        graph: parseStoredFlowGraph(item.graph),
      })),
    });
  } catch (error) {
    console.error("Failed to load flow", error);

    return NextResponse.json(
      {
        error:
          "Não foi possível carregar o Flow. Verifique DATABASE_URL/DIRECT_URL e rode as migrations do Prisma.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!hasDatabaseEnv()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL e DIRECT_URL não estão configuradas. Preencha .env.local e rode as migrations do Prisma.",
      },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      template?: unknown;
      project?: unknown;
    };
    const template = body.template;
    const templateNames: Record<AcceptedFlowTemplateId, string> = {
      "image-to-video": "Imagem-base → Vídeo curto",
      "image-only": "Imagem-base",
      "product-imported-to-video": "Produto importado → Vídeo curto",
      "product-production-blueprint": "Blueprint de produção → Vídeo de produto",
    };
    const acceptedTemplate = isAcceptedFlowTemplate(template) ? template : undefined;
    if (template !== undefined && acceptedTemplate === undefined) {
      return NextResponse.json({ error: "Template de fluxo inválido." }, { status: 400 });
    }

    if (isProjectFlowTemplate(acceptedTemplate)) {
      const parsedProject = parseImportedProductProject(body.project);
      if (!("value" in parsedProject) || !parsedProject.value) {
        return NextResponse.json({ error: parsedProject.error }, { status: 400 });
      }

      const scope = await getOwnedExecutionScope();
      const project = await createProject({
        ...scope,
        name: parsedProject.value.name,
        objective: parsedProject.value.objective,
        type: "VIDEO",
        aspectRatio: parsedProject.value.aspectRatio,
        durationSeconds: parsedProject.value.durationSeconds,
        flowTemplate: acceptedTemplate,
      });
      const primaryFlow = project.primaryFlow;

      if (!primaryFlow?.id || !primaryFlow.projectId) {
        throw new Error("O Projeto foi criado sem Flow principal vinculado.");
      }

      return NextResponse.json(
        {
          flow: {
            ...primaryFlow,
            projectId: primaryFlow.projectId,
            graph: parseStoredFlowGraph(primaryFlow.graph),
          },
          project: {
            id: project.id,
            name: project.name,
            primaryFlowId: primaryFlow.id,
          },
        },
        { status: 201 },
      );
    }

    const flow = await createFlow(
      acceptedTemplate === undefined ? undefined : templateNames[acceptedTemplate],
      acceptedTemplate as FlowTemplateId | undefined,
    );

    return NextResponse.json(
      {
        flow: {
          ...flow,
          graph: parseStoredFlowGraph(flow.graph),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create flow", error);

    return NextResponse.json(
      {
        error:
          "Não foi possível criar o Flow no Postgres. Verifique a conexão Prisma/Supabase.",
      },
      { status: 503 },
    );
  }
}
