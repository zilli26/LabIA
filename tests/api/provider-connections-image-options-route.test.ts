import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOwnedProviderConnections: vi.fn(),
  getOwnedProviderConnection: vi.fn(),
  readExecutorImageOptions: vi.fn(),
  assertLocalConnectionsRequest: vi.fn(),
}));

vi.mock("@/lib/provider-connections/store", () => ({
  listOwnedProviderConnections: mocks.listOwnedProviderConnections,
  getOwnedProviderConnection: mocks.getOwnedProviderConnection,
}));
vi.mock("@/lib/provider-connections/executor-client", () => ({
  readExecutorImageOptions: mocks.readExecutorImageOptions,
}));
vi.mock("@/lib/provider-connections/security", () => ({
  assertLocalConnectionsRequest: mocks.assertLocalConnectionsRequest,
  LocalConnectionsError: class LocalConnectionsError extends Error {},
  noStoreJson: (body: unknown, init: ResponseInit = {}) => Response.json(body, init),
  sanitizeProviderMessage: (error: unknown) => String(error),
}));

import { GET } from "@/app/api/provider-connections/image-options/route";

describe("GET /api/provider-connections/image-options", () => {
  it("exibe apenas conexões OpenAI conectadas e modelos de imagem aprovados pelo executor", async () => {
    mocks.listOwnedProviderConnections.mockResolvedValue([
      {
        id: "openai-connected",
        provider: "openai",
        label: "ChatGPT pessoal",
        authStatus: "connected",
        executorStatus: "online",
        planType: "plus",
      },
      {
        id: "openai-disconnected",
        provider: "openai",
        label: "Desconectada",
        authStatus: "disconnected",
        executorStatus: "online",
        planType: "plus",
      },
      {
        id: "fal-connected",
        provider: "fal",
        label: "fal.ai",
        authStatus: "connected",
        executorStatus: "online",
        planType: null,
      },
    ]);
    mocks.getOwnedProviderConnection.mockResolvedValue({
      id: "openai-connected",
      provider: "openai",
      sessionRef: "labia-codex:00000000-0000-4000-8000-000000000001",
    });
    mocks.readExecutorImageOptions.mockResolvedValue({
      models: [{ id: "gpt-image-approved", name: "Imagem aprovada" }],
    });

    const response = await GET(new Request("http://127.0.0.1/api/provider-connections/image-options"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      connections: [{
        id: "openai-connected",
        label: "ChatGPT pessoal",
        planType: "plus",
        models: [{ id: "gpt-image-approved", name: "Imagem aprovada" }],
      }],
    });
    expect(mocks.readExecutorImageOptions).toHaveBeenCalledWith("labia-codex:00000000-0000-4000-8000-000000000001");
  });
});
