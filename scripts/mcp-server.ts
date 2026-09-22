#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createLabiaMcpServer } from "@/lib/mcp/server";

async function main() {
  const server = createLabiaMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LabIA MCP local server running on stdio; execution tools are disabled.");
}

main().catch((error) => {
  console.error("LabIA MCP server error:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
