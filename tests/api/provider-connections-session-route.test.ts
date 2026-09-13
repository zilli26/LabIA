import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as bootstrap } from "@/app/api/provider-connections/session/route";
import { assertLocalConnectionsRequest } from "@/lib/provider-connections/security";

const token = "local-review-token-1234567890-abcdefgh";
const previous = {
  enabled: process.env.LABIA_LOCAL_CONNECTIONS_ENABLED,
  token: process.env.LABIA_LOCAL_CONNECTIONS_TOKEN,
};

beforeEach(() => {
  process.env.LABIA_LOCAL_CONNECTIONS_ENABLED = "true";
  process.env.LABIA_LOCAL_CONNECTIONS_TOKEN = token;
});

afterEach(() => {
  vi.useRealTimers();
  if (previous.enabled === undefined) delete process.env.LABIA_LOCAL_CONNECTIONS_ENABLED;
  else process.env.LABIA_LOCAL_CONNECTIONS_ENABLED = previous.enabled;
  if (previous.token === undefined) delete process.env.LABIA_LOCAL_CONNECTIONS_TOKEN;
  else process.env.LABIA_LOCAL_CONNECTIONS_TOKEN = previous.token;
});

function request(headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/provider-connections/session", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      ...headers,
    },
  });
}

function cookieFrom(response: Response) {
  const value = response.headers.get("set-cookie");
  expect(value).toBeTruthy();
  return value!.split(";")[0]!;
}

describe("provider connection local session", () => {
  it("emite cookie opaco, HttpOnly, same-site, curto e sem o segredo", async () => {
    const response = await bootstrap(request());
    const setCookie = response.headers.get("set-cookie") ?? "";
    const body = await response.text();

    expect(response.status).toBe(204);
    expect(setCookie).toMatch(/labia_provider_session=\S+/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\/api\/provider-connections/i);
    expect(setCookie).toMatch(/Max-Age=(?:[1-9]\d{1,2}|[1-8]\d{2})/i);
    expect(setCookie).not.toContain(token);
    expect(body).not.toContain(token);
    expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  });

  it("autoriza rotas com cookie válido e recusa adulteração ou expiração", async () => {
    const response = await bootstrap(request());
    const cookie = cookieFrom(response);
    const authorized = new Request("http://localhost:3000/api/provider-connections", {
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
        cookie,
      },
    });
    expect(() => assertLocalConnectionsRequest(authorized)).not.toThrow();

    const tampered = `${cookie.slice(0, -1)}${cookie.endsWith("a") ? "b" : "a"}`;
    expect(() => assertLocalConnectionsRequest(new Request("http://localhost:3000/api/provider-connections", {
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "sec-fetch-site": "same-origin",
        cookie: tampered,
      },
    }))).toThrowError(/inválid|expirad/i);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 10 * 60 * 1000));
    expect(() => assertLocalConnectionsRequest(authorized)).toThrowError(/inválid|expirad/i);
  });

  it("não expõe o segredo em cookie, corpo ou headers públicos", async () => {
    const response = await bootstrap(request());
    expect(response.headers.get("set-cookie")).not.toContain(token);
    expect(response.headers.get("x-labia-local-token")).toBeNull();
    expect(await response.text()).not.toContain(token);
  });
});
