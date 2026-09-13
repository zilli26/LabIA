import { parseExecutorHeartbeat } from "@/lib/provider-connections/heartbeat";
import {
  authenticateExecutorPairing,
  ExecutorPairingError,
  recordExecutorHeartbeat,
  sanitizeExecutorPairingStatus,
} from "@/lib/provider-connections/pairing";
import { noStoreJson, sanitizeProviderMessage } from "@/lib/provider-connections/security";

const MAX_HEARTBEAT_BODY_BYTES = 16_384;

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : "";
}

async function readJsonBody(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > MAX_HEARTBEAT_BODY_BYTES) {
    throw new ExecutorPairingError("heartbeat_too_large", "Heartbeat excede o tamanho permitido.", 413);
  }

  const reader = request.body?.getReader();
  if (!reader) return JSON.parse("");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HEARTBEAT_BODY_BYTES) {
        await reader.cancel();
        throw new ExecutorPairingError("heartbeat_too_large", "Heartbeat excede o tamanho permitido.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function POST(request: Request) {
  let secret = "";
  try {
    const pairingId = request.headers.get("x-labia-executor-pairing-id")?.trim() ?? "";
    if (!pairingId) throw new ExecutorPairingError("unauthorized", "Não autorizado.", 401);
    secret = bearerToken(request);
    await authenticateExecutorPairing(pairingId, secret);
    const body = parseExecutorHeartbeat(await readJsonBody(request));
    const status = await recordExecutorHeartbeat({ pairingId, secret, heartbeat: body });
    return noStoreJson({ executor: sanitizeExecutorPairingStatus(status, [secret]) });
  } catch (error) {
    if (error instanceof ExecutorPairingError || (error && typeof error === "object" && "status" in error && "code" in error)) {
      const typed = error as { code: string; message: string; status: number };
      return noStoreJson({ error: { code: sanitizeProviderMessage(typed.code, [secret]), message: sanitizeProviderMessage(typed.message, [secret]) } }, { status: typed.status });
    }
    return noStoreJson({ error: { code: "invalid_heartbeat", message: sanitizeProviderMessage(error, [secret]) } }, { status: 400 });
  }
}
