import { assertLocalSessionBootstrapRequest, createLocalSessionSetCookie, LocalConnectionsError, noStoreJson, sanitizeProviderMessage } from "@/lib/provider-connections/security";

export async function POST(request: Request) {
  try {
    assertLocalSessionBootstrapRequest(request);
    const headers = new Headers({
      "Cache-Control": "private, no-store, max-age=0",
      "Set-Cookie": createLocalSessionSetCookie(),
    });
    return new Response(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof LocalConnectionsError) {
      return noStoreJson({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return noStoreJson({ error: { code: "local_session_failed", message: sanitizeProviderMessage(error) } }, { status: 503 });
  }
}
