import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { getOrCreateStarterFlow, parseStoredFlowGraph } from "@/lib/db/flows";

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

    return NextResponse.json({
      flow: {
        ...flow,
        graph: parseStoredFlowGraph(flow.graph),
      },
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
