import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import {
  createFlow,
  getOrCreateStarterFlow,
  listRecentFlows,
  parseStoredFlowGraph,
} from "@/lib/db/flows";

export const dynamic = "force-dynamic";

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

export async function POST() {
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
    const flow = await createFlow();

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
