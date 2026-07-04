import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NodeExecutionContext } from "@/lib/flows/types";
import { FalProvider } from "@/lib/providers/fal";

const mockPrisma = vi.hoisted(() => ({
  generation: {
    findUnique: vi.fn(),
  },
}));

const mockEnqueueVideoGenerationJob = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/providers/video-generation-job", () => ({
  enqueueVideoGenerationJob: mockEnqueueVideoGenerationJob,
}));

import { videoNodeDefinitions } from "@/lib/flows/video-nodes";

const videoDefinition = videoNodeDefinitions.find(
  (definition) => definition.type === "video-generation",
);

if (!videoDefinition) {
  throw new Error("video-generation definition missing in test setup.");
}

const estimatedCost = {
  usd: 0.25,
  brl: 1.35,
  usdBrlRate: 5.4,
  lineItems: [],
  source: "test",
};

function makeContext(
  overrides: Partial<NodeExecutionContext> = {},
): NodeExecutionContext {
  return {
    nodeId: "video-node",
    flowRunId: "flow-run",
    workspaceId: "workspace",
    params: {
      model: "fal-ai/wan-25-preview/image-to-video",
      prompt: "câmera aproxima lentamente",
      duration: "5",
      resolution: "480p",
    },
    inputs: {},
    ...overrides,
  };
}

describe("video-generation node", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPrisma.generation.findUnique.mockReset();
    mockEnqueueVideoGenerationJob.mockReset();
    mockEnqueueVideoGenerationJob.mockResolvedValue({
      generationId: "video-generation-id",
      queueJobId: "queue-job-id",
      estimatedCost,
    });
  });

  it.each([
    ["fal-ai/wan-25-preview/image-to-video", { duration: "5", resolution: "480p" }],
    ["fal-ai/kling-video/v2.5-turbo/pro/image-to-video", { duration: "5" }],
    ["fal-ai/minimax/hailuo-2.3/standard/image-to-video", { duration: "6" }],
    ["bytedance/seedance-2.0/image-to-video", { duration: "5", resolution: "720p" }],
    ["fal-ai/veo3/image-to-video", { duration: "8s", generate_audio: true }],
  ])("delegates estimateCost to FalProvider for %s", (model, params) => {
    const spy = vi
      .spyOn(FalProvider.prototype, "estimateCost")
      .mockReturnValue(estimatedCost);

    const result = videoDefinition.estimateCost({
      nodeId: "video-node",
      params: {
        model,
        prompt: "câmera aproxima lentamente",
        ...params,
      },
      inputs: {},
    });

    expect(result).toBe(estimatedCost);
    expect(spy).toHaveBeenCalledWith(
      model,
      expect.objectContaining({
        prompt: "câmera aproxima lentamente",
        ...params,
      }),
    );
  });

  it("waits for a DONE image Generation and enqueues video with the image Asset URL", async () => {
    mockPrisma.generation.findUnique.mockResolvedValue({
      id: "image-generation-id",
      status: "DONE",
      errorMessage: null,
      assets: [
        {
          url: "https://assets.example.com/input.png",
        },
      ],
    });

    const result = await videoDefinition.execute(
      makeContext({
        inputs: {
          input: {
            generationId: "image-generation-id",
            status: "queued",
          },
        },
      }),
    );

    expect(mockPrisma.generation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "image-generation-id",
        },
      }),
    );
    expect(mockEnqueueVideoGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace",
        model: "fal-ai/wan-25-preview/image-to-video",
        prompt: "câmera aproxima lentamente",
        params: expect.objectContaining({
          image_url: "https://assets.example.com/input.png",
        }),
      }),
    );
    expect(result.outputs.output).toMatchObject({
      generationId: "video-generation-id",
      status: "queued",
      model: "fal-ai/wan-25-preview/image-to-video",
      estimatedCost,
    });
  });

  it("fails readably and does not enqueue when the image Generation FAILED", async () => {
    mockPrisma.generation.findUnique.mockResolvedValue({
      id: "image-generation-id",
      status: "FAILED",
      errorMessage: "saldo esgotado",
      assets: [],
    });

    await expect(
      videoDefinition.execute(
        makeContext({
          inputs: {
            input: {
              generationId: "image-generation-id",
            },
          },
        }),
      ),
    ).rejects.toThrow(/falhou: saldo esgotado.*Vídeo não enfileirado/);

    expect(mockEnqueueVideoGenerationJob).not.toHaveBeenCalled();
  });

  it("fails readably and does not enqueue when no image is provided", async () => {
    await expect(videoDefinition.execute(makeContext())).rejects.toThrow(
      /Imagem obrigatória para gerar vídeo/,
    );

    expect(mockPrisma.generation.findUnique).not.toHaveBeenCalled();
    expect(mockEnqueueVideoGenerationJob).not.toHaveBeenCalled();
  });

  it("times out readably while waiting for the image and does not enqueue", async () => {
    mockPrisma.generation.findUnique.mockResolvedValue({
      id: "image-generation-id",
      status: "QUEUED",
      errorMessage: null,
      assets: [],
    });

    await expect(
      videoDefinition.execute(
        makeContext({
          params: {
            model: "fal-ai/wan-25-preview/image-to-video",
            prompt: "câmera aproxima lentamente",
            duration: "5",
            resolution: "480p",
            imageWaitTimeoutMs: 0,
          },
          inputs: {
            input: {
              generationId: "image-generation-id",
            },
          },
        }),
      ),
    ).rejects.toThrow(/Tempo esgotado aguardando a imagem.*Vídeo não enfileirado/);

    expect(mockEnqueueVideoGenerationJob).not.toHaveBeenCalled();
  });
});
