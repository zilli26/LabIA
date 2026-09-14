import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.hoisted(() => vi.fn());
const mockGetOwnedExecutionScope = vi.hoisted(() => vi.fn());
const mockSerializeFlowRun = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    flowRun: {
      findFirst: mockFindFirst,
    },
  },
}));

vi.mock("@/lib/flows/ownership", () => ({
  assertOwnedFlowBrand: vi.fn(),
  getOwnedExecutionScope: mockGetOwnedExecutionScope,
  getOwnedFlow: vi.fn(),
}));

vi.mock("@/lib/flows/serialization", () => ({
  serializeFlowRun: mockSerializeFlowRun,
}));

import { getLatestFlowRun } from "@/lib/flows/runner";

describe("latest FlowRun lookup", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockSerializeFlowRun.mockReset();
    mockGetOwnedExecutionScope.mockResolvedValue({
      ownerId: "owner-1",
      workspaceId: "workspace-1",
    });
    mockSerializeFlowRun.mockReturnValue({ id: "run-1" });
  });

  it("consulta somente o FlowRun mais recente do workspace autorizado", async () => {
    const run = { id: "run-1", flowId: "flow-1", workspaceId: "workspace-1" };
    mockFindFirst.mockResolvedValue(run);

    await expect(getLatestFlowRun("flow-1")).resolves.toEqual({ id: "run-1" });

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { flowId: "flow-1", workspaceId: "workspace-1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: { nodes: true },
    });
    expect(mockSerializeFlowRun).toHaveBeenCalledWith(run);
  });

  it("retorna ausência sem inventar execução quando o Flow ainda não rodou", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(getLatestFlowRun("flow-1")).resolves.toBeNull();
    expect(mockSerializeFlowRun).not.toHaveBeenCalled();
  });
});
