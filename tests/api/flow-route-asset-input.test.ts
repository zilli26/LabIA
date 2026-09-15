import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnedFlow: vi.fn(),
  getOwnedExecutionScope: vi.fn(),
  updateMany: vi.fn(),
  assetFindMany: vi.fn(),
}));

vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: () => true }));
vi.mock("@/lib/flows/ownership", () => ({
  getOwnedFlow: mocks.getOwnedFlow,
  getOwnedExecutionScope: mocks.getOwnedExecutionScope,
}));
vi.mock("@/lib/db/flows", () => ({
  parseStoredFlowGraph: (value: unknown) => value,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    flow: { updateMany: mocks.updateMany },
    asset: { findMany: mocks.assetFindMany },
  },
}));

import { PUT } from "@/app/api/flows/[flowId]/route";

const graph = {
  nodes: [
    {
      id: "asset-input-1",
      type: "labNode",
      position: { x: 0, y: 0 },
      data: {
        kind: "asset-input",
        title: "Imagem-base",
        description: "",
        status: "idle",
        params: { assetId: "asset-foreign", projectRole: "source" },
      },
    },
  ],
  edges: [],
};

describe("PUT /api/flows/[flowId] asset-input scope", () => {
  beforeEach(() => {
    mocks.getOwnedFlow.mockReset();
    mocks.getOwnedExecutionScope.mockReset();
    mocks.updateMany.mockReset();
    mocks.assetFindMany.mockReset();
    mocks.getOwnedExecutionScope.mockResolvedValue({
      ownerId: "owner-a",
      workspaceId: "workspace-a",
    });
    mocks.getOwnedFlow.mockResolvedValue({
      id: "flow-a",
      workspaceId: "workspace-a",
      projectId: "project-a",
      name: "Flow",
      graph,
      updatedAt: new Date("2026-09-15T00:00:00.000Z"),
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects an Asset outside the Flow Project before persisting the graph", async () => {
    mocks.assetFindMany.mockResolvedValue([]);

    const response = await PUT(
      new Request("http://localhost/api/flows/flow-a", {
        method: "PUT",
        body: JSON.stringify({ name: "Flow", graph }),
      }) as never,
      { params: Promise.resolve({ flowId: "flow-a" }) },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Asset.*Projeto|workspace/i);
    expect(mocks.assetFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["asset-foreign"] },
        workspaceId: "workspace-a",
        projectId: "project-a",
        origin: "UPLOADED",
        type: { in: ["IMAGE", "VIDEO"] },
      },
      select: { id: true },
    });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("persists a selected Asset after the same Project/workspace check", async () => {
    mocks.assetFindMany.mockResolvedValue([{ id: "asset-foreign" }]);

    const response = await PUT(
      new Request("http://localhost/api/flows/flow-a", {
        method: "PUT",
        body: JSON.stringify({ name: "Flow", graph }),
      }) as never,
      { params: Promise.resolve({ flowId: "flow-a" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "flow-a", workspaceId: "workspace-a" },
        data: expect.objectContaining({ name: "Flow", graph }),
      }),
    );
  });
});
