import { describe, expect, it, vi } from "vitest";

import { buildVideoGenerationParams, processVideoGeneration } from "@/lib/providers/video-generation-job";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { generation: { findFirst }, providerConnection: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/flows/ownership", () => ({
  getOwnedExecutionScope: vi.fn(async () => ({ ownerId: "owner-1", workspaceId: "workspace-1" })),
  assertOwnedExecutionReferences: vi.fn(),
}));

describe("video generation job OpenAI boundary", () => {
  it("propaga kind video no snapshot do job mesmo se o caller omitir ou tentar trocar", () => {
    expect(buildVideoGenerationParams({ prompt: "x", params: { kind: "image" } })).toMatchObject({ kind: "video", prompt: "x" });
  });

  it("rejeita OpenAI no job real antes de resolver provider ou enviar", async () => {
    findFirst.mockResolvedValue({
      id: "generation-1",
      workspaceId: "workspace-1",
      provider: "openai",
      connectionId: "connection-1",
      status: "RUNNING",
      brandId: null,
      flowRunId: null,
      flowNodeId: null,
    });

    await expect(processVideoGeneration("generation-1")).rejects.toThrow(/image_generation_contract_unavailable|video/i);
  });
});
