import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { getFlowRun } from "@/lib/flows/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    flowId: string;
    runId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!hasDatabaseEnv()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL e DIRECT_URL não estão configuradas. Preencha .env.local e rode as migrations do Prisma.",
      },
      { status: 503 },
    );
  }

  const { runId } = await context.params;

  try {
    return NextResponse.json({
      flowRun: await getFlowRun(runId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o FlowRun.",
      },
      { status: 404 },
    );
  }
}
