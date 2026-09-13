import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  workspaceFindUnique: vi.fn(),
  pairingFindFirst: vi.fn(),
  getLocalOwnerId: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    workspace: { findUnique: mocks.workspaceFindUnique },
    executorPairing: { findFirst: mocks.pairingFindFirst },
  },
}));
vi.mock("@/lib/provider-connections/security", () => ({
  getLocalOwnerId: mocks.getLocalOwnerId,
}));

import { getStagingReadiness } from "@/lib/provider-connections/staging-readiness";

const NOW = new Date("2026-09-13T12:00:00.000Z");

function setConfiguredEnvironment() {
  vi.stubEnv("DATABASE_URL", "postgresql://user:***@db.example/staging");
  vi.stubEnv("DIRECT_URL", "postgresql://user:***@db.example/staging");
  vi.stubEnv("LABIA_LOCAL_OWNER_ID", "owner-owned");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://storage.example");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret");
  vi.stubEnv("SUPABASE_ASSETS_BUCKET", "assets");
}

function setUnconfiguredEnvironment() {
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("DIRECT_URL", "");
  vi.stubEnv("LABIA_LOCAL_OWNER_ID", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  vi.stubEnv("SUPABASE_ASSETS_BUCKET", "");
}

beforeEach(() => {
  vi.unstubAllEnvs();
  setUnconfiguredEnvironment();
  vi.clearAllMocks();
  mocks.workspaceFindUnique.mockResolvedValue({ id: "workspace-owned" });
  mocks.getLocalOwnerId.mockReturnValue("owner-owned");
  mocks.queryRaw.mockResolvedValue([{ ok: 1 }]);
  mocks.pairingFindFirst.mockResolvedValue(null);
});

describe("staging readiness", () => {
  it("reports environment absence without attempting a database connection", async () => {
    const result = await getStagingReadiness(NOW);

    expect(result.database).toMatchObject({ status: "env_not_configured", executorPairingTable: "not_checked" });
    expect(result.environment).toEqual({
      databaseUrl: { configured: false },
      directUrl: { configured: false },
      ownerId: { configured: false },
      storage: {
        supabaseUrl: { configured: false },
        serviceRoleKey: { configured: false },
        assetsBucket: { configured: false },
      },
    });
    expect(mocks.queryRaw).not.toHaveBeenCalled();
    expect(result.executionAllowed).toBe(false);
  });

  it("hides connection errors and never returns environment values or stack text", async () => {
    setConfiguredEnvironment();
    mocks.queryRaw.mockRejectedValue(new Error("postgresql://secret@db.example:5432/staging\nError: stack-secret"));

    const result = await getStagingReadiness(NOW);
    const serialized = JSON.stringify(result);

    expect(result.database).toMatchObject({ status: "unavailable", executorPairingTable: "unknown" });
    expect(serialized).not.toContain("postgresql://");
    expect(serialized).not.toContain("service-role-secret");
    expect(serialized).not.toContain("stack-secret");
  });

  it("reports a missing owner environment as env_not_configured before touching the database", async () => {
    setConfiguredEnvironment();
    vi.stubEnv("LABIA_LOCAL_OWNER_ID", "");

    const result = await getStagingReadiness(NOW);

    expect(result.environment.ownerId).toEqual({ configured: false });
    expect(result.database).toMatchObject({ status: "env_not_configured", executorPairingTable: "not_checked" });
    expect(result.executor.status).toBe("not_configured");
    expect(mocks.queryRaw).not.toHaveBeenCalled();
  });

  it("distinguishes the missing ExecutorPairing migration with a safe instruction", async () => {
    setConfiguredEnvironment();
    mocks.pairingFindFirst.mockRejectedValue({ code: "P2021", message: 'The table "public.ExecutorPairing" does not exist' });

    const result = await getStagingReadiness(NOW);

    expect(result.database).toMatchObject({ status: "migration_missing", executorPairingTable: "missing" });
    expect(result.database.message).toContain("migration");
    expect(JSON.stringify(result)).not.toContain("P2021");
  });

  it("does not label another missing table as an ExecutorPairing migration", async () => {
    setConfiguredEnvironment();
    vi.stubEnv("LABIA_LOCAL_OWNER_ID", "owner-owned");
    mocks.pairingFindFirst.mockRejectedValue({ code: "P2021", message: 'The table "public.workspaces" does not exist' });

    const result = await getStagingReadiness(NOW);

    expect(result.database).toMatchObject({ status: "unavailable", executorPairingTable: "unknown" });
    expect(result.database.message).not.toContain("ExecutorPairing");
  });

  it.each([
    { label: "offline por TTL", lastSeenAt: new Date("2026-09-13T11:57:00.000Z"), expected: "offline" },
    { label: "online dentro do TTL", lastSeenAt: new Date("2026-09-13T11:59:30.000Z"), expected: "online" },
  ])("classifica executor pareado $label", async ({ lastSeenAt, expected }) => {
    setConfiguredEnvironment();
    mocks.pairingFindFirst.mockResolvedValue({ state: "online", lastSeenAt });

    const result = await getStagingReadiness(NOW);

    expect(result.executor.status).toBe(expected);
    expect(result.executor.lastSeenAt).toBe(lastSeenAt.toISOString());
    expect(mocks.pairingFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: "owner-owned", workspaceId: "workspace-owned", status: "active" },
    }));
  });

  it("does not prove a worker or expose an execution action", async () => {
    setConfiguredEnvironment();
    mocks.pairingFindFirst.mockResolvedValue({ state: "online", lastSeenAt: new Date("2026-09-13T11:59:30.000Z") });

    const result = await getStagingReadiness(NOW);

    expect(result.worker).toMatchObject({
      status: "not_proven",
      message: expect.stringContaining("Worker"),
    });
    expect(result.executionAllowed).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/run|execute|gerar/i);
  });
});
