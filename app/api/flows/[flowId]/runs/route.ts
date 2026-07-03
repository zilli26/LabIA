import { NextResponse, type NextRequest } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { createFlowRun } from "@/lib/flows/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    flowId: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
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
  const body = (await request.json().catch(() => ({}))) as {
    targetNodeId?: unknown;
  };

  try {
    const flowRun = await createFlowRun({
      flowId,
      targetNodeId:
        typeof body.targetNodeId === "string" ? body.targetNodeId : null,
    });

    return NextResponse.json({ flowRun }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o FlowRun.",
      },
      { status: 400 },
    );
  }
}
