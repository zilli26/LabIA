import { timingSafeEqual } from "node:crypto";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_TOKEN_HEADER = "x-labia-local-token";

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

function parseHostAuthority(value: string, protocol: string) {
  const authority = value.trim();
  if (!authority || authority.includes(",") || /[\s/@]/.test(authority)) return null;
  try {
    const parsed = new URL(`${protocol}//${authority}`);
    return {
      hostname: parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase(),
      origin: parsed.origin.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getLocalConnectionsToken() {
  const token = process.env.LABIA_LOCAL_CONNECTIONS_TOKEN?.trim();
  if (!token || token.length < 32) {
    throw new LocalConnectionsError(
      "local_token_not_configured",
      "Configure LABIA_LOCAL_CONNECTIONS_TOKEN com pelo menos 32 caracteres.",
      503,
    );
  }
  return token;
}

export function assertLocalConnectionsRequest(request: Request) {
  if (process.env.LABIA_LOCAL_CONNECTIONS_ENABLED !== "true") {
    throw new LocalConnectionsError(
      "local_connections_disabled",
      "Conexões locais estão desativadas neste ambiente.",
      404,
    );
  }

  const requestUrl = new URL(request.url);
  const hostHeader = request.headers.get("host")?.trim() ?? "";
  const host = parseHostAuthority(hostHeader, requestUrl.protocol);
  const urlHost = requestUrl.hostname.toLowerCase();

  if (
    !host ||
    !LOOPBACK_HOSTS.has(host.hostname) ||
    !LOOPBACK_HOSTS.has(urlHost) ||
    host.hostname !== urlHost ||
    host.origin !== requestUrl.origin.toLowerCase() ||
    request.headers.has("x-forwarded-host")
  ) {
    throw new LocalConnectionsError(
      "local_only",
      "Esta operação só pode ser usada diretamente no LabIA local.",
      403,
    );
  }

  const origin = request.headers.get("origin");
  const originRequired = request.method !== "GET" && request.method !== "HEAD";
  if ((originRequired && !origin) || (origin && origin !== requestUrl.origin)) {
    throw new LocalConnectionsError(
      "origin_mismatch",
      "A origem da requisição não corresponde ao LabIA local.",
      403,
    );
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new LocalConnectionsError(
      "cross_origin_request",
      "Requisição cross-origin recusada.",
      403,
    );
  }

  const suppliedToken = request.headers.get(LOCAL_TOKEN_HEADER)?.trim() ?? "";
  const expectedToken = getLocalConnectionsToken();
  if (!suppliedToken || !safeEqual(suppliedToken, expectedToken)) {
    throw new LocalConnectionsError(
      "local_token_invalid",
      "Token local ausente ou inválido.",
      401,
    );
  }
}

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  return Response.json(body, { ...init, headers });
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
