import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectCreate: vi.fn(),
  flowCreate: vi.fn(),
  projectUpdate: vi.fn(),
  transaction: vi.fn(),
  createFlowTemplateGraph: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/flows/templates", () => ({
  createFlowTemplateGraph: mocks.createFlowTemplateGraph,
}));

import { createProject } from "@/lib/projects";

describe("createProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createFlowTemplateGraph.mockReturnValue({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
    mocks.projectCreate.mockResolvedValue({ id: "project-1" });
    mocks.flowCreate.mockResolvedValue({ id: "flow-1" });
    mocks.projectUpdate.mockResolvedValue({
      id: "project-1",
      name: "Campanha verão",
      type: "VIDEO",
      primaryFlow: { id: "flow-1", name: "Campanha verão · Flow principal" },
    });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      project: { create: mocks.projectCreate, update: mocks.projectUpdate },
      flow: { create: mocks.flowCreate },
    }));
  });

  it("cria o Projeto e seu Flow principal na mesma transação, sem geração", async () => {
    const result = await createProject({
      ownerId: "owner-1",
      workspaceId: "workspace-owned",
      name: "Campanha verão",
      type: "VIDEO",
      objective: "Apresentar o produto",
      aspectRatio: "9:16",
      durationSeconds: 5,
    });

    expect(result.primaryFlow?.id).toBe("flow-1");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.projectCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-owned",
        name: "Campanha verão",
        type: "VIDEO",
        durationSeconds: 5,
        status: "DRAFT",
      }),
    }));
    expect(mocks.flowCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workspaceId: "workspace-owned",
        projectId: "project-1",
      }),
    }));
    expect(mocks.projectUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "project-1" },
      data: { primaryFlowId: "flow-1" },
    }));
    expect(mocks).not.toHaveProperty("generationCreate");
  });

  it("seleciona o template de imagem sem criar duração", async () => {
    mocks.projectUpdate.mockResolvedValue({ id: "project-2", primaryFlow: { id: "flow-2" } });

    await createProject({
      ownerId: "owner-1",
      workspaceId: "workspace-owned",
      name: "Post",
      type: "IMAGE",
      objective: "Post de lançamento",
      aspectRatio: "1:1",
      durationSeconds: null,
    });

    expect(mocks.createFlowTemplateGraph).toHaveBeenCalledWith("image-only");
    expect(mocks.projectCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ durationSeconds: null }),
    }));
  });

  it("vincula o Flow primário ao Projeto e usa a receita de produto importado", async () => {
    const graph = {
      nodes: [
        { id: "asset", data: { kind: "asset-input" } },
        { id: "video", data: { kind: "video-generation" } },
        { id: "output", data: { kind: "asset-output" } },
      ],
      edges: [],
    };
    mocks.createFlowTemplateGraph.mockReturnValue(graph);

    await createProject({
      ownerId: "owner-1",
      workspaceId: "workspace-owned",
      name: "Produto importado",
      type: "VIDEO",
      objective: "Vídeo curto de produto",
      aspectRatio: "9:16",
      durationSeconds: 5,
      flowTemplate: "product-imported-to-video",
    } as never);

    expect(mocks.createFlowTemplateGraph).toHaveBeenCalledWith("product-imported-to-video");
    expect(mocks.flowCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        projectId: "project-1",
        graph,
      }),
    }));
    expect(graph.nodes.map((node) => node.data.kind)).not.toContain("image-generation");
  });
});
