import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { getLatestFlowRun } from "@/lib/flows/runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    flowId: string;
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

  const { flowId } = await context.params;

  try {
    return NextResponse.json({
      flowRun: await getLatestFlowRun(flowId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? "Falha ao carregar a ultima execucao do fluxo."
            : "Não foi possível carregar a última execução do fluxo.",
      },
      { status: 503 },
    );
  }
}
