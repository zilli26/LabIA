import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createFlow: vi.fn(),
}));

vi.mock("@/lib/db/flows", () => ({
  createFlow: mocks.createFlow,
  getOrCreateStarterFlow: vi.fn(),
  listRecentFlows: vi.fn(),
  parseStoredFlowGraph: (value: unknown) => value,
}));
vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: () => true }));

import { POST } from "@/app/api/flows/route";

describe("POST /api/flows templates", () => {
  beforeEach(() => {
    mocks.createFlow.mockReset();
    mocks.createFlow.mockResolvedValue({
      id: "flow-template-1",
      name: "Imagem-base → Vídeo curto",
      graph: { nodes: [], edges: [] },
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

  it("creates the imported product to short video template server-side", async () => {
    const response = await POST(
      new Request("http://localhost/api/flows", {
        method: "POST",
        body: JSON.stringify({ template: "product-imported-to-video" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createFlow).toHaveBeenCalledWith(
      "Produto importado → Vídeo curto",
      "product-imported-to-video",
    );
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
