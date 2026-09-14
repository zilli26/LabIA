import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabaseEnv: vi.fn(),
  assetFindMany: vi.fn(),
  projectFindMany: vi.fn(),
  connectionScope: vi.fn(),
}));

vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: mocks.hasDatabaseEnv }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { asset: { findMany: mocks.assetFindMany }, project: { findMany: mocks.projectFindMany } },
}));
vi.mock("@/lib/flows/ownership", () => ({ getOwnedExecutionScope: mocks.connectionScope }));

import LibraryPage from "@/app/(studio)/biblioteca/page";

describe("Biblioteca com escopo de Projeto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseEnv.mockReturnValue(true);
    mocks.connectionScope.mockResolvedValue({ ownerId: "owner-a", workspaceId: "workspace-a" });
    mocks.projectFindMany.mockResolvedValue([
      { id: "project-a", name: "Projeto A" },
    ]);
    mocks.assetFindMany.mockResolvedValue([]);
  });

  it("combina projeto, tipo, provider, modelo e período no mesmo where scoped", async () => {
    await LibraryPage({ searchParams: Promise.resolve({
      project: "project-a",
      type: "VIDEO",
      provider: "fal",
      model: "fal-ai/wan-25-preview/image-to-video",
      date: "7d",
    }) });

    expect(mocks.assetFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        workspaceId: "workspace-a",
        projectId: "project-a",
        type: "VIDEO",
        provider: "fal",
        model: "fal-ai/wan-25-preview/image-to-video",
        createdAt: expect.objectContaining({ gte: expect.any(Date) }),
      }),
    }));
  });

  it("mantém asset legado filtrável como Sem projeto e preserva vídeo", async () => {
    mocks.assetFindMany.mockResolvedValue([{
      id: "legacy-video",
      type: "VIDEO",
      url: "https://assets.example/video.mp4",
      model: "model-x",
      provider: "provider-x",
      project: null,
      prompt: "vídeo legado",
      createdAt: new Date("2026-09-14T00:00:00Z"),
      width: 1280,
      height: 720,
      generation: null,
    }]);

    const markup = renderToStaticMarkup(await LibraryPage({ searchParams: Promise.resolve({ project: "none" }) }));

    expect(mocks.assetFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ projectId: null }) }));
    expect(markup).toContain("Sem projeto");
    expect(markup).toContain("provider-x / model-x");
    expect(markup).toContain('<video src="https://assets.example/video.mp4" controls=""');
  });

  it("renderiza o estado sem DB sem resolver owner/workspace nem consultar dados", async () => {
    mocks.hasDatabaseEnv.mockReturnValue(false);

    const markup = renderToStaticMarkup(await LibraryPage({}));

    expect(markup).toContain("Configure DATABASE_URL");
    expect(mocks.connectionScope).not.toHaveBeenCalled();
    expect(mocks.projectFindMany).not.toHaveBeenCalled();
    expect(mocks.assetFindMany).not.toHaveBeenCalled();
  });
});
