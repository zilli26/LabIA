import { NextResponse, type NextRequest } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { parseStoredFlowGraph } from "@/lib/db/flows";
import { prisma } from "@/lib/db/prisma";
import { estimateFlowCost } from "@/lib/flows/costs";
import { isFlowGraph } from "@/lib/flows/graph";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    flowId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
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
  const flow = await prisma.flow.findUnique({
    where: {
      id: flowId,
    },
  });

  if (!flow) {
    return NextResponse.json({ error: "Flow não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    cost: await estimateFlowCost(parseStoredFlowGraph(flow.graph)),
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    graph?: unknown;
    targetNodeId?: unknown;
  };

  if (!isFlowGraph(body.graph)) {
    return NextResponse.json(
      { error: "Grafo do fluxo inválido." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    cost: await estimateFlowCost(body.graph, {
      targetNodeId:
        typeof body.targetNodeId === "string" ? body.targetNodeId : null,
    }),
  });
}
