import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnedFlow: vi.fn(),
  getOwnedExecutionScope: vi.fn(),
  assertOwnedFlowBrand: vi.fn(),
  providerConnection: { findFirst: vi.fn() },
  executionConfirmation: { create: vi.fn(), updateMany: vi.fn() },
  createFlowRun: vi.fn(),
}));

vi.mock("@/lib/flows/ownership", () => ({
  getOwnedFlow: mocks.getOwnedFlow,
  getOwnedExecutionScope: mocks.getOwnedExecutionScope,
  assertOwnedFlowBrand: mocks.assertOwnedFlowBrand,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    providerConnection: mocks.providerConnection,
    executionConfirmation: mocks.executionConfirmation,
  },
}));
vi.mock("@/lib/db/flows", () => ({
  parseStoredFlowGraph: (value: unknown) => value,
}));
vi.mock("@/lib/flows/runner", () => ({
  createFlowRun: mocks.createFlowRun,
}));

import { POST } from "@/app/api/flows/[flowId]/cost/route";
import { POST as POST_RUN } from "@/app/api/flows/[flowId]/runs/route";

const graph = {
  nodes: [
    {
      id: "prompt-1",
      type: "labNode",
      position: { x: 0, y: 0 },
      data: { kind: "prompt", title: "Prompt", description: "", status: "idle", params: { prompt: "fixture" } },
    },
    {
      id: "image-1",
      type: "labNode",
      position: { x: 1, y: 0 },
      data: { kind: "image-generation", title: "Imagem", description: "", status: "idle", params: { providerId: "openai", connectionId: "connection-owned", model: "gpt-5.5", prompt: "fixture" } },
    },
  ],
  edges: [{ id: "prompt-image", source: "prompt-1", target: "image-1", type: "smoothstep" }],
};

const flow = { id: "flow-owned", workspaceId: "workspace-1", brandId: null, graph };
const ownedConnection = {
  id: "connection-owned",
  ownerId: "owner-1",
  workspaceId: "workspace-1",
  provider: "openai",
  sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174000",
  authStatus: "connected",
  executorStatus: "online",
};

describe("POST /api/flows/[flowId]/cost scoped provider", () => {
  beforeEach(() => {
    mocks.getOwnedFlow.mockClear();
    mocks.getOwnedExecutionScope.mockClear();
    mocks.assertOwnedFlowBrand.mockClear();
    mocks.providerConnection.findFirst.mockClear();
    mocks.executionConfirmation.create.mockClear();
    mocks.executionConfirmation.updateMany.mockClear();
    mocks.executionConfirmation.updateMany.mockResolvedValue({ count: 1 });
    mocks.createFlowRun.mockClear();
    mocks.createFlowRun.mockResolvedValue({ id: "run-1", status: "running" });
    process.env.DATABASE_URL = "postgresql://fixture";
    process.env.DIRECT_URL = "postgresql://fixture";
    process.env.LABIA_LOCAL_OWNER_ID = "owner-1";
    process.env.LABIA_LOCAL_CONNECTIONS_TOKEN = "fixture-secret-with-at-least-32-characters";
    mocks.getOwnedFlow.mockResolvedValue(flow);
    mocks.getOwnedExecutionScope.mockResolvedValue({ ownerId: "owner-1", workspaceId: "workspace-1" });
    mocks.assertOwnedFlowBrand.mockResolvedValue(undefined);
    mocks.providerConnection.findFirst.mockResolvedValue(ownedConnection);
    mocks.executionConfirmation.create.mockResolvedValue({ id: "confirmation-1" });
  });

  it("estima a conexão OpenAI owned/online e emite confirmação assinada subscription", async () => {
    const response = await POST(
      new Request("http://127.0.0.1/api/flows/flow-owned/cost", {
        method: "POST",
        body: JSON.stringify({ targetNodeId: "image-1" }),
      }) as never,
      { params: Promise.resolve({ flowId: "flow-owned" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.cost.total.billingMode).toBe("subscription");
    expect(payload.confirmation.token).toEqual(expect.any(String));
    expect(mocks.providerConnection.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "connection-owned", ownerId: "owner-1", workspaceId: "workspace-1", provider: "openai" },
    }));
  });

  it.each([
    { label: "alheia", connection: { ...ownedConnection, ownerId: "owner-foreign" } },
    { label: "offline", connection: { ...ownedConnection, executorStatus: "offline" } },
  ])("rejeita conexão $label antes de emitir confirmação", async ({ connection }) => {
    mocks.providerConnection.findFirst.mockResolvedValue(connection);

    const response = await POST(
      new Request("http://127.0.0.1/api/flows/flow-owned/cost", { method: "POST", body: "{}" }) as never,
      { params: Promise.resolve({ flowId: "flow-owned" }) },
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/conexão|indisponível|owner|workspace/i);
    expect(mocks.executionConfirmation.create).not.toHaveBeenCalled();
  });

  it("usa a mesma resolução scoped no /runs antes de criar o FlowRun", async () => {
    const quoteResponse = await POST(
      new Request("http://127.0.0.1/api/flows/flow-owned/cost", { method: "POST", body: JSON.stringify({ targetNodeId: "image-1" }) }) as never,
      { params: Promise.resolve({ flowId: "flow-owned" }) },
    );
    const quote = await quoteResponse.json();
    const response = await POST_RUN(
      new Request("http://127.0.0.1/api/flows/flow-owned/runs", {
        method: "POST",
        body: JSON.stringify({ targetNodeId: "image-1", confirmationToken: quote.confirmation.token }),
      }) as never,
      { params: Promise.resolve({ flowId: "flow-owned" }) },
    );

    expect(response.status).toBe(201);
    expect(mocks.createFlowRun).toHaveBeenCalledWith(expect.objectContaining({ flowId: "flow-owned", targetNodeId: "image-1" }));
  });
});
