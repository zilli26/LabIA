import { NextResponse, type NextRequest } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import {
  createOpenAIConnection,
  listOpenAIConnections,
} from "@/lib/providers/openai-codex/connection-service";
import { checkLocalProviderAccess } from "@/lib/providers/local-provider-access";

export const dynamic = "force-dynamic";

function accessError(request: NextRequest) {
  const access = checkLocalProviderAccess(request);
  if (access.ok) {
    return null;
  }

  return NextResponse.json({ error: access.code }, { status: access.status });
}

export async function GET(request: NextRequest) {
  const blocked = accessError(request);
  if (blocked) return blocked;

  if (!hasDatabaseEnv()) {
    return NextResponse.json(
      { error: "database_not_configured" },
      { status: 503 },
    );
  }

  try {
    return NextResponse.json({ connections: await listOpenAIConnections() });
  } catch {
    return NextResponse.json(
      { error: "provider_connections_unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const blocked = accessError(request);
  if (blocked) return blocked;

  if (!hasDatabaseEnv()) {
    return NextResponse.json(
      { error: "database_not_configured" },
      { status: 503 },
    );
  }

  try {
    const existing = await listOpenAIConnections();
    if (existing.length > 0) {
      return NextResponse.json({ connection: existing[0] });
    }

    return NextResponse.json(
      { connection: await createOpenAIConnection() },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "provider_connection_create_failed" },
      { status: 503 },
    );
  }
}
