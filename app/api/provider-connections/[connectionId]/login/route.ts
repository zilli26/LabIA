import { startExecutorLogin } from "@/lib/provider-connections/executor-client";
import { getOwnedProviderConnection, markExecutorOffline, markProviderConnectionAction, withProviderConnectionLock } from "@/lib/provider-connections/store";
import { assertLocalConnectionsRequest, LocalConnectionsError, noStoreJson, sanitizeProviderMessage } from "@/lib/provider-connections/security";
import type { OpenAiLoginMethod } from "@/lib/provider-connections/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    assertLocalConnectionsRequest(request);
    const connectionId = (await params).connectionId;
    const result = await withProviderConnectionLock(connectionId, async () => {
      const connection = await getOwnedProviderConnection(connectionId);
      if (!connection) return { error: { code: "not_found", message: "Conex\u00e3o n\u00e3o encontrada." }, status: 404 as const };
      if (connection.provider !== "openai") return { error: { code: "unsupported_provider", message: "Provider ainda n\u00e3o suportado nesta etapa." }, status: 400 as const };
      const body = (await request.json().catch(() => ({}))) as { method?: OpenAiLoginMethod };
      const method = body.method ?? "chatgptDeviceCode";
      if (method !== "chatgpt" && method !== "chatgptDeviceCode") {
        return { error: { code: "invalid_login_method", message: "M\u00e9todo de login inv\u00e1lido." }, status: 400 as const };
      }
      await markProviderConnectionAction(connection.id, {
        authStatus: "connecting",
        executorStatus: "starting",
        authMethod: method,
        loginId: null,
        loginExpiresAt: null,
        errorCode: null,
        errorMessage: null,
      });

      let login: Awaited<ReturnType<typeof startExecutorLogin>>;
      try {
        login = await startExecutorLogin(connection.sessionRef, method);
      } catch (error) {
        await markExecutorOffline(connection.id, sanitizeProviderMessage(error)).catch(() => undefined);
        throw error;
      }

      const updated = await markProviderConnectionAction(connection.id, {
        authStatus: "connecting",
        executorStatus: "online",
        authMethod: method,
        loginId: login.loginId,
        loginExpiresAt: new Date(login.instruction.expiresAt),
        errorCode: null,
        errorMessage: null,
      });
      return { connection: updated, instruction: login.instruction };
    });
    if ("error" in result && "status" in result) {
      return noStoreJson({ error: result.error }, { status: result.status });
    }
    return noStoreJson(result);
  } catch (error) {
    if (error instanceof LocalConnectionsError) {
      return noStoreJson({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return noStoreJson({ error: { code: "login_start_failed", message: sanitizeProviderMessage(error) } }, { status: 503 });
  }
}
