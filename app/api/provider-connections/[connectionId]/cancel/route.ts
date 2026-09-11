import { NextResponse } from "next/server";

import { cancelExecutorLogin } from "@/lib/provider-connections/executor-client";
import { getOwnedProviderConnection, updateProviderConnectionFromExecutor } from "@/lib/provider-connections/store";
import { assertLocalConnectionsRequest, LocalConnectionsError, sanitizeProviderMessage } from "@/lib/provider-connections/security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    assertLocalConnectionsRequest(request);
    const connection = await getOwnedProviderConnection((await params).connectionId);
    if (!connection) {
      return NextResponse.json({ error: { code: "not_found", message: "Conexão não encontrada." } }, { status: 404 });
    }
    const live = await cancelExecutorLogin(connection.sessionRef);
    const updated = await updateProviderConnectionFromExecutor(connection.id, live, { loginId: null });
    return NextResponse.json({ connection: updated });
  } catch (error) {
    if (error instanceof LocalConnectionsError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "cancel_failed", message: sanitizeProviderMessage(error) } }, { status: 503 });
  }
}
