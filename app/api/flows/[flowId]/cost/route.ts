import { NextResponse, type NextRequest } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { parseStoredFlowGraph } from "@/lib/db/flows";
import { estimateFlowCost } from "@/lib/flows/costs";
import { buildExecutionSnapshot, PrismaExecutionConfirmationStore, ExecutionConfirmationService } from "@/lib/flows/execution-confirmation";
import { assertOwnedFlowBrand, getOwnedExecutionScope, getOwnedFlow } from "@/lib/flows/ownership";
import { assertOperationalGraphProviders, createServerProviderResolver } from "@/lib/providers/provider-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ flowId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!hasDatabaseEnv()) return NextResponse.json({ error: "DATABASE_URL e DIRECT_URL não estão configuradas." }, { status: 503 });
  const { flowId } = await context.params;
  const flow = await getOwnedFlow(flowId);
  if (!flow) return NextResponse.json({ error: "Flow não encontrado." }, { status: 404 });
  const scope = await getOwnedExecutionScope();
  const graph = parseStoredFlowGraph(flow.graph);
  await assertOwnedFlowBrand(flow.brandId, scope.workspaceId);
  await assertOperationalGraphProviders({ graph, ownerId: scope.ownerId, workspaceId: scope.workspaceId });
  return NextResponse.json({ cost: await estimateFlowCost(graph, { resolveProvider: createServerProviderResolver(scope) }) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasDatabaseEnv()) return NextResponse.json({ error: "DATABASE_URL e DIRECT_URL não estão configuradas." }, { status: 503 });
  const { flowId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { targetNodeId?: unknown };
    const flow = await getOwnedFlow(flowId);
  if (!flow) return NextResponse.json({ error: "Flow não encontrado." }, { status: 404 });
  try {
    const graph = parseStoredFlowGraph(flow.graph);
    const targetNodeId = typeof body.targetNodeId === "string" ? body.targetNodeId : null;
    const scope = await getOwnedExecutionScope();
    await assertOwnedFlowBrand(flow.brandId, scope.workspaceId);
    await assertOperationalGraphProviders({ graph, ownerId: scope.ownerId, workspaceId: scope.workspaceId });
    const cost = await estimateFlowCost(graph, { targetNodeId, resolveProvider: createServerProviderResolver(scope) });
    const snapshot = buildExecutionSnapshot({ ownerId: scope.ownerId, workspaceId: scope.workspaceId, flowId, targetNodeId, graph, cost });
    const confirmation = await new ExecutionConfirmationService({ store: new PrismaExecutionConfirmationStore() }).issue(snapshot);
    return NextResponse.json({ cost, confirmation });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível estimar o custo." }, { status: 400 });
  }
}
