import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { formatStagingReadinessReport } from "@/scripts/check-staging-readiness";

describe("staging readiness script", () => {
  it("prints presence and safe statuses, never values or an execution command", () => {
    const report = formatStagingReadinessReport({
      executionAllowed: false,
      overall: "not_ready",
      environment: { databaseUrl: { configured: true }, directUrl: { configured: false }, ownerId: { configured: true }, storage: { supabaseUrl: { configured: true }, serviceRoleKey: { configured: true }, assetsBucket: { configured: false } } },
      database: { status: "unavailable", executorPairingTable: "unknown", message: "Banco indisponível." },
      executor: { status: "offline", ttlMs: 90000, lastSeenAt: null, message: "executor pareado offline." },
      worker: { status: "not_proven", message: "Worker não comprovado; valide-o separadamente no staging." },
    });

    expect(report).toContain("DATABASE_URL: configurada");
    expect(report).toContain("DIRECT_URL: ausente");
    expect(report).toContain("Worker não comprovado");
    expect(report).not.toMatch(/https?:\/\/|token|secret|execute|gerar/i);
  });
});
