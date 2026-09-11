import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findMany = vi.fn();
const create = vi.fn();
const updateMany = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    providerConnection: {
      findFirst,
      findMany,
      create,
      updateMany,
    },
  },
}));

vi.mock("@/lib/db/flows", () => ({
  ensureDefaultWorkspace: vi.fn(async () => ({ id: "ws-owned" })),
}));

import { getOwnedProviderConnection, markProviderConnectionAction } from "@/lib/provider-connections/store";

const row = {
  id: "connection-1",
  workspaceId: "ws-owned",
  ownerId: "owner-a",
  provider: "openai",
  label: "ChatGPT pessoal",
  authMethod: "chatgptDeviceCode",
  sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174000",
  authStatus: "disconnected",
  executorStatus: "offline",
  generationValidationStatus: "unvalidated",
  accountLabel: null,
  planType: null,
  loginId: null,
  loginExpiresAt: null,
  connectedAt: null,
  disconnectedAt: null,
  lastCheckedAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  createdAt: new Date("2026-09-11T12:00:00.000Z"),
  updatedAt: new Date("2026-09-11T12:00:00.000Z"),
  capabilities: [],
};

const previousOwner = process.env.LABIA_LOCAL_OWNER_ID;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.LABIA_LOCAL_OWNER_ID = "owner-a";
});

afterEach(() => {
  if (previousOwner === undefined) delete process.env.LABIA_LOCAL_OWNER_ID;
  else process.env.LABIA_LOCAL_OWNER_ID = previousOwner;
});

describe("provider connection ownership", () => {
  it("consulta por ID sempre inclui workspace e dono", async () => {
    findFirst.mockResolvedValue(row);
    await getOwnedProviderConnection("connection-1");
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "connection-1",
        workspaceId: "ws-owned",
        ownerId: "owner-a",
      },
    }));
  });

  it("mutação por ID inclui workspace e dono no próprio UPDATE", async () => {
    findFirst.mockResolvedValueOnce(row).mockResolvedValueOnce({ ...row, authStatus: "connecting" });
    updateMany.mockResolvedValue({ count: 1 });

    await markProviderConnectionAction("connection-1", {
      authStatus: "connecting",
      executorStatus: "online",
    });

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "connection-1",
        workspaceId: "ws-owned",
        ownerId: "owner-a",
      },
    }));
  });

  it("não muta quando a conexão não pertence ao escopo atual", async () => {
    findFirst.mockResolvedValue(null);
    const result = await markProviderConnectionAction("foreign-connection", {
      authStatus: "connecting",
      executorStatus: "online",
    });
    expect(result).toBeNull();
    expect(updateMany).not.toHaveBeenCalled();
  });
});
