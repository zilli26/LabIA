import {
  getOwnedProviderConnection,
  listOwnedProviderConnections,
} from "@/lib/provider-connections/store";
import { readExecutorImageOptions } from "@/lib/provider-connections/executor-client";
import {
  assertLocalConnectionsRequest,
  LocalConnectionsError,
  noStoreJson,
  sanitizeProviderMessage,
} from "@/lib/provider-connections/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof LocalConnectionsError) {
    return noStoreJson({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return noStoreJson(
    { error: { code: "provider_connections_error", message: sanitizeProviderMessage(error) } },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    assertLocalConnectionsRequest(request);
    const connections = await listOwnedProviderConnections();
    const eligible = connections.filter(
      (connection) => connection.provider === "openai" && connection.authStatus === "connected" && connection.executorStatus === "online",
    );
    const result = [];

    for (const connection of eligible) {
      const owned = await getOwnedProviderConnection(connection.id);
      if (!owned || owned.provider !== "openai" || !owned.sessionRef) continue;
      try {
        const options = await readExecutorImageOptions(owned.sessionRef);
        result.push({
          id: connection.id,
          label: connection.label,
          planType: connection.planType,
          models: options.models.filter((model) => model.id && model.name),
        });
      } catch {
        result.push({
          id: connection.id,
          label: connection.label,
          planType: connection.planType,
          models: [],
          errorCode: "image_generation_unavailable",
        });
      }
    }

    return noStoreJson({ connections: result });
  } catch (error) {
    return failure(error);
  }
}
