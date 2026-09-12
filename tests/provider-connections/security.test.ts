import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assertLocalConnectionsRequest, LocalConnectionsError, noStoreJson, sanitizeProviderMessage } from "@/lib/provider-connections/security";

const previousEnabled = process.env.LABIA_LOCAL_CONNECTIONS_ENABLED;
const previousToken = process.env.LABIA_LOCAL_CONNECTIONS_TOKEN;
const token = "local-review-token-1234567890-abcdefgh";

beforeEach(() => {
  process.env.LABIA_LOCAL_CONNECTIONS_ENABLED = "true";
  process.env.LABIA_LOCAL_CONNECTIONS_TOKEN = token;
});

afterEach(() => {
  if (previousEnabled === undefined) delete process.env.LABIA_LOCAL_CONNECTIONS_ENABLED;
  else process.env.LABIA_LOCAL_CONNECTIONS_ENABLED = previousEnabled;
  if (previousToken === undefined) delete process.env.LABIA_LOCAL_CONNECTIONS_TOKEN;
  else process.env.LABIA_LOCAL_CONNECTIONS_TOKEN = previousToken;
});

function localRequest(headers: Record<string, string> = {}, method = "GET") {
  return new Request("http://localhost:3000/api/provider-connections", {
    method,
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      "x-labia-local-token": token,
      ...headers,
    },
  });
}

describe("provider connection local access", () => {
  it("aceita apenas loopback same-origin com token local", () => {
    expect(() => assertLocalConnectionsRequest(localRequest())).not.toThrow();
  });

  it("recusa token ausente ou incorreto", () => {
    expect(() => assertLocalConnectionsRequest(localRequest({ "x-labia-local-token": "wrong-token" }))).toThrow(LocalConnectionsError);
    const request = new Request("http://localhost:3000/api/provider-connections", {
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    });
    expect(() => assertLocalConnectionsRequest(request)).toThrowError(/Token local/);
  });

  it("recusa outra origem local mesmo conhecendo host e token", () => {
    expect(() => assertLocalConnectionsRequest(localRequest({ origin: "http://127.0.0.1:4000" }))).toThrowError(/origem/i);
  });

  it("não confia em x-forwarded-host para transformar host remoto em local", () => {
    const request = new Request("http://evil.example/api/provider-connections", {
      headers: {
        host: "evil.example",
        "x-forwarded-host": "localhost:3000",
        origin: "http://evil.example",
        "x-labia-local-token": token,
      },
    });
    expect(() => assertLocalConnectionsRequest(request)).toThrowError(/LabIA local/);
  });

  it("recusa x-forwarded-host mesmo numa URL loopback", () => {
    expect(() => assertLocalConnectionsRequest(localRequest({ "x-forwarded-host": "localhost:3000" }))).toThrowError(/LabIA local/);
  });

  it("aceita GET sem Origin, mas exige Origin exata em método mutável", () => {
    expect(() => assertLocalConnectionsRequest(localRequest({ origin: "" }))).not.toThrow();
    expect(() => assertLocalConnectionsRequest(localRequest({ origin: "" }, "POST"))).toThrowError(/origem/i);
  });

  it("recusa porta diferente e Host duplicado", () => {
    expect(() => assertLocalConnectionsRequest(localRequest({ host: "localhost:4317" }))).toThrowError(/LabIA local/);
    expect(() => assertLocalConnectionsRequest(localRequest({ host: "localhost:3000, localhost:4317" }))).toThrowError(/LabIA local/);
  });

  it("marca respostas sensíveis como privadas e não armazenáveis", async () => {
    const response = noStoreJson({ ok: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("redige tokens de mensagens de erro", () => {
    const clean = sanitizeProviderMessage("Bearer abc.def.ghi access_token=super-secret sk-this-should-never-leak /home/u/auth.json");
    expect(clean).not.toContain("super-secret");
    expect(clean).not.toContain("sk-this-should-never-leak");
    expect(clean).not.toContain("abc.def.ghi");
    expect(clean).toContain("[redacted]");
  });
});
