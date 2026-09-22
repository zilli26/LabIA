import { randomUUID } from "node:crypto";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createLabiaMcpServer } from "@/lib/mcp/server";

export const dynamic = "force-dynamic";

const sessions = new Map<
  string,
  {
    server: ReturnType<typeof createLabiaMcpServer>;
    transport: WebStandardStreamableHTTPServerTransport;
  }
>();

function json(body: Record<string, unknown>, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Last-Event-ID",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    },
  });
}

function authorized(request: Request) {
  const expected = process.env.LABIA_MCP_BEARER_TOKEN?.trim();
  if (!expected) return { ok: false, status: 503, code: "mcp_not_configured" } as const;

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${expected}`) {
    return { ok: false, status: 401, code: "mcp_unauthorized" } as const;
  }

  return { ok: true } as const;
}

async function getSession(request: Request) {
  const requestedSessionId = request.headers.get("mcp-session-id");
  if (requestedSessionId) {
    const existing = sessions.get(requestedSessionId);
    if (!existing) return null;
    return { id: requestedSessionId, ...existing };
  }

  const server = createLabiaMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: () => randomUUID(),
  });
  await server.connect(transport);

  return { id: undefined, server, transport };
}

async function handle(request: Request) {
  const access = authorized(request);
  if (!access.ok) {
    return json(
      {
        error: access.code,
        message:
          access.code === "mcp_not_configured"
            ? "O MCP remoto ainda não foi configurado pelo operador."
            : "Bearer token inválido.",
      },
      access.status,
    );
  }

  const session = await getSession(request);
  if (!session) return json({ error: "mcp_session_not_found" }, 404);

  const response = await session.transport.handleRequest(request);
  const sessionId = session.transport.sessionId ?? session.id;
  if (sessionId) sessions.set(sessionId, session);

  if (request.method === "DELETE" && sessionId) {
    sessions.delete(sessionId);
  }

  return response;
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function DELETE(request: Request) {
  return handle(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Last-Event-ID",
      "Access-Control-Allow-Methods": "DELETE, GET, OPTIONS, POST",
      "Access-Control-Expose-Headers": "Mcp-Session-Id",
    },
  });
}
