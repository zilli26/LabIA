import { describe, expect, it, vi } from "vitest";

import { PrismaGenerationStore, deterministicAssetKey } from "@/lib/providers/prisma-generation-store";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    generation: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    flowRun: { findFirst: vi.fn() },
    asset: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/lib/providers/asset-storage", () => ({
  uploadRemoteAssetToSupabase: vi.fn().mockResolvedValue({ bucket: "assets", path: "p", url: "https://stored.test/p", contentType: "image/png", sizeBytes: 1 }),
}));

describe("PrismaGenerationStore", () => {
  it("usa chave determinística e upsert por generation/outputIndex", async () => {
    expect(deterministicAssetKey("generation-1", 0)).toBe(deterministicAssetKey("generation-1", 0));
    expect(deterministicAssetKey("generation-1", 0)).not.toBe(deterministicAssetKey("generation-1", 1));
    const store = new PrismaGenerationStore();
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.generation.findUnique).mockResolvedValue({
      id: "generation-1", operationKey: "operation-1", provider: "fal", model: "model", params: { prompt: "x" }, status: "QUEUED", submissionState: "not_submitted", providerJobId: null, result: null, errorMessage: null, workspaceId: "workspace-1", brandId: null,
    } as never);
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null as never);
    await store.persistAsset("generation-1", 0, {
      workspaceId: "workspace-1",
      type: "IMAGE",
      url: "https://assets.test/image.png",
    });
    expect(prisma.asset.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { generationId_outputIndex: { generationId: "generation-1", outputIndex: 0 } },
    }));
  });

  it("persiste Asset de Generation de Projeto com o projectId do Flow principal", async () => {
    const store = new PrismaGenerationStore();
    const { prisma } = await import("@/lib/db/prisma");
    vi.mocked(prisma.generation.findUnique).mockResolvedValue({
      id: "generation-project-1", operationKey: "operation-project-1", provider: "fal", model: "video-model", params: { prompt: "x" }, status: "DONE", submissionState: "completed", providerJobId: "job-1", result: null, errorMessage: null, workspaceId: "workspace-1", brandId: null, flowRunId: "run-project-1",
    } as never);
    vi.mocked(prisma.flowRun.findFirst).mockResolvedValue({ flow: { projectId: "project-1" } } as never);
    vi.mocked(prisma.asset.findUnique).mockResolvedValue(null as never);

    await store.persistAsset("generation-project-1", 0, {
      url: "https://assets.test/video.mp4",
      durationSeconds: 5,
      contentType: "video/mp4",
    });

    expect(prisma.flowRun.findFirst).toHaveBeenCalledWith({
      where: { id: "run-project-1", workspaceId: "workspace-1" },
      select: { flow: { select: { projectId: true } } },
    });
    expect(prisma.asset.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ projectId: "project-1", generationId: "generation-project-1" }),
    }));
  });
});
