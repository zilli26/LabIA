import { NextResponse, type NextRequest } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { parseStoredFlowGraph, updateFlowGraph } from "@/lib/db/flows";
import { isFlowGraph } from "@/lib/flows/graph";
import { validateFlowGraph } from "@/lib/flows/validation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    flowId: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  if (!hasDatabaseEnv()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL e DIRECT_URL não estão configuradas. Preencha .env.local e rode as migrations do Prisma.",
      },
      { status: 503 },
    );
  }

  const { flowId } = await context.params;
  const body = (await request.json()) as {
    name?: unknown;
    graph?: unknown;
  };

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json(
      { error: "Nome do fluxo é obrigatório." },
      { status: 400 },
    );
  }

  if (!isFlowGraph(body.graph)) {
    return NextResponse.json(
      { error: "Grafo do fluxo inválido." },
      { status: 400 },
    );
  }

  const validation = validateFlowGraph(body.graph);

  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "Grafo do fluxo possui conexões inválidas.",
        validation,
      },
      { status: 400 },
    );
  }

  try {
    const flow = await updateFlowGraph({
      flowId,
      name: body.name.trim(),
      graph: body.graph,
    });

    return NextResponse.json({
      flow: {
        ...flow,
        graph: parseStoredFlowGraph(flow.graph),
      },
    });
  } catch (error) {
    console.error("Failed to save flow", error);

    return NextResponse.json(
      {
        error:
          "Não foi possível salvar o Flow no Postgres. Verifique a conexão Prisma/Supabase.",
      },
      { status: 503 },
    );
  }
}
