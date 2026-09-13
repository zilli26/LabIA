import {
  parseExecutorHeartbeat,
  sanitizeExecutorHeartbeat,
  type ExecutorHeartbeat,
} from "./heartbeat";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export class ExecutorControlPlaneError extends Error {
  constructor(public readonly code: "control_plane_url_invalid" | "control_plane_not_configured" | "control_plane_request_failed", message: string) {
    super(message);
    this.name = "ExecutorControlPlaneError";
  }
}

function controlPlaneUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ExecutorControlPlaneError("control_plane_url_invalid", "LABIA_CONTROL_PLANE_URL inválida.");
  }
  if (url.protocol !== "https:" || LOOPBACK_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password) {
    throw new ExecutorControlPlaneError("control_plane_url_invalid", "O control-plane precisa usar HTTPS público sem credenciais na URL.");
  }
  return url;
}

export async function sendExecutorHeartbeat(
  heartbeat: ExecutorHeartbeat,
  options?: {
    baseUrl?: string;
    pairingId?: string;
    pairingSecret?: string;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  },
) {
  const baseUrl = options?.baseUrl ?? process.env.LABIA_CONTROL_PLANE_URL?.trim();
  const pairingId = options?.pairingId ?? process.env.LABIA_EXECUTOR_PAIRING_ID?.trim();
  const pairingSecret = options?.pairingSecret ?? process.env.LABIA_EXECUTOR_PAIRING_SECRET?.trim();
  if (!baseUrl || !pairingId || !pairingSecret) {
    throw new ExecutorControlPlaneError("control_plane_not_configured", "Control-plane ou pareamento não configurado.");
  }
  const url = controlPlaneUrl(baseUrl);
  if (pairingSecret.length < 32) {
    throw new ExecutorControlPlaneError("control_plane_not_configured", "Segredo de pareamento inválido.");
  }
  const parsedHeartbeat = sanitizeExecutorHeartbeat(parseExecutorHeartbeat(heartbeat), [pairingSecret]);
  const target = new URL("/api/executors/heartbeat", url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 12_000);
  try {
    const response = await (options?.fetchImpl ?? fetch)(target, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        authorization: `Bearer ${pairingSecret}`,
        "content-type": "application/json",
        "x-labia-executor-pairing-id": pairingId,
      },
      body: JSON.stringify(parsedHeartbeat),
    });
    if (!response.ok) {
      throw new ExecutorControlPlaneError("control_plane_request_failed", `Control-plane respondeu HTTP ${response.status}.`);
    }
    return await response.json().catch(() => ({}));
  } catch (error) {
    if (error instanceof ExecutorControlPlaneError) throw error;
    throw new ExecutorControlPlaneError("control_plane_request_failed", "Não foi possível enviar o heartbeat ao control-plane.");
  } finally {
    clearTimeout(timer);
  }
}
