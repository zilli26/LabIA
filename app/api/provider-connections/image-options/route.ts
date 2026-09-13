import {
  getOwnedProviderConnection,
  listOwnedProviderConnections,
} from "@/lib/provider-connections/store";
import { readExecutorImageOptions } from "@/lib/provider-connections/executor-client";
import { readRemoteExecutorImageOptions } from "@/lib/provider-connections/remote-image-options";
import {
  assertLocalConnectionsRequest,
  LocalConnectionsError,
  noStoreJson,
  sanitizeProviderMessage,
} from "@/lib/provider-connections/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeHostname(value: string) {
  const authority = value.trim().toLowerCase();
  const candidate = authority === "::1" ? `[${authority}]` : authority;
  try {
    return new URL(`http://${candidate}`).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return authority.replace(/^\[|\]$/g, "");
  }
}

function isLoopbackRequest(request: Request) {
  const url = new URL(request.url);
  if (!LOOPBACK_HOSTS.has(normalizeHostname(url.hostname))) return false;
  const host = request.headers.get("host");
  const normalizedHost = host ? normalizeHostname(host) : null;
  if (host && !LOOPBACK_HOSTS.has(normalizedHost!)) return false;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && normalizeHostname(forwardedHost) !== normalizedHost) return false;
  return true;
}

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
    if (!isLoopbackRequest(request)) {
      return noStoreJson(await readRemoteExecutorImageOptions());
    }
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
