import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const LOCAL_TOKEN_HEADER = "x-labia-local-token";
const LOCAL_SESSION_COOKIE = "labia_provider_session";
const LOCAL_SESSION_TTL_SECONDS = 5 * 60;

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

export function getLocalConnectionsToken() {
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

function assertLocalRequestOrigin(request: Request) {
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
  const forwardedHostHeader = request.headers.get("x-forwarded-host");
  const forwardedHost = forwardedHostHeader === null
    ? null
    : parseHostAuthority(forwardedHostHeader, requestUrl.protocol);
  const urlHost = requestUrl.hostname.toLowerCase();

  if (
    !host ||
    !LOOPBACK_HOSTS.has(host.hostname) ||
    !LOOPBACK_HOSTS.has(urlHost) ||
    host.hostname !== urlHost ||
    host.origin !== requestUrl.origin.toLowerCase() ||
    (forwardedHostHeader !== null && (
      !forwardedHost ||
      !LOOPBACK_HOSTS.has(forwardedHost.hostname) ||
      forwardedHost.hostname !== host.hostname ||
      forwardedHost.origin !== host.origin
    ))
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
}

function signLocalSession(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    if (entry.slice(0, separator).trim() === name) return entry.slice(separator + 1).trim();
  }
  return null;
}

function hasValidLocalSession(request: Request, secret: string) {
  const value = readCookie(request, LOCAL_SESSION_COOKIE);
  if (value === null) return null;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expectedSignature = signLocalSession(payload, secret);
  if (!safeEqual(signature, expectedSignature)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown; nonce?: unknown };
    return typeof decoded.exp === "number" && decoded.exp > Math.floor(Date.now() / 1000) && typeof decoded.nonce === "string";
  } catch {
    return false;
  }
}

export function createLocalSessionSetCookie(now = Date.now()) {
  const secret = getLocalConnectionsToken();
  const expiresAt = Math.floor(now / 1000) + LOCAL_SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt, nonce: randomBytes(24).toString("base64url") })).toString("base64url");
  const value = `${payload}.${signLocalSession(payload, secret)}`;
  const expires = new Date(expiresAt * 1000).toUTCString();
  return `${LOCAL_SESSION_COOKIE}=${value}; Max-Age=${LOCAL_SESSION_TTL_SECONDS}; Expires=${expires}; Path=/api/provider-connections; HttpOnly; SameSite=Strict`;
}

export function assertLocalSessionBootstrapRequest(request: Request) {
  assertLocalRequestOrigin(request);
  getLocalConnectionsToken();
}

export function assertLocalConnectionsRequest(request: Request) {
  assertLocalRequestOrigin(request);

  const secret = getLocalConnectionsToken();
  const session = hasValidLocalSession(request, secret);
  if (session === true) return;
  if (session === false) {
    throw new LocalConnectionsError(
      "local_session_invalid",
      "Sessão local ausente, inválida ou expirada.",
      401,
    );
  }

  const suppliedToken = request.headers.get(LOCAL_TOKEN_HEADER)?.trim() ?? "";
  if (!suppliedToken || !safeEqual(suppliedToken, secret)) {
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
