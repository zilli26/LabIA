import { NextResponse, type NextRequest } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import {
  cancelOpenAILogin,
  disconnectOpenAIConnection,
  reconnectOpenAIConnection,
  refreshOpenAIConnection,
  startOpenAILogin,
} from "@/lib/providers/openai-codex/connection-service";
import { checkLocalProviderAccess } from "@/lib/providers/local-provider-access";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ connectionId: string }>;
};

type ActionBody = {
  action?: unknown;
  loginType?: unknown;
};

export async function POST(request: NextRequest, context: RouteContext) {
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

  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { connectionId } = await context.params;

  try {
    switch (body.action) {
      case "login": {
        const loginType =
          body.loginType === "chatgpt" ? "chatgpt" : "chatgptDeviceCode";
        const result = await startOpenAILogin(connectionId, loginType);
        return NextResponse.json(result);
      }
      case "status":
        return NextResponse.json({
          connection: await refreshOpenAIConnection(connectionId),
        });
      case "cancel":
        return NextResponse.json({
          connection: await cancelOpenAILogin(connectionId),
        });
      case "disconnect":
        return NextResponse.json({
          connection: await disconnectOpenAIConnection(connectionId),
        });
      case "reconnect":
        return NextResponse.json({
          connection: await reconnectOpenAIConnection(connectionId),
        });
      default:
        return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: "provider_connection_action_failed" },
      { status: 503 },
    );
  }
}
