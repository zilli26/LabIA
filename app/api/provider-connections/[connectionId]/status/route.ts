import { readExecutorConnectionStatus } from "@/lib/provider-connections/executor-client";
import { getOwnedProviderConnection, markExecutorOffline, updateProviderConnectionFromExecutor, withProviderConnectionLock } from "@/lib/provider-connections/store";
import { assertLocalConnectionsRequest, LocalConnectionsError, noStoreJson, sanitizeProviderMessage } from "@/lib/provider-connections/security";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    assertLocalConnectionsRequest(request);
    const connectionId = (await params).connectionId;
    const result = await withProviderConnectionLock(connectionId, async () => {
      const connection = await getOwnedProviderConnection(connectionId);
      if (!connection) return { notFound: true as const };
      try {
        const expectedLoginId = connection.authStatus === "connecting" || connection.authStatus === "expired"
          ? connection.loginId
          : undefined;
        const expectedLoginExpiresAt = expectedLoginId ? connection.loginExpiresAt?.toISOString() ?? null : undefined;
        const live = await readExecutorConnectionStatus(connection.sessionRef, expectedLoginId, expectedLoginExpiresAt);
        const updated = await updateProviderConnectionFromExecutor(connection.id, live, {
          loginId: live.authStatus === "connecting" || live.authStatus === "expired" ? connection.loginId : null,
        });
        return { connection: updated };
      } catch (error) {
        await markExecutorOffline(connection.id, sanitizeProviderMessage(error)).catch(() => undefined);
        throw error;
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
    return noStoreJson({ error: { code: "status_failed", message: sanitizeProviderMessage(error) } }, { status: 503 });
  }
}
