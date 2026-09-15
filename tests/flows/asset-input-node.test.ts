import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NodeExecutionContext } from "@/lib/flows/types";

const mockPrisma = vi.hoisted(() => ({
  flowRun: {
    findFirst: vi.fn(),
  },
  asset: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

import { getNodeDefinition } from "@/lib/flows/registry";
import { zeroCost } from "@/lib/flows/types";

const assetInputDefinition = getNodeDefinition("asset-input");

if (!assetInputDefinition) {
  throw new Error("asset-input node definition missing in test setup.");
}

function makeContext(
  overrides: Partial<NodeExecutionContext> = {},
): NodeExecutionContext {
  return {
    nodeId: "asset-input-node",
    flowRunId: "flow-run",
    workspaceId: "workspace-a",
    params: { assetId: "asset-image", projectRole: "source" },
    inputs: {},
    ...overrides,
  };
}

describe("asset-input node", () => {
  beforeEach(() => {
    mockPrisma.flowRun.findFirst.mockReset();
    mockPrisma.asset.findFirst.mockReset();
    mockPrisma.flowRun.findFirst.mockResolvedValue({
      flow: { projectId: "project-a" },
    });
  });

  it("is registered with typed image/video outputs and zero cost", () => {
    expect(assetInputDefinition.inputs).toEqual([]);
    expect(assetInputDefinition.outputs).toEqual([
      { id: "image", label: "Imagem", type: "image" },
      { id: "video", label: "Vídeo", type: "video" },
    ]);
    expect(assetInputDefinition.estimateCost({ nodeId: "asset-input-node", params: {}, inputs: {} })).toEqual(zeroCost);
  });

  it("resolves an uploaded image from the same project and workspace", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      id: "asset-image",
      url: "https://storage.example.com/project-a/source.png",
      type: "IMAGE",
      origin: "UPLOADED",
      metadata: { originalFileName: "source.png", projectRole: "source" },
    });

    const result = await assetInputDefinition.execute(makeContext());

    expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith({
      where: {
        id: "asset-image",
        workspaceId: "workspace-a",
        projectId: "project-a",
        origin: "UPLOADED",
        type: { in: ["IMAGE", "VIDEO"] },
      },
      select: {
        id: true,
        url: true,
        type: true,
        origin: true,
        metadata: true,
      },
    });
    expect(result.outputs).toEqual({
      image: {
        assetId: "asset-image",
        url: "https://storage.example.com/project-a/source.png",
        type: "image",
        projectRole: "source",
      },
    });
    expect(result.actualCost).toEqual(zeroCost);
  });

  it("resolves an uploaded video through the typed video output", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      id: "asset-video",
      url: "https://storage.example.com/project-a/source.webm",
      type: "VIDEO",
      origin: "UPLOADED",
      metadata: { originalFileName: "source.webm", projectRole: "source" },
    });

    const result = await assetInputDefinition.execute(
      makeContext({ params: { assetId: "asset-video", projectRole: "source" } }),
    );

    expect(result.outputs).toEqual({
      video: {
        assetId: "asset-video",
        url: "https://storage.example.com/project-a/source.webm",
        type: "video",
        projectRole: "source",
      },
    });
    expect(result.actualCost).toEqual(zeroCost);
  });

  it("rejects an Asset that is absent from the Flow Project scope", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue(null);

    await expect(assetInputDefinition.execute(makeContext())).rejects.toThrow(
      /Asset .* Projeto do Flow/,
    );
  });

  it("requires an explicit selected Asset", async () => {
    await expect(
      assetInputDefinition.execute(
        makeContext({ params: { projectRole: "source" } }),
      ),
    ).rejects.toThrow(/Selecione um Asset/);
    expect(mockPrisma.asset.findFirst).not.toHaveBeenCalled();
  });
});
