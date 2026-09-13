import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pairingFindUnique: vi.fn(),
  pairingFindMany: vi.fn(),
  pairingCreate: vi.fn(),
  pairingUpdateMany: vi.fn(),
  connectionFindMany: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    executorPairing: {
      findUnique: mocks.pairingFindUnique,
      findMany: mocks.pairingFindMany,
      create: mocks.pairingCreate,
      updateMany: mocks.pairingUpdateMany,
    },
    providerConnection: {
      findMany: mocks.connectionFindMany,
    },
  },
}));

import {
  createExecutorPairing,
  getExecutorPairingStatus,
  hashExecutorPairingSecret,
  recordExecutorHeartbeat,
  type ExecutorHeartbeat,
} from "@/lib/provider-connections/pairing";

const secret = "executor-pairing-secret-1234567890-abcdefgh";
const basePairing = {
  id: "pairing-1",
  workspaceId: "workspace-a",
  ownerId: "owner-a",
  label: "Executor Felipe",
  secretHash: hashExecutorPairingSecret(secret),
  status: "active",
  executorVersion: null,
  state: "offline",
  lastSeenAt: null,
  lastSequence: BigInt(0),
  snapshot: null,
  createdAt: new Date("2026-09-13T10:00:00.000Z"),
  updatedAt: new Date("2026-09-13T10:00:00.000Z"),
};
const heartbeat: ExecutorHeartbeat = {
  sequence: 1,
  executorVersion: "0.5.0",
  state: "online",
  connections: [
    {
      connectionId: "connection-a",
      provider: "openai",
      authStatus: "connected",
      executorStatus: "online",
      capabilities: [{ key: "image_generation", status: "available" }],
      models: [{ id: "gpt-image-1", name: "GPT Image", kind: "image" }],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("executor pairing", () => {
  it("persiste somente o hash do segredo e nunca o plaintext", async () => {
    mocks.pairingCreate.mockResolvedValue({ ...basePairing });

    await createExecutorPairing({
      workspaceId: "workspace-a",
      ownerId: "owner-a",
      label: "Executor Felipe",
      secret,
    });

    const data = mocks.pairingCreate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.secretHash).not.toBe(secret);
    expect(JSON.stringify(data)).not.toContain(secret);
  });

  it("rejeita segredo errado sem revelar se o pareamento existe", async () => {
    mocks.pairingFindUnique.mockResolvedValue(basePairing);

    await expect(recordExecutorHeartbeat({ pairingId: "pairing-1", secret: "wrong-secret", heartbeat }))
      .rejects.toMatchObject({ code: "unauthorized", status: 401 });
    expect(mocks.pairingUpdateMany).not.toHaveBeenCalled();
  });

  it("não aceita conexão de outro owner/workspace mesmo com segredo válido", async () => {
    mocks.pairingFindUnique.mockResolvedValue(basePairing);
    mocks.connectionFindMany.mockResolvedValue([]);

    await expect(recordExecutorHeartbeat({ pairingId: "pairing-1", secret, heartbeat }))
      .rejects.toMatchObject({ code: "heartbeat_scope_mismatch", status: 403 });
    expect(mocks.connectionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: "workspace-a", ownerId: "owner-a" }),
    }));
    expect(mocks.pairingUpdateMany).not.toHaveBeenCalled();
  });

  it("persiste estado, lastSeen e snapshot seguro para leitura no control-plane", async () => {
    mocks.pairingFindUnique.mockResolvedValue(basePairing);
    mocks.connectionFindMany.mockResolvedValue([{ id: "connection-a", provider: "openai" }]);
    mocks.pairingUpdateMany.mockResolvedValue({ count: 1 });

    const result = await recordExecutorHeartbeat({
      pairingId: "pairing-1",
      secret,
      heartbeat,
      now: new Date("2026-09-13T10:01:00.000Z"),
    });

    expect(mocks.pairingUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "pairing-1", lastSequence: { lt: BigInt(1) } }),
      data: expect.objectContaining({
        executorVersion: "0.5.0",
        state: "online",
        lastSeenAt: new Date("2026-09-13T10:01:00.000Z"),
      }),
    }));
    const updateData = mocks.pairingUpdateMany.mock.calls[0][0].data as Record<string, unknown>;
    expect(updateData.lastSequence).toBe(BigInt(1));
    expect(JSON.stringify({ ...updateData, lastSequence: String(updateData.lastSequence) })).not.toContain(secret);
    expect(result.status).toBe("online");
    expect(result.snapshot).not.toBeNull();
    expect(result.snapshot?.connections[0].models[0].id).toBe("gpt-image-1");
  });

  it("rejeita sequence repetida ou menor sem aceitar replay", async () => {
    mocks.pairingFindUnique.mockResolvedValue({ ...basePairing, lastSequence: BigInt(5) });
    mocks.connectionFindMany.mockResolvedValue([{ id: "connection-a", provider: "openai" }]);
    mocks.pairingUpdateMany.mockResolvedValue({ count: 0 });

    await expect(recordExecutorHeartbeat({ pairingId: "pairing-1", secret, heartbeat: { ...heartbeat, sequence: 5 } }))
      .rejects.toMatchObject({ code: "heartbeat_replay", status: 409 });
    await expect(recordExecutorHeartbeat({ pairingId: "pairing-1", secret, heartbeat: { ...heartbeat, sequence: 4 } }))
      .rejects.toMatchObject({ code: "heartbeat_replay", status: 409 });
    expect(mocks.pairingUpdateMany).toHaveBeenCalledTimes(2);
  });

  it("redige segredos do snapshot antes da persistencia", async () => {
    mocks.pairingFindUnique.mockResolvedValue(basePairing);
    mocks.connectionFindMany.mockResolvedValue([{ id: "connection-a", provider: "openai" }]);
    mocks.pairingUpdateMany.mockResolvedValue({ count: 1 });
    const unsafeHeartbeat = {
      ...heartbeat,
      connections: [{
        ...heartbeat.connections[0],
        capabilities: [{ key: "image_generation", status: "available" as const, evidence: `Bearer ${secret} sk-1234567890 token=${secret} Cookie: sid=${secret}` }],
      }],
    };
    const result = await recordExecutorHeartbeat({ pairingId: "pairing-1", secret, heartbeat: unsafeHeartbeat });
    const persisted = mocks.pairingUpdateMany.mock.calls[0][0].data.snapshot;
    const serialized = JSON.stringify(persisted);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._~+/=-]+/i);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9_-]{10,}/);
    expect(serialized).toContain("token=[redacted]");
    expect(serialized).toContain("Cookie=[redacted]");
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("deriva offline quando lastSeen ultrapassa o TTL", async () => {
    mocks.pairingFindUnique.mockResolvedValue({
      ...basePairing,
      state: "online",
      executorVersion: "0.5.0",
      lastSeenAt: new Date("2026-09-13T09:58:00.000Z"),
      snapshot: { ...heartbeat, receivedAt: "2026-09-13T09:58:00.000Z" },
    });

    const result = await getExecutorPairingStatus({
      pairingId: "pairing-1",
      secret,
      now: new Date("2026-09-13T10:01:00.000Z"),
    });

    expect(result.status).toBe("offline");
    expect(result.lastSeenAt).toBe("2026-09-13T09:58:00.000Z");
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain("secretHash");
  });
});
