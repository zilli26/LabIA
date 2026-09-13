import { CodexAppServerClient, resolveCodexHomeRoot } from "@/lib/provider-connections/codex-app-server";
import { logoutExecutorConnection } from "@/lib/provider-connections/executor-client";
import { getOwnedProviderConnection, updateProviderConnectionFromExecutor, withProviderConnectionLock } from "@/lib/provider-connections/store";
import { assertLocalConnectionsRequest, LocalConnectionsError, noStoreJson, sanitizeProviderMessage } from "@/lib/provider-connections/security";
import type { ExecutorAccountStatus } from "@/lib/provider-connections/types";

function codexHomeRoot() {
  return resolveCodexHomeRoot(process.env.LABIA_CODEX_HOME_ROOT);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  let connectionId = "";
  try {
    assertLocalConnectionsRequest(request);
    connectionId = (await params).connectionId;
    const result = await withProviderConnectionLock(connectionId, async () => {
      const connection = await getOwnedProviderConnection(connectionId);
      if (!connection) return { notFound: true as const };

      try {
        const live = await logoutExecutorConnection(connection.sessionRef);
        const updated = await updateProviderConnectionFromExecutor(connection.id, live, { loginId: null });
        return { connection: updated };
      } catch (error) {
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
            errorMessage: `Credencial local removida; logout remoto n\u00e3o confirmado: ${sanitizeProviderMessage(error)}`,
          };
          const updated = await updateProviderConnectionFromExecutor(connection.id, localOnlyStatus, { loginId: null });
          return { connection: updated, warning: localOnlyStatus.errorMessage };
        } catch (cleanupError) {
          const cleanupFailedStatus: ExecutorAccountStatus = {
            authStatus: "disconnected",
            executorStatus: "offline",
            accountLabel: null,
            planType: null,
            loginExpiresAt: null,
            errorCode: "credential_cleanup_failed",
            errorMessage: `Falha ao remover credencial local; conexão mantida desconectada: ${sanitizeProviderMessage(cleanupError)}`,
          };
          const updated = await updateProviderConnectionFromExecutor(connection.id, cleanupFailedStatus, { loginId: null });
          return { connection: updated, warning: cleanupFailedStatus.errorMessage };
        }
      }
    });
    if ("notFound" in result) {
      return noStoreJson({ error: { code: "not_found", message: "Conex\u00e3o n\u00e3o encontrada." } }, { status: 404 });
    }
    return noStoreJson(result);
  } catch (error) {
    if (error instanceof LocalConnectionsError) {
      return noStoreJson({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return noStoreJson({ error: { code: "disconnect_failed", message: sanitizeProviderMessage(error) } }, { status: 503 });
  }
}
