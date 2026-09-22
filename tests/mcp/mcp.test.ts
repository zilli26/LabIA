import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabaseEnv: vi.fn(),
  getOwnedExecutionScope: vi.fn(),
  getOwnedFlow: vi.fn(),
  createProject: vi.fn(),
  getProject: vi.fn(),
  flowUpdateMany: vi.fn(),
  assetFindMany: vi.fn(),
  validateFlowGraph: vi.fn(),
}));

vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: mocks.hasDatabaseEnv }));
vi.mock("@/lib/flows/ownership", () => ({
  getOwnedExecutionScope: mocks.getOwnedExecutionScope,
  getOwnedFlow: mocks.getOwnedFlow,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    flow: { updateMany: mocks.flowUpdateMany },
    asset: { findMany: mocks.assetFindMany },
  },
}));
vi.mock("@/lib/projects", () => ({
  createProject: mocks.createProject,
  getProject: mocks.getProject,
  listProjects: vi.fn(),
}));
vi.mock("@/lib/flows/parse", () => ({ parseStoredFlowGraph: (graph: unknown) => graph }));
vi.mock("@/lib/flows/validation", () => ({ validateFlowGraph: mocks.validateFlowGraph }));
vi.mock("@/lib/assets/project-assets", () => ({ listProjectAssets: vi.fn() }));
vi.mock("@/lib/provider-connections/store", () => ({ listOwnedProviderConnections: vi.fn() }));
vi.mock("@/lib/provider-connections/staging-readiness", () => ({ getStagingReadiness: vi.fn() }));
vi.mock("@/lib/flows/registry", () => ({ listSerializableNodeDefinitions: vi.fn(() => []) }));
vi.mock("@/lib/providers/provider-registry", () => ({
  assertOperationalGraphProviders: vi.fn(),
  createServerProviderResolver: vi.fn(() => undefined),
}));

import {
  createFlowDraftInputSchema,
  getCapabilitiesInputSchema,
  saveFlowDraftInputSchema,
} from "@/lib/mcp/schemas";
import {
  clearLocalMcpIdempotencyForTests,
  createFlowDraftTool,
  getProjectTool,
  McpToolError,
} from "@/lib/mcp/service";
import { createLabiaMcpServer, type LabiaMcpService } from "@/lib/mcp/server";

const graph = {
  nodes: [{
    id: "briefing",
    type: "labNode" as const,
    position: { x: 0, y: 0 },
    data: {
      kind: "text-input" as const,
      title: "Briefing",
      description: "",
      status: "idle" as const,
      params: {},
    },
  }],
  edges: [],
};

const project = {
  id: "project-1",
  name: "Produto X",
  type: "VIDEO",
  status: "DRAFT",
  objective: "Demonstrar",
  aspectRatio: "9:16",
  durationSeconds: 5,
  primaryFlow: { id: "flow-1", name: "Produto X · Flow principal", projectId: "project-1", graph },
};

describe("LabIA MCP local", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearLocalMcpIdempotencyForTests();
    mocks.hasDatabaseEnv.mockReturnValue(true);
    mocks.getOwnedExecutionScope.mockResolvedValue({ ownerId: "owner-local", workspaceId: "workspace-local" });
    mocks.flowUpdateMany.mockResolvedValue({ count: 1 });
    mocks.assetFindMany.mockResolvedValue([]);
    mocks.validateFlowGraph.mockReturnValue({ valid: true, issues: [] });
    mocks.createProject.mockResolvedValue(project);
    mocks.getProject.mockResolvedValue(project);
    mocks.getOwnedFlow.mockResolvedValue({ id: "flow-1", projectId: "project-1", name: project.primaryFlow.name, graph });
  });

  it("usa schemas estritos e rejeita ownerId/workspaceId arbitrários", () => {
    expect(() => getCapabilitiesInputSchema.parse({ workspaceId: "foreign" })).toThrow();
    expect(() => createFlowDraftInputSchema.parse({
      idempotencyKey: "key",
      template: "product-imported-to-video",
      workspaceId: "foreign",
      intent: {
        name: "Produto",
        objective: "Demonstrar",
        aspectRatio: "9:16",
        durationSeconds: 5,
        briefing: "Mostrar o produto.",
      },
    })).toThrow();
    expect(() => saveFlowDraftInputSchema.parse({
      idempotencyKey: "key",
      flowId: "flow-1",
      name: "Flow",
      graph,
      ownerId: "foreign",
    })).toThrow();
  });

  it("resolve leituras somente no escopo devolvido pelo owner local", async () => {
    await getProjectTool({ projectId: "project-1" });

    expect(mocks.getProject).toHaveBeenCalledWith("project-1", {
      ownerId: "owner-local",
      workspaceId: "workspace-local",
    });
  });

  it("cria somente draft e declara generationStarted=false", async () => {
    const result = await createFlowDraftTool({
      idempotencyKey: "draft-1",
      template: "product-production-blueprint",
      intent: {
        name: "Produto X",
        objective: "Demonstrar o produto",
        aspectRatio: "9:16",
        durationSeconds: 5,
        briefing: "Mostrar o produto em uso.",
      },
    });

    expect(result.draftStatus).toBe("draft");
    expect(result.generationStarted).toBe(false);
    expect(mocks.flowUpdateMany).toHaveBeenCalled();
    expect(mocks.flowUpdateMany.mock.calls[0][0].data.graph.nodes[0].data.params.briefing).toBe("Mostrar o produto em uso.");
  });

  it("normaliza falha de banco sem devolver URL ou detalhes internos", async () => {
    mocks.createProject.mockRejectedValue(new Error("connect postgres://secret-user:secret@internal-db:5432/labia"));

    await expect(createFlowDraftTool({
      idempotencyKey: "db-error-1",
      template: "product-imported-to-video",
      intent: {
        name: "Produto",
        objective: "Demonstrar",
        aspectRatio: "9:16",
        durationSeconds: 5,
        briefing: "Briefing",
      },
    })).rejects.toMatchObject({ code: "database_unavailable" });

    try {
      await createFlowDraftTool({
        idempotencyKey: "db-error-2",
        template: "product-imported-to-video",
        intent: {
          name: "Produto",
          objective: "Demonstrar",
          aspectRatio: "9:16",
          durationSeconds: 5,
          briefing: "Briefing",
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(McpToolError);
      expect((error as Error).message).not.toContain("postgres://");
    }
  });

  it("registra somente tools de leitura, draft e estimativa; start_run fica bloqueado", () => {
    const noop = async () => ({ generationStarted: false });
    const fakeService = {
      getCapabilities: noop,
      listProjects: noop,
      getProject: noop,
      listAssets: noop,
      getFlow: noop,
      createFlowDraft: noop,
      saveFlowDraft: noop,
      estimateFlow: noop,
    } as unknown as LabiaMcpService;
    const server = createLabiaMcpServer(fakeService) as unknown as { _registeredTools: Record<string, unknown> };
    const toolNames = Object.keys(server._registeredTools).sort();

    expect(toolNames).toEqual([
      "create_flow_draft",
      "estimate_flow",
      "get_capabilities",
      "get_flow",
      "get_project",
      "list_assets",
      "list_projects",
      "save_flow_draft",
    ]);
    expect(toolNames).not.toContain("start_run");
  });
});
