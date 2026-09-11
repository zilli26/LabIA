import { NextResponse } from "next/server";

import { startExecutorLogin } from "@/lib/provider-connections/executor-client";
import { getOwnedProviderConnection, markExecutorOffline, markProviderConnectionAction } from "@/lib/provider-connections/store";
import { assertLocalConnectionsRequest, LocalConnectionsError, sanitizeProviderMessage } from "@/lib/provider-connections/security";
import type { OpenAiLoginMethod } from "@/lib/provider-connections/types";

export async function POST(
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
    if (connection.provider !== "openai") {
      return NextResponse.json({ error: { code: "unsupported_provider", message: "Provider ainda não suportado nesta etapa." } }, { status: 400 });
    }
    const body = (await request.json().catch(() => ({}))) as { method?: OpenAiLoginMethod };
    const method = body.method ?? "chatgptDeviceCode";
    if (method !== "chatgpt" && method !== "chatgptDeviceCode") {
      return NextResponse.json({ error: { code: "invalid_login_method", message: "Método de login inválido." } }, { status: 400 });
    }
    await markProviderConnectionAction(connection.id, {
      authStatus: "connecting",
      executorStatus: "starting",
      authMethod: method,
      errorCode: null,
      errorMessage: null,
    });
    const result = await startExecutorLogin(connection.sessionRef, method);
    const updated = await markProviderConnectionAction(connection.id, {
      authStatus: "connecting",
      executorStatus: "online",
      authMethod: method,
      loginId: result.loginId,
      loginExpiresAt: new Date(result.instruction.expiresAt),
      errorCode: null,
      errorMessage: null,
    });
    return NextResponse.json({ connection: updated, instruction: result.instruction });
  } catch (error) {
    if (connectionId) await markExecutorOffline(connectionId, sanitizeProviderMessage(error)).catch(() => undefined);
    if (error instanceof LocalConnectionsError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "login_start_failed", message: sanitizeProviderMessage(error) } }, { status: 503 });
  }
}
