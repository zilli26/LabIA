import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pairingFindFirst: vi.fn(),
  connectionFindMany: vi.fn(),
  ensureDefaultWorkspace: vi.fn(),
  getLocalOwnerId: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    executorPairing: { findFirst: mocks.pairingFindFirst },
    providerConnection: { findMany: mocks.connectionFindMany },
  },
}));
vi.mock("@/lib/db/flows", () => ({ ensureDefaultWorkspace: mocks.ensureDefaultWorkspace }));
vi.mock("@/lib/provider-connections/security", () => ({
  getLocalOwnerId: mocks.getLocalOwnerId,
  sanitizePublicText: (value: string) => value,
}));

import { readRemoteExecutorImageOptions } from "@/lib/provider-connections/remote-image-options";

const now = new Date("2026-09-13T10:01:00.000Z");
const snapshot = {
  sequence: 1,
  executorVersion: "0.5.0",
  state: "online",
  receivedAt: "2026-09-13T10:00:30.000Z",
  connections: [
    {
      connectionId: "owned-connection",
      provider: "openai",
      authStatus: "connected",
      executorStatus: "online",
      capabilities: [{ key: "image_generation", status: "available", evidence: "Codex" }],
      models: [
        { id: "gpt-image-1", name: "Imagem aprovada", kind: "image" },
        { id: "text-model", name: "Texto", kind: "text" },
      ],
    },
    {
      connectionId: "foreign-connection",
      provider: "openai",
      authStatus: "connected",
      executorStatus: "online",
      capabilities: [{ key: "image_generation", status: "available" }],
      models: [{ id: "foreign-image", name: "Fora do owner", kind: "image" }],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.ensureDefaultWorkspace.mockResolvedValue({ id: "workspace-owned" });
  mocks.getLocalOwnerId.mockReturnValue("owner-owned");
  mocks.pairingFindFirst.mockResolvedValue({
    id: "pairing-1",
    state: "online",
    lastSeenAt: new Date("2026-09-13T10:00:30.000Z"),
    snapshot,
  });
  mocks.connectionFindMany.mockResolvedValue([
    { id: "owned-connection", label: "ChatGPT", planType: "plus" },
  ]);
});

describe("remote executor image snapshot", () => {
  it("applies TTL, owner/workspace scope, capability and image-model gates", async () => {
    const result = await readRemoteExecutorImageOptions(now);

    expect(result).toEqual({
      executor: { status: "online", lastSeenAt: "2026-09-13T10:00:30.000Z" },
      connections: [{
        id: "owned-connection",
        label: "ChatGPT",
        planType: "plus",
        models: [{ id: "gpt-image-1", name: "Imagem aprovada" }],
      }],
    });
    expect(mocks.pairingFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: "owner-owned", workspaceId: "workspace-owned", status: "active" },
    }));
    expect(mocks.connectionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ownerId: "owner-owned", workspaceId: "workspace-owned", id: { in: ["owned-connection", "foreign-connection"] } }),
    }));
    expect(JSON.stringify(result)).not.toContain("foreign-image");
  });

  it.each([
    { label: "sem pareamento", pairing: null },
    { label: "TTL vencido", pairing: { state: "online", lastSeenAt: new Date("2026-09-13T09:58:00.000Z"), snapshot } },
    { label: "snapshot ausente", pairing: { state: "online", lastSeenAt: new Date("2026-09-13T10:00:30.000Z"), snapshot: null } },
  ])("retorna offline quando está $label", async ({ pairing }) => {
    mocks.pairingFindFirst.mockResolvedValue(pairing);

    await expect(readRemoteExecutorImageOptions(now)).resolves.toEqual({
      executor: { status: "offline", message: "executor pareado offline: snapshot indisponível." },
      connections: [],
    });
    expect(mocks.connectionFindMany).not.toHaveBeenCalled();
  });
});
