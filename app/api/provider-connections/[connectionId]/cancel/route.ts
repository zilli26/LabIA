import { cancelExecutorLogin } from "@/lib/provider-connections/executor-client";
import { getOwnedProviderConnection, updateProviderConnectionFromExecutor, withProviderConnectionLock } from "@/lib/provider-connections/store";
import { assertLocalConnectionsRequest, LocalConnectionsError, noStoreJson, sanitizeProviderMessage } from "@/lib/provider-connections/security";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    assertLocalConnectionsRequest(request);
    const connectionId = (await params).connectionId;
    const result = await withProviderConnectionLock(connectionId, async () => {
      const connection = await getOwnedProviderConnection(connectionId);
      if (!connection) return { notFound: true as const };
      const live = await cancelExecutorLogin(connection.sessionRef);
      const updated = await updateProviderConnectionFromExecutor(connection.id, live, { loginId: null });
      return { connection: updated };
    });
    if ("notFound" in result) {
      return noStoreJson({ error: { code: "not_found", message: "Conex\u00e3o n\u00e3o encontrada." } }, { status: 404 });
    }
    return noStoreJson(result);
  } catch (error) {
    if (error instanceof LocalConnectionsError) {
      return noStoreJson({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return noStoreJson({ error: { code: "cancel_failed", message: sanitizeProviderMessage(error) } }, { status: 503 });
  }
}
