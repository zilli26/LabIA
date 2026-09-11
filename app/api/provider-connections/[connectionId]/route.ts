import { NextResponse, type NextRequest } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { getOpenAIConnection } from "@/lib/providers/openai-codex/connection-service";
import { checkLocalProviderAccess } from "@/lib/providers/local-provider-access";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ connectionId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const access = checkLocalProviderAccess(request);
  if (!access.ok) {
    return NextResponse.json({ error: access.code }, { status: access.status });
  }

  if (!hasDatabaseEnv()) {
    return NextResponse.json(
      { error: "database_not_configured" },
      { status: 503 },
    );
  }

  try {
    const { connectionId } = await context.params;
    return NextResponse.json({ connection: await getOpenAIConnection(connectionId) });
  } catch {
    return NextResponse.json(
      { error: "provider_connection_not_found" },
      { status: 404 },
    );
  }
}
