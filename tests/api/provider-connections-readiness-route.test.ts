import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getStagingReadiness: vi.fn(),
}));

vi.mock("@/lib/provider-connections/staging-readiness", () => ({
  getStagingReadiness: mocks.getStagingReadiness,
}));
vi.mock("@/lib/provider-connections/security", () => ({
  noStoreJson: (body: unknown, init: ResponseInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("Cache-Control", "private, no-store, max-age=0");
    return Response.json(body, { ...init, headers });
  },
}));

import { GET } from "@/app/api/provider-connections/readiness/route";

describe("GET /api/provider-connections/readiness", () => {
  it("returns only a read-only readiness payload", async () => {
    mocks.getStagingReadiness.mockResolvedValue({
      executionAllowed: false,
      overall: "not_ready",
      environment: { databaseUrl: { configured: true }, directUrl: { configured: true }, storage: { supabaseUrl: { configured: true }, serviceRoleKey: { configured: true }, assetsBucket: { configured: true } } },
      database: { status: "available", executorPairingTable: "available", message: "Banco acessível." },
      executor: { status: "offline", ttlMs: 90000, lastSeenAt: null, message: "executor pareado offline." },
      worker: { status: "not_proven", message: "Worker não comprovado." },
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.executionAllowed).toBe(false);
    expect(payload.worker.status).toBe("not_proven");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("sanitizes unexpected failures without exposing URL, token or stack", async () => {
    mocks.getStagingReadiness.mockRejectedValue(new Error("https://db.example token=secret stack-secret"));

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      executionAllowed: false,
      overall: "unavailable",
      message: "Não foi possível consultar a prontidão de staging.",
    });
    expect(JSON.stringify(payload)).not.toMatch(/https?:\/\/|secret|stack/i);
  });
});
