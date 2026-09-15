import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import {
  createFlow,
  getOrCreateStarterFlow,
  listRecentFlows,
  parseStoredFlowGraph,
} from "@/lib/db/flows";
import type { FlowTemplateId, ProductFlowTemplateId } from "@/lib/flows/templates";

export const dynamic = "force-dynamic";

type AcceptedFlowTemplateId = FlowTemplateId | ProductFlowTemplateId;

function isAcceptedFlowTemplate(value: unknown): value is AcceptedFlowTemplateId {
  return value === "image-to-video" || value === "image-only" || value === "product-imported-to-video";
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
    const body = (await request.json().catch(() => ({}))) as { template?: unknown };
    const template = body.template;
    const templateNames: Record<AcceptedFlowTemplateId, string> = {
      "image-to-video": "Imagem-base → Vídeo curto",
      "image-only": "Imagem-base",
      "product-imported-to-video": "Produto importado → Vídeo curto",
    };
    const acceptedTemplate = isAcceptedFlowTemplate(template) ? template : undefined;
    if (template !== undefined && acceptedTemplate === undefined) {
      return NextResponse.json({ error: "Template de fluxo inválido." }, { status: 400 });
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
