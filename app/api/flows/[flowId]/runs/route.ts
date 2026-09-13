import { NextResponse, type NextRequest } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { parseStoredFlowGraph } from "@/lib/db/flows";
import { estimateFlowCost } from "@/lib/flows/costs";
import { buildExecutionSnapshot, ExecutionConfirmationService, hashExecutionSnapshot, PrismaExecutionConfirmationStore } from "@/lib/flows/execution-confirmation";
import { getOwnedExecutionScope, getOwnedFlow } from "@/lib/flows/ownership";
import { createServerProviderResolver } from "@/lib/providers/provider-registry";
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
    confirmationToken?: unknown;
  };

  try {
    if (typeof body.confirmationToken !== "string" || body.confirmationToken.length === 0) {
      return NextResponse.json({ error: "Confirmação de execução ausente ou obsoleta." }, { status: 409 });
    }
    const flow = await getOwnedFlow(flowId);
    if (!flow) return NextResponse.json({ error: "Flow não encontrado." }, { status: 404 });
    const targetNodeId = typeof body.targetNodeId === "string" ? body.targetNodeId : null;
    const graph = parseStoredFlowGraph(flow.graph);
    const scope = await getOwnedExecutionScope();
    const cost = await estimateFlowCost(graph, { targetNodeId, resolveProvider: createServerProviderResolver(scope) });
    const snapshot = buildExecutionSnapshot({ ownerId: scope.ownerId, workspaceId: scope.workspaceId, flowId, targetNodeId, graph, cost });
    const consumed = await new ExecutionConfirmationService({ store: new PrismaExecutionConfirmationStore() }).consume(body.confirmationToken, snapshot);
    if (!consumed) return NextResponse.json({ error: "Confirmação de execução ausente ou obsoleta." }, { status: 409 });
    const flowRun = await createFlowRun({
      flowId,
      targetNodeId,
      confirmedSnapshotHash: hashExecutionSnapshot(snapshot),
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
