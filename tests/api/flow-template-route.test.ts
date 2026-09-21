import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFlow: vi.fn(),
  createProject: vi.fn(),
  getOwnedExecutionScope: vi.fn(),
}));

vi.mock("@/lib/db/flows", () => ({
  createFlow: mocks.createFlow,
  getOrCreateStarterFlow: vi.fn(),
  listRecentFlows: vi.fn(),
  parseStoredFlowGraph: (value: unknown) => value,
}));
vi.mock("@/lib/projects", () => ({
  createProject: mocks.createProject,
}));
vi.mock("@/lib/flows/ownership", () => ({
  getOwnedExecutionScope: mocks.getOwnedExecutionScope,
}));
vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: () => true }));

import { POST } from "@/app/api/flows/route";

describe("POST /api/flows templates", () => {
  beforeEach(() => {
    mocks.createFlow.mockReset();
    mocks.createProject.mockReset();
    mocks.getOwnedExecutionScope.mockReset();
    mocks.createFlow.mockResolvedValue({
      id: "flow-template-1",
      name: "Imagem-base → Vídeo curto",
      graph: { nodes: [], edges: [] },
    });
    mocks.getOwnedExecutionScope.mockResolvedValue({
      ownerId: "owner-1",
      workspaceId: "workspace-1",
    });
  });

  it("creates the selected template server-side", async () => {
    const response = await POST(
      new Request("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({ template: "image-to-video" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createFlow).toHaveBeenCalledWith(
      "Imagem-base → Vídeo curto",
      "image-to-video",
    );
  });

  it("creates a real Project and its primary Flow for imported product video", async () => {
    const graph = {
      nodes: [
        { id: "asset", data: { kind: "asset-input" } },
        { id: "video", data: { kind: "video-generation" } },
        { id: "output", data: { kind: "asset-output" } },
      ],
      edges: [],
    };
    mocks.createProject.mockResolvedValue({
      id: "project-product-1",
      primaryFlow: {
        id: "flow-product-1",
        name: "Produto X · Flow principal",
        projectId: "project-product-1",
        graph,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({
          template: "product-imported-to-video",
          project: {
            name: "Produto X",
            objective: "Demonstrar o produto em vídeo curto.",
            aspectRatio: "9:16",
            durationSeconds: 5,
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createProject).toHaveBeenCalledWith({
      ownerId: "owner-1",
      workspaceId: "workspace-1",
      name: "Produto X",
      objective: "Demonstrar o produto em vídeo curto.",
      type: "VIDEO",
      aspectRatio: "9:16",
      durationSeconds: 5,
      flowTemplate: "product-imported-to-video",
    });
    expect(mocks.createFlow).not.toHaveBeenCalled();

    const payload = await response.json();
    expect(payload.flow.projectId).toBe("project-product-1");
    expect(payload.flow.graph.nodes.map((node: { data: { kind: string } }) => node.data.kind)).not.toContain("image-generation");
  });

  it("creates a Project and linked Flow for the production blueprint", async () => {
    mocks.createProject.mockResolvedValue({
      id: "project-blueprint-1",
      name: "Blueprint Produto X",
      primaryFlow: {
        id: "flow-blueprint-1",
        name: "Blueprint Produto X · Flow principal",
        projectId: "project-blueprint-1",
        graph: {
          nodes: [
            { id: "briefing", data: { kind: "text-input" } },
            { id: "source", data: { kind: "asset-input" } },
            { id: "assembly", data: { kind: "video-assembly" } },
          ],
          edges: [],
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({
          template: "product-production-blueprint",
          project: {
            name: "Blueprint Produto X",
            objective: "Organizar um vídeo de produto por etapas.",
            aspectRatio: "9:16",
            durationSeconds: 5,
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createProject).toHaveBeenCalledWith({
      ownerId: "owner-1",
      workspaceId: "workspace-1",
      name: "Blueprint Produto X",
      objective: "Organizar um vídeo de produto por etapas.",
      type: "VIDEO",
      aspectRatio: "9:16",
      durationSeconds: 5,
      flowTemplate: "product-production-blueprint",
    });
    expect(mocks.createFlow).not.toHaveBeenCalled();

    const payload = await response.json();
    expect(payload.project).toMatchObject({
      id: "project-blueprint-1",
      primaryFlowId: "flow-blueprint-1",
    });
    expect(payload.flow.projectId).toBe("project-blueprint-1");
  });

  it("rejects unknown template keys without creating a Flow", async () => {
    const response = await POST(
      new Request("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({ template: "client-invented" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createFlow).not.toHaveBeenCalled();
  });
});
