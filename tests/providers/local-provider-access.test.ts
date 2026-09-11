import { describe, expect, it } from "vitest";

import { checkLocalProviderAccess } from "../../lib/providers/local-provider-access";

function request(url: string, origin?: string) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return { url, headers };
}

describe("local provider access", () => {
  it("is disabled by default", () => {
    expect(checkLocalProviderAccess(request("http://localhost:3000/api/provider-connections"), {})).toMatchObject({
      ok: false,
      code: "local_oauth_disabled",
    });
  });

  it("allows explicit loopback access", () => {
    expect(
      checkLocalProviderAccess(
        request("http://127.0.0.1:3000/api/provider-connections", "http://localhost:3000"),
        { LABIA_LOCAL_OPENAI_OAUTH_ENABLED: "true" },
      ),
    ).toEqual({ ok: true });
  });

  it("rejects remote host/origin and Vercel", () => {
    const enabled = { LABIA_LOCAL_OPENAI_OAUTH_ENABLED: "true" };
    expect(
      checkLocalProviderAccess(
        request("https://labia.example/api/provider-connections"),
        enabled,
      ),
    ).toMatchObject({ ok: false, code: "local_only" });
    expect(
      checkLocalProviderAccess(
        request("http://localhost:3000/api/provider-connections", "https://evil.example"),
        enabled,
      ),
    ).toMatchObject({ ok: false, code: "local_only" });
    expect(
      checkLocalProviderAccess(
        request("http://localhost:3000/api/provider-connections"),
        { ...enabled, VERCEL: "1" },
      ),
    ).toMatchObject({ ok: false, code: "local_oauth_disabled" });
  });
});
