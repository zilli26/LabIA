import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOwnedProviderConnections: vi.fn(),
  getOwnedProviderConnection: vi.fn(),
  readExecutorImageOptions: vi.fn(),
  readRemoteExecutorImageOptions: vi.fn(),
  assertLocalConnectionsRequest: vi.fn(),
}));

vi.mock("@/lib/provider-connections/store", () => ({
  listOwnedProviderConnections: mocks.listOwnedProviderConnections,
  getOwnedProviderConnection: mocks.getOwnedProviderConnection,
}));
vi.mock("@/lib/provider-connections/executor-client", () => ({
  readExecutorImageOptions: mocks.readExecutorImageOptions,
}));
vi.mock("@/lib/provider-connections/remote-image-options", () => ({
  readRemoteExecutorImageOptions: mocks.readRemoteExecutorImageOptions,
}));
vi.mock("@/lib/provider-connections/security", () => ({
  assertLocalConnectionsRequest: mocks.assertLocalConnectionsRequest,
  LocalConnectionsError: class LocalConnectionsError extends Error {},
  noStoreJson: (body: unknown, init: ResponseInit = {}) => Response.json(body, init),
  sanitizeProviderMessage: (error: unknown) => String(error),
}));

import { GET } from "@/app/api/provider-connections/image-options/route";

describe("GET /api/provider-connections/image-options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("lê snapshot remoto online sem chamar localhost e não expõe dados fora do payload", async () => {
    mocks.readRemoteExecutorImageOptions.mockResolvedValue({
      executor: { status: "online", lastSeenAt: "2026-09-13T10:01:00.000Z" },
      connections: [{ id: "owned-connection", label: "ChatGPT", planType: "plus", models: [{ id: "gpt-image-1", name: "Imagem" }] }],
    });

    const response = await GET(new Request("https://preview.example/api/provider-connections/image-options"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      executor: { status: "online", lastSeenAt: "2026-09-13T10:01:00.000Z" },
      connections: [{ id: "owned-connection", label: "ChatGPT", planType: "plus", models: [{ id: "gpt-image-1", name: "Imagem" }] }],
    });
    expect(mocks.readRemoteExecutorImageOptions).toHaveBeenCalledOnce();
    expect(mocks.assertLocalConnectionsRequest).not.toHaveBeenCalled();
    expect(mocks.readExecutorImageOptions).not.toHaveBeenCalled();
    expect(JSON.stringify(payload)).not.toMatch(/secret|token|localhost|127\.0\.0\.1/i);
  });

  it("informa executor pareado offline quando o snapshot remoto está ausente ou expirado", async () => {
    mocks.readRemoteExecutorImageOptions.mockResolvedValue({
      executor: { status: "offline", message: "executor pareado offline: snapshot indisponível." },
      connections: [],
    });

    const response = await GET(new Request("https://preview.example/api/provider-connections/image-options"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      executor: { status: "offline", message: expect.stringContaining("executor pareado offline") },
      connections: [],
    });
  });
});
