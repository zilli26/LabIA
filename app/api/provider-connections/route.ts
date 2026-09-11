import { NextResponse } from "next/server";

import { createOrGetOpenAiConnection, listOwnedProviderConnections } from "@/lib/provider-connections/store";
import { assertLocalConnectionsRequest, LocalConnectionsError, sanitizeProviderMessage } from "@/lib/provider-connections/security";

function failure(error: unknown) {
  if (error instanceof LocalConnectionsError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  return NextResponse.json(
    { error: { code: "provider_connections_error", message: sanitizeProviderMessage(error) } },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    assertLocalConnectionsRequest(request);
    return NextResponse.json({ connections: await listOwnedProviderConnections() });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    assertLocalConnectionsRequest(request);
    return NextResponse.json({ connection: await createOrGetOpenAiConnection() }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
