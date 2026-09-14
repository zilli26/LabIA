import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ assets: [] as Array<Record<string, unknown>> }));
const mocks = vi.hoisted(() => ({
  generationFindUnique: vi.fn(),
  flowRunFindFirst: vi.fn(),
  assetFindUnique: vi.fn(),
  assetUpsert: vi.fn(),
  assetFindMany: vi.fn(),
  projectFindMany: vi.fn(),
  hasDatabaseEnv: vi.fn(),
  getOwnedExecutionScope: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    generation: { findUnique: mocks.generationFindUnique },
    flowRun: { findFirst: mocks.flowRunFindFirst },
    asset: {
      findUnique: mocks.assetFindUnique,
      upsert: mocks.assetUpsert,
      findMany: mocks.assetFindMany,
    },
    project: { findMany: mocks.projectFindMany },
  },
}));
vi.mock("@/lib/providers/asset-storage", () => ({ uploadRemoteAssetToSupabase: mocks.upload }));
vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: mocks.hasDatabaseEnv }));
vi.mock("@/lib/flows/ownership", () => ({ getOwnedExecutionScope: mocks.getOwnedExecutionScope }));

import LibraryPage from "@/app/(studio)/biblioteca/page";
import { PrismaGenerationStore } from "@/lib/providers/prisma-generation-store";

describe("persistência de Asset de Projeto até a Biblioteca", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.assets = [];
    mocks.hasDatabaseEnv.mockReturnValue(true);
    mocks.getOwnedExecutionScope.mockResolvedValue({ ownerId: "owner-1", workspaceId: "workspace-1" });
    mocks.projectFindMany.mockResolvedValue([{ id: "project-1", name: "Projeto vídeo" }]);
    mocks.generationFindUnique.mockResolvedValue({
      id: "generation-1", workspaceId: "workspace-1", brandId: null, provider: "fal", model: "video-model", prompt: "produto em movimento", flowRunId: "run-1",
    });
    mocks.flowRunFindFirst.mockResolvedValue({ flow: { projectId: "project-1" } });
    mocks.assetFindUnique.mockResolvedValue(null);
    mocks.upload.mockResolvedValue({ bucket: "assets", path: "project/video.mp4", url: "https://assets.test/video.mp4", contentType: "video/mp4", sizeBytes: 12 });
    mocks.assetUpsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => {
      state.assets.push({ id: "asset-1", ...create });
      return create;
    });
    mocks.assetFindMany.mockImplementation(async ({ select, where }: { select?: Record<string, unknown>; where: Record<string, unknown> }) => {
      if (select) return state.assets.map((asset) => ({ provider: asset.provider, model: asset.model }));
      return state.assets
        .filter((asset) => where.projectId === undefined || asset.projectId === where.projectId)
        .map((asset) => ({ ...asset, project: { id: "project-1", name: "Projeto vídeo" }, generation: null }));
    });
  });

  it("persiste o vínculo e torna o vídeo encontrável pelo filtro do Projeto", async () => {
    await new PrismaGenerationStore().persistAsset("generation-1", 0, {
      url: "https://source.test/video.mp4",
      durationSeconds: 5,
      contentType: "video/mp4",
    });

    const markup = renderToStaticMarkup(await LibraryPage({ searchParams: Promise.resolve({ project: "project-1" }) }));

    expect(state.assets[0].projectId).toBe("project-1");
    expect(mocks.assetFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ projectId: "project-1" }) }));
    expect(markup).toContain("Projeto vídeo");
    expect(markup).toContain('<video src="https://assets.test/video.mp4" controls=""');
  });
});
