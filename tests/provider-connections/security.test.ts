import { afterEach, describe, expect, it } from "vitest";

import { assertLocalConnectionsRequest, LocalConnectionsError, sanitizeProviderMessage } from "@/lib/provider-connections/security";

const previous = process.env.LABIA_LOCAL_CONNECTIONS_ENABLED;
afterEach(() => {
  if (previous === undefined) delete process.env.LABIA_LOCAL_CONNECTIONS_ENABLED;
  else process.env.LABIA_LOCAL_CONNECTIONS_ENABLED = previous;
});

describe("provider connection local access", () => {
  it("aceita localhost somente quando o gate está habilitado", () => {
    process.env.LABIA_LOCAL_CONNECTIONS_ENABLED = "true";
    const request = new Request("http://localhost:3000/api/provider-connections", { headers: { host: "localhost:3000" } });
    expect(() => assertLocalConnectionsRequest(request)).not.toThrow();
  });

  it("recusa host remoto mesmo com o gate habilitado", () => {
    process.env.LABIA_LOCAL_CONNECTIONS_ENABLED = "true";
    const request = new Request("https://labia.example/api/provider-connections", { headers: { host: "labia.example" } });
    expect(() => assertLocalConnectionsRequest(request)).toThrow(LocalConnectionsError);
  });

  it("redige tokens de mensagens de erro", () => {
    const clean = sanitizeProviderMessage("Bearer abc.def.ghi access_token=super-secret sk-this-should-never-leak /home/u/auth.json");
    expect(clean).not.toContain("super-secret");
    expect(clean).not.toContain("sk-this-should-never-leak");
    expect(clean).not.toContain("abc.def.ghi");
    expect(clean).toContain("[redacted]");
  });
});
