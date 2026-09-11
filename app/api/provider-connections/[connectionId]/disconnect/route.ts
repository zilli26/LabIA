import path from "node:path";

import { NextResponse } from "next/server";

import { CodexAppServerClient } from "@/lib/provider-connections/codex-app-server";
import { logoutExecutorConnection } from "@/lib/provider-connections/executor-client";
import { getOwnedProviderConnection, updateProviderConnectionFromExecutor } from "@/lib/provider-connections/store";
import { assertLocalConnectionsRequest, LocalConnectionsError, sanitizeProviderMessage } from "@/lib/provider-connections/security";
import type { ExecutorAccountStatus } from "@/lib/provider-connections/types";

function codexHomeRoot() {
  return path.resolve(process.env.LABIA_CODEX_HOME_ROOT?.trim() || path.join(process.cwd(), ".labia", "codex"));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  let connection: Awaited<ReturnType<typeof getOwnedProviderConnection>> = null;
  try {
    assertLocalConnectionsRequest(request);
    connection = await getOwnedProviderConnection((await params).connectionId);
    if (!connection) {
      return NextResponse.json({ error: { code: "not_found", message: "Conexão não encontrada." } }, { status: 404 });
    }
    const live = await logoutExecutorConnection(connection.sessionRef);
    const updated = await updateProviderConnectionFromExecutor(connection.id, live, { loginId: null });
    return NextResponse.json({ connection: updated });
  } catch (error) {
    if (error instanceof LocalConnectionsError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }

    if (connection) {
      try {
        const localCredential = new CodexAppServerClient({
          sessionRef: connection.sessionRef,
          codexHomeRoot: codexHomeRoot(),
        });
        await localCredential.clearDedicatedHome();
        const localOnlyStatus: ExecutorAccountStatus = {
          authStatus: "disconnected",
          executorStatus: "offline",
          accountLabel: null,
          planType: null,
          loginExpiresAt: null,
          errorCode: "remote_logout_unconfirmed",
          errorMessage: `Credencial local removida; logout remoto não confirmado: ${sanitizeProviderMessage(error)}`,
        };
        const updated = await updateProviderConnectionFromExecutor(connection.id, localOnlyStatus, { loginId: null });
        return NextResponse.json({ connection: updated, warning: localOnlyStatus.errorMessage });
      } catch (cleanupError) {
        return NextResponse.json(
          { error: { code: "disconnect_cleanup_failed", message: sanitizeProviderMessage(cleanupError) } },
          { status: 503 },
        );
      }
    }

    return NextResponse.json({ error: { code: "disconnect_failed", message: sanitizeProviderMessage(error) } }, { status: 503 });
  }
}
