import { NextResponse } from "next/server";

import { readExecutorConnectionStatus } from "@/lib/provider-connections/executor-client";
import { getOwnedProviderConnection, markExecutorOffline, updateProviderConnectionFromExecutor } from "@/lib/provider-connections/store";
import { assertLocalConnectionsRequest, LocalConnectionsError, sanitizeProviderMessage } from "@/lib/provider-connections/security";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  let connectionId = "";
  try {
    assertLocalConnectionsRequest(request);
    connectionId = (await params).connectionId;
    const connection = await getOwnedProviderConnection(connectionId);
    if (!connection) {
      return NextResponse.json({ error: { code: "not_found", message: "Conexão não encontrada." } }, { status: 404 });
    }
    const expectedLoginId = connection.authStatus === "connecting" ? connection.loginId : null;
    const live = await readExecutorConnectionStatus(connection.sessionRef, expectedLoginId);
    const updated = await updateProviderConnectionFromExecutor(connection.id, live, {
      loginId: live.authStatus === "connecting" ? connection.loginId : null,
    });
    return NextResponse.json({ connection: updated });
  } catch (error) {
    if (connectionId) await markExecutorOffline(connectionId, sanitizeProviderMessage(error)).catch(() => undefined);
    if (error instanceof LocalConnectionsError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "status_failed", message: sanitizeProviderMessage(error) } }, { status: 503 });
  }
}
