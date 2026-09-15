import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnedExecutionScope: vi.fn(),
  createProjectForFlow: vi.fn(),
}));

vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: () => true }));
vi.mock("@/lib/flows/ownership", () => ({
  getOwnedExecutionScope: mocks.getOwnedExecutionScope,
}));
vi.mock("@/lib/projects", () => ({
  createProjectForFlow: mocks.createProjectForFlow,
}));

import { POST } from "@/app/api/flows/[flowId]/project/route";

describe("POST /api/flows/[flowId]/project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOwnedExecutionScope.mockResolvedValue({
      ownerId: "owner-a",
      workspaceId: "workspace-a",
    });
  });

  it("vincula o Flow existente ao Projeto sem substituir seu grafo", async () => {
    const graph = {
      nodes: [{ id: "existing-node", data: { kind: "prompt" } }],
      edges: [],
    };
    mocks.createProjectForFlow.mockResolvedValue({
      project: {
        id: "project-a",
        name: "Flow sem Projeto",
        primaryFlowId: "flow-a",
      },
      flow: {
        id: "flow-a",
        projectId: "project-a",
        graph,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/flows/flow-a/project", {
        method: "POST",
        body: JSON.stringify({
          name: "Flow sem Projeto",
          objective: "Organizar a produção deste Flow.",
        }),
      }),
      { params: Promise.resolve({ flowId: "flow-a" }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.createProjectForFlow).toHaveBeenCalledWith({
      flowId: "flow-a",
      scope: { ownerId: "owner-a", workspaceId: "workspace-a" },
      name: "Flow sem Projeto",
      objective: "Organizar a produção deste Flow.",
    });
    const payload = await response.json();
    expect(payload.flow).toMatchObject({ id: "flow-a", projectId: "project-a", graph });
    expect(payload.project.primaryFlowId).toBe("flow-a");
  });

  it("rejeita nome ausente antes de tocar o banco", async () => {
    const response = await POST(
      new Request("http://localhost/api/flows/flow-a/project", {
        method: "POST",
        body: JSON.stringify({ objective: "x" }),
      }),
      { params: Promise.resolve({ flowId: "flow-a" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.createProjectForFlow).not.toHaveBeenCalled();
  });
});
