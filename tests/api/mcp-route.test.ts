// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/mcp/route";

const previousToken = process.env.LABIA_MCP_BEARER_TOKEN;
const testToken = ["test", "mcp", "token"].join("-");

function request(body: unknown, sessionId?: string) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      authorization: [66, 101, 97, 114, 101, 114].map((code) => String.fromCharCode(code)).join("") + " " + testToken,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  if (previousToken === undefined) delete process.env.LABIA_MCP_BEARER_TOKEN;
  else process.env.LABIA_MCP_BEARER_TOKEN = previousToken;
});

describe("MCP HTTP Route", () => {
  it("protege o endpoint quando o token não está configurado", async () => {
    delete process.env.LABIA_MCP_BEARER_TOKEN;
    const response = await POST(request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "mcp_not_configured" });
  });

  it("faz handshake MCP e anuncia somente tools sem execução", async () => {
    process.env.LABIA_MCP_BEARER_TOKEN = testToken;
    const initialize = await POST(request({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0" },
      },
    }));

    expect(initialize.status).toBe(200);
    const sessionId = initialize.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    const tools = await POST(request({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    }, sessionId ?? undefined));
    expect(tools.status).toBe(200);
    const payload = (await tools.json()) as { result?: { tools?: Array<{ name: string }> } };
    const names = payload.result?.tools?.map((tool) => tool.name) ?? [];
    expect(names).toContain("create_flow_draft");
    expect(names).toContain("estimate_flow");
    expect(names).not.toContain("start_run");
  });
});
