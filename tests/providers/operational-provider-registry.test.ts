import { describe, expect, it, vi } from "vitest";

import { resolveServerModelProvider } from "@/lib/providers/provider-registry";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    providerConnection: { findFirst: vi.fn() },
  },
}));

describe("server provider registry", () => {
  it("resolve somente conexão pertencente ao owner/workspace e mantém OpenAI não validado até a primeira imagem", async () => {
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.providerConnection.findFirst).mockResolvedValue({
      id: "connection-1",
      workspaceId: "workspace-1",
      ownerId: "owner-1",
      provider: "openai",
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174000",
      authStatus: "connected",
      executorStatus: "online",
      generationValidationStatus: "unvalidated",
    } as never);

    const provider = await resolveServerModelProvider({
      ownerId: "owner-1",
      workspaceId: "workspace-1",
      providerId: "openai",
      connectionId: "connection-1",
    });
    expect(provider.capabilities).toMatchObject({ image: true, recoverableResults: true });
    expect(provider.estimateCost("gpt-5.5", { prompt: "x" }).billingMode).toBe("subscription");
    expect(prisma.providerConnection.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "connection-1", ownerId: "owner-1", workspaceId: "workspace-1" }),
    }));
  });
});
