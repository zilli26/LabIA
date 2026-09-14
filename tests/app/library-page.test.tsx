import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHasDatabaseEnv = vi.hoisted(() => vi.fn());
const mockFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/env", () => ({
  hasDatabaseEnv: mockHasDatabaseEnv,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    asset: {
      findMany: mockFindMany,
    },
  },
}));

import LibraryPage from "@/app/(studio)/biblioteca/page";

describe("Biblioteca", () => {
  beforeEach(() => {
    mockHasDatabaseEnv.mockReturnValue(true);
    const assets = [
      {
        id: "video-1",
        type: "VIDEO",
        url: "https://assets.example.test/generated.mp4",
        contentType: "video/mp4",
        width: 1280,
        height: 720,
        model: "fal-ai/wan-25-preview/image-to-video",
        prompt: "Um take cinematográfico",
        createdAt: new Date("2026-09-14T00:00:00.000Z"),
        generation: {
          actualCostBrl: { toString: () => "1.35" },
          prompt: "Um take cinematográfico",
        },
      },
      {
        id: "audio-1",
        type: "AUDIO",
        url: "https://assets.example.test/trilha.mp3",
        contentType: "audio/mpeg",
        width: null,
        height: null,
        model: null,
        prompt: "Trilha de apoio",
        createdAt: new Date("2026-09-14T00:00:00.000Z"),
        generation: null,
      },
    ];
    mockFindMany.mockImplementation(async (input: { where: { type: { in: string[] } } }) =>
      assets.filter((asset) => input.where.type.in.includes(asset.type)),
    );
  });

  it("exibe um vídeo persistido com player reproduzível", async () => {
    const markup = renderToStaticMarkup(await LibraryPage({}));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { in: ["IMAGE", "VIDEO"] },
        }),
      }),
    );
    expect(markup).toContain('<video src="https://assets.example.test/generated.mp4" controls=""');
    expect(markup).toContain("Um take cinematográfico");
    expect(markup).not.toContain("https://assets.example.test/trilha.mp3");
  });
});
