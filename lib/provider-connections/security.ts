const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export class LocalConnectionsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "LocalConnectionsError";
  }
}

function normalizeHost(value: string) {
  const first = value.split(",")[0]?.trim() ?? "";
  if (first.startsWith("[")) {
    const end = first.indexOf("]");
    return end >= 0 ? first.slice(1, end).toLowerCase() : first.toLowerCase();
  }
  return first.split(":")[0]?.toLowerCase() ?? "";
}

export function assertLocalConnectionsRequest(request: Request) {
  if (process.env.LABIA_LOCAL_CONNECTIONS_ENABLED !== "true") {
    throw new LocalConnectionsError(
      "local_connections_disabled",
      "Conexões locais estão desativadas neste ambiente.",
      404,
    );
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = normalizeHost(forwardedHost ?? request.headers.get("host") ?? "");
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new LocalConnectionsError(
      "local_only",
      "Esta operação só pode ser usada no LabIA local.",
      403,
    );
  }
}

export function getLocalOwnerId() {
  const ownerId = process.env.LABIA_LOCAL_OWNER_ID?.trim();
  if (!ownerId) {
    throw new LocalConnectionsError(
      "owner_not_configured",
      "LABIA_LOCAL_OWNER_ID não está configurado.",
      503,
    );
  }
  return ownerId;
}

export function getExecutorConfig() {
  const rawUrl = process.env.LABIA_PROVIDER_EXECUTOR_URL?.trim() || "http://127.0.0.1:4317";
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new LocalConnectionsError(
      "executor_not_loopback",
      "O executor de providers precisa usar HTTP em loopback.",
      503,
    );
  }

  const token = process.env.LABIA_PROVIDER_EXECUTOR_TOKEN?.trim();
  if (!token || token.length < 32) {
    throw new LocalConnectionsError(
      "executor_token_not_configured",
      "Configure LABIA_PROVIDER_EXECUTOR_TOKEN com pelo menos 32 caracteres.",
      503,
    );
  }

  return { url, token };
}

export function sanitizeProviderMessage(input: unknown) {
  const text = input instanceof Error ? input.message : String(input ?? "Erro desconhecido");
  return text
    .replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, "[redacted]")
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~-]+/gi, "$1[redacted]")
    .replace(/\b(access_token|refresh_token|id_token)\b\s*[:=]\s*[^\s,;}]+/gi, "$1=[redacted]")
    .replace(/([\\/])auth\.json\b/gi, "$1[credential-file]")
    .slice(0, 500);
}

export function isValidSessionRef(value: string) {
  return /^labia-codex:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
