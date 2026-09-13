import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(),
  pairingFindFirst: vi.fn(),
  executeRaw: vi.fn(),
  transaction: vi.fn(),
  createExecutorPairing: vi.fn(),
  getLocalOwnerId: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspace: { findUnique: mocks.workspaceFindUnique },
    executorPairing: { findFirst: mocks.pairingFindFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/provider-connections/pairing", () => ({
  createExecutorPairingWithClient: mocks.createExecutorPairing,
}));
vi.mock("@/lib/provider-connections/security", () => ({
  getLocalOwnerId: mocks.getLocalOwnerId,
}));

import {
  formatProvisionedPairing,
  parseProvisionArgs,
  PROVISION_CONFIRMATION,
  provisionExecutorPairing,
} from "@/scripts/provision-executor-pairing";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DEFAULT_WORKSPACE_SLUG", "staging-workspace");
  mocks.getLocalOwnerId.mockReturnValue("owner-staging");
  mocks.workspaceFindUnique.mockResolvedValue({ id: "workspace-staging" });
  mocks.pairingFindFirst.mockResolvedValue(null);
  mocks.createExecutorPairing.mockResolvedValue({ pairingId: "pairing-staging-1" });
  mocks.executeRaw.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (callback) => callback({
    $executeRaw: mocks.executeRaw,
    executorPairing: { findFirst: mocks.pairingFindFirst },
  }));
});

describe("provisionamento local do ExecutorPairing", () => {
  it("recusa sem confirmacao explicita antes de ler ou escrever no banco", async () => {
    await expect(provisionExecutorPairing({ confirmation: "" })).rejects.toMatchObject({ code: "confirmation_required" });
    expect(mocks.getLocalOwnerId).not.toHaveBeenCalled();
    expect(mocks.workspaceFindUnique).not.toHaveBeenCalled();
    expect(mocks.createExecutorPairing).not.toHaveBeenCalled();
  });

  it("resolve owner/workspace local, gera segredo forte e cria apenas com hash via helper", async () => {
    const result = await provisionExecutorPairing({
      confirmation: PROVISION_CONFIRMATION,
      label: "Executor staging",
    });

    expect(mocks.workspaceFindUnique).toHaveBeenCalledWith({
      where: { slug: "staging-workspace" },
      select: { id: true },
    });
    expect(mocks.pairingFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: "owner-staging", workspaceId: "workspace-staging", status: "active" },
      select: { id: true, label: true },
    }));
    expect(mocks.createExecutorPairing).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      ownerId: "owner-staging",
      workspaceId: "workspace-staging",
      label: "Executor staging",
      secret: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    }));
    expect(result.pairingId).toBe("pairing-staging-1");
  });

  it("bloqueia pairing ativo existente sem flag e permite somente um novo pairing com flag explicita", async () => {
    mocks.pairingFindFirst.mockResolvedValue({ id: "pairing-old", label: "Executor antigo" });

    await expect(provisionExecutorPairing({ confirmation: PROVISION_CONFIRMATION }))
      .rejects.toMatchObject({ code: "existing_pairing" });
    expect(mocks.createExecutorPairing).not.toHaveBeenCalled();

    await expect(provisionExecutorPairing({
      confirmation: PROVISION_CONFIRMATION,
      allowExistingPairing: true,
    })).resolves.toMatchObject({ pairingId: "pairing-staging-1" });
    expect(mocks.createExecutorPairing).toHaveBeenCalledTimes(1);
  });

  it("adquire lock deterministico antes de ler e cria pelo TransactionClient protegido", async () => {
    const events: string[] = [];
    const transactionClient = {
      $executeRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
        events.push("lock");
        expect(Array.from(strings)).toEqual([
          "SELECT pg_advisory_xact_lock(hashtext(",
          "), hashtext(",
          "))",
        ]);
        expect(values).toEqual(["owner-staging", "workspace-staging"]);
      }),
      executorPairing: {
        findFirst: vi.fn(async () => {
          events.push("find");
          return null;
        }),
      },
    };
    mocks.transaction.mockImplementation(async (callback) => callback(transactionClient));
    mocks.createExecutorPairing.mockImplementation(async (client) => {
      events.push("create");
      expect(client).toBe(transactionClient);
      return { pairingId: "pairing-locked-1" };
    });

    await provisionExecutorPairing({ confirmation: PROVISION_CONFIRMATION });

    expect(transactionClient.$executeRaw).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["lock", "find", "create"]);
  });

  it("parseia somente confirmacao, label e flag conhecida", async () => {
    expect(parseProvisionArgs(["--confirm", PROVISION_CONFIRMATION, "--label", "Executor staging", "--allow-existing-pairing"]))
      .toEqual({ confirmation: PROVISION_CONFIRMATION, label: "Executor staging", allowExistingPairing: true });
    await expect(provisionExecutorPairing({ confirmation: "wrong" })).rejects.toMatchObject({ code: "confirmation_required" });
    expect(() => parseProvisionArgs(["--unknown"])).toThrow(/argumento/i);
  });

  it("formata somente ID/segredo uma vez e nao ecoa URLs ou tokens", () => {
    const output = formatProvisionedPairing({ pairingId: "pairing-1", secret: "secret-value" });
    expect(output).toContain("LABIA_EXECUTOR_PAIRING_ID=pairing-1");
    expect(output).toContain("LABIA_EXECUTOR_PAIRING_SECRET=secret-value");
    expect(output).not.toMatch(/DATABASE_URL|DIRECT_URL|SUPABASE|Bearer|token/i);
    expect(output.match(/LABIA_EXECUTOR_PAIRING_SECRET/g)).toHaveLength(1);
  });

  it("serializa duas provisoes simultaneas e rejeita a segunda sem revelar segredo", async () => {
    let locked = false;
    const waiters: Array<() => void> = [];
    const rows: Array<{ ownerId: string; workspaceId: string }> = [];

    const acquire = async () => {
      if (!locked) {
        locked = true;
        return;
      }
      await new Promise<void>((resolve) => waiters.push(resolve));
      locked = true;
    };
    const release = () => {
      locked = false;
      waiters.shift()?.();
    };

    mocks.transaction.mockImplementation(async (callback) => {
      await acquire();
      try {
        const tx = {
          $executeRaw: vi.fn(async () => undefined),
          executorPairing: {
            findFirst: vi.fn(async ({ where }: { where: { ownerId: string; workspaceId: string } }) =>
              rows.some((row) => row.ownerId === where.ownerId && row.workspaceId === where.workspaceId)
                ? { id: "pairing-existing", label: "Executor concorrente" }
                : null),
          },
        };
        return await callback(tx);
      } finally {
        release();
      }
    });
    mocks.createExecutorPairing.mockImplementation(async (_tx, input) => {
      rows.push({ ownerId: input.ownerId, workspaceId: input.workspaceId });
      return { pairingId: "pairing-concurrent-1" };
    });

    const results = await Promise.allSettled([
      provisionExecutorPairing({ confirmation: PROVISION_CONFIRMATION }),
      provisionExecutorPairing({ confirmation: PROVISION_CONFIRMATION }),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(mocks.createExecutorPairing).toHaveBeenCalledTimes(1);
    expect(rejected[0]).toMatchObject({ status: "rejected", reason: { code: "existing_pairing" } });
    expect(JSON.stringify(rejected[0])).not.toMatch(/secret|token|Bearer|DATABASE_URL/i);
  });
});
