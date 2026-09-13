import { ExecutorPairingError, getExecutorPairingStatus, sanitizeExecutorPairingStatus } from "@/lib/provider-connections/pairing";
import { noStoreJson, sanitizeProviderMessage } from "@/lib/provider-connections/security";

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : "";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pairingId: string }> },
) {
  let secret = "";
  try {
    const { pairingId } = await params;
    secret = bearerToken(request);
    const executor = await getExecutorPairingStatus({ pairingId, secret });
    return noStoreJson({ executor: sanitizeExecutorPairingStatus(executor, [secret]) });
  } catch (error) {
    if (error instanceof ExecutorPairingError) {
      return noStoreJson({ error: { code: sanitizeProviderMessage(error.code, [secret]), message: sanitizeProviderMessage(error.message, [secret]) } }, { status: error.status });
    }
    return noStoreJson({ error: { code: "executor_status_failed", message: sanitizeProviderMessage(error, [secret]) } }, { status: 503 });
  }
}
