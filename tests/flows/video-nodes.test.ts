import { promises as fs } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NodeExecutionContext } from "@/lib/flows/types";
import { FalProvider } from "@/lib/providers/fal";

const mockPrisma = vi.hoisted(() => ({
  generation: {
    findUnique: vi.fn(),
  },
  asset: {
    create: vi.fn(),
  },
}));

const mockEnqueueVideoGenerationJob = vi.hoisted(() => vi.fn());
const mockExtractLastFrame = vi.hoisted(() => vi.fn());
const mockConcatClips = vi.hoisted(() => vi.fn());
const mockMixAudioTrack = vi.hoisted(() => vi.fn());
const mockUploadBufferAssetToSupabase = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/providers/video-generation-job", () => ({
  enqueueVideoGenerationJob: mockEnqueueVideoGenerationJob,
}));

vi.mock("@/lib/video/ffmpeg-service", () => ({
  extractLastFrame: mockExtractLastFrame,
  concatClips: mockConcatClips,
  mixAudioTrack: mockMixAudioTrack,
}));

vi.mock("@/lib/providers/asset-storage", () => ({
  uploadBufferAssetToSupabase: mockUploadBufferAssetToSupabase,
}));

vi.stubGlobal("fetch", mockFetch);

import { videoNodeDefinitions } from "@/lib/flows/video-nodes";

const videoDefinition = videoNodeDefinitions.find(
  (definition) => definition.type === "video-generation",
);
const text2VideoDefinition = videoNodeDefinitions.find(
  (definition) => definition.type === "text2video",
);
const videoExtendDefinition = videoNodeDefinitions.find(
  (definition) => definition.type === "video-extend",
);
const videoAssemblyDefinition = videoNodeDefinitions.find(
  (definition) => definition.type === "video-assembly",
);

if (
  !videoDefinition ||
  !text2VideoDefinition ||
  !videoExtendDefinition ||
  !videoAssemblyDefinition
) {
  throw new Error("video node definitions missing in test setup.");
}

const estimatedCost = {
  usd: 0.25,
  brl: 1.35,
  usdBrlRate: 5.4,
  lineItems: [],
  source: "test",
  billingMode: "api" as const,
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

describe("video-extend node", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPrisma.generation.findUnique.mockReset();
    mockEnqueueVideoGenerationJob.mockReset();
    mockExtractLastFrame.mockReset();
    mockUploadBufferAssetToSupabase.mockReset();
    mockFetch.mockReset();
    mockEnqueueVideoGenerationJob.mockResolvedValue({
      generationId: "extended-video-generation-id",
      queueJobId: "extended-video-queue-job-id",
      estimatedCost,
    });
    mockExtractLastFrame.mockResolvedValue(Buffer.from("png-frame"));
    mockUploadBufferAssetToSupabase.mockResolvedValue({
      bucket: "assets",
      path: "workspaces/workspace/generations/upstream-video-generation-id/frame.png",
      url: "https://assets.example.com/last-frame.png",
      contentType: "image/png",
      sizeBytes: 9,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name === "content-type" ? "video/mp4" : null),
      },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
  });

  it("delegates estimateCost to FalProvider as img2video", () => {
    const spy = vi
      .spyOn(FalProvider.prototype, "estimateCost")
      .mockReturnValue(estimatedCost);

    const result = videoExtendDefinition.estimateCost({
      nodeId: "extend-node",
      params: {
        model: "fal-ai/wan-25-preview/image-to-video",
        prompt: "continua o movimento",
        sceneContext: "mesma personagem, luz suave, câmera baixa",
        duration: "5",
        resolution: "480p",
      },
      inputs: {},
    });

    expect(result).toBe(estimatedCost);
    expect(spy).toHaveBeenCalledWith(
      "fal-ai/wan-25-preview/image-to-video",
      expect.objectContaining({
        prompt: "continua o movimento",
        duration: "5",
        resolution: "480p",
      }),
    );
  });

  it("waits for DONE video, extracts the last frame, uploads it and enqueues with scene context", async () => {
    mockPrisma.generation.findUnique.mockResolvedValue({
      id: "upstream-video-generation-id",
      status: "DONE",
      errorMessage: null,
      assets: [
        {
          url: "https://assets.example.com/upstream.mp4",
        },
      ],
    });

    const result = await videoExtendDefinition.execute(
      makeContext({
        nodeId: "extend-node",
        params: {
          model: "fal-ai/wan-25-preview/image-to-video",
          prompt: "a câmera segue avançando pelo corredor",
          duration: "5",
          resolution: "480p",
        },
        inputs: {
          input: {
            generationId: "upstream-video-generation-id",
            sceneContext: "mesma personagem, luz neon, câmera na mão",
            chainDepth: 0,
          },
        },
      }),
    );

    expect(mockPrisma.generation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "upstream-video-generation-id",
        },
        include: expect.objectContaining({
          assets: expect.objectContaining({
            where: {
              type: "VIDEO",
            },
          }),
        }),
      }),
    );
    expect(mockFetch).toHaveBeenCalledWith("https://assets.example.com/upstream.mp4");
    expect(mockExtractLastFrame).toHaveBeenCalledWith(expect.stringMatching(/upstream\.mp4$/));
    expect(mockUploadBufferAssetToSupabase).toHaveBeenCalledWith(
      expect.objectContaining({
        bytes: Buffer.from("png-frame"),
        workspaceId: "workspace",
        generationId: "upstream-video-generation-id",
        contentType: "image/png",
        fileName: "last-frame.png",
      }),
    );
    expect(mockEnqueueVideoGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace",
        model: "fal-ai/wan-25-preview/image-to-video",
        prompt: expect.stringContaining("mesma personagem, luz neon, câmera na mão"),
        params: expect.objectContaining({
          image_url: "https://assets.example.com/last-frame.png",
        }),
      }),
    );
    expect(result.outputs.output).toMatchObject({
      generationId: "extended-video-generation-id",
      status: "queued",
      sceneContext: "mesma personagem, luz neon, câmera na mão",
      chainDepth: 1,
    });
  });

  it("does not enqueue when upstream video Generation FAILED", async () => {
    mockPrisma.generation.findUnique.mockResolvedValue({
      id: "upstream-video-generation-id",
      status: "FAILED",
      errorMessage: "erro do provedor",
      assets: [],
    });

    await expect(
      videoExtendDefinition.execute(
        makeContext({
          params: {
            model: "fal-ai/wan-25-preview/image-to-video",
            prompt: "continua",
            sceneContext: "mesma luz",
          },
          inputs: {
            input: {
              generationId: "upstream-video-generation-id",
            },
          },
        }),
      ),
    ).rejects.toThrow(/falhou: erro do provedor.*Extensão de vídeo não enfileirada/);

    expect(mockEnqueueVideoGenerationJob).not.toHaveBeenCalled();
  });

  it("does not enqueue when waiting for upstream video times out", async () => {
    mockPrisma.generation.findUnique.mockResolvedValue({
      id: "upstream-video-generation-id",
      status: "RUNNING",
      errorMessage: null,
      assets: [],
    });

    await expect(
      videoExtendDefinition.execute(
        makeContext({
          params: {
            model: "fal-ai/wan-25-preview/image-to-video",
            prompt: "continua",
            sceneContext: "mesma luz",
            videoWaitTimeoutMs: 0,
          },
          inputs: {
            input: {
              generationId: "upstream-video-generation-id",
            },
          },
        }),
      ),
    ).rejects.toThrow(/Tempo esgotado aguardando o vídeo.*Extensão de vídeo não enfileirada/);

    expect(mockEnqueueVideoGenerationJob).not.toHaveBeenCalled();
  });

  it("does not enqueue when DONE upstream Generation has no video Asset", async () => {
    mockPrisma.generation.findUnique.mockResolvedValue({
      id: "upstream-video-generation-id",
      status: "DONE",
      errorMessage: null,
      assets: [],
    });

    await expect(
      videoExtendDefinition.execute(
        makeContext({
          params: {
            model: "fal-ai/wan-25-preview/image-to-video",
            prompt: "continua",
            sceneContext: "mesma luz",
          },
          inputs: {
            input: {
              generationId: "upstream-video-generation-id",
            },
          },
        }),
      ),
    ).rejects.toThrow(/concluiu sem Asset de vídeo/);

    expect(mockEnqueueVideoGenerationJob).not.toHaveBeenCalled();
  });

  it("propagates chainDepth from 5 to 6", async () => {
    mockPrisma.generation.findUnique.mockResolvedValue({
      id: "upstream-video-generation-id",
      status: "DONE",
      errorMessage: null,
      assets: [
        {
          url: "https://assets.example.com/upstream.mp4",
        },
      ],
    });

    const result = await videoExtendDefinition.execute(
      makeContext({
        params: {
          model: "fal-ai/wan-25-preview/image-to-video",
          prompt: "continua",
          sceneContext: "mesma luz",
        },
        inputs: {
          input: {
            generationId: "upstream-video-generation-id",
            chainDepth: 5,
          },
        },
      }),
    );

    expect(result.outputs.output).toMatchObject({
      chainDepth: 6,
    });
  });

  it("uses node sceneContext over edge sceneContext", async () => {
    mockPrisma.generation.findUnique.mockResolvedValue({
      id: "upstream-video-generation-id",
      status: "DONE",
      errorMessage: null,
      assets: [
        {
          url: "https://assets.example.com/upstream.mp4",
        },
      ],
    });

    const result = await videoExtendDefinition.execute(
      makeContext({
        params: {
          model: "fal-ai/wan-25-preview/image-to-video",
          prompt: "continua",
          sceneContext: "contexto do nó vence",
        },
        inputs: {
          input: {
            generationId: "upstream-video-generation-id",
            sceneContext: "contexto da aresta perde",
          },
        },
      }),
    );

    expect(mockEnqueueVideoGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("contexto do nó vence"),
      }),
    );
    expect(mockEnqueueVideoGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.not.stringContaining("contexto da aresta perde"),
      }),
    );
    expect(result.outputs.output).toMatchObject({
      sceneContext: "contexto do nó vence",
    });
  });

  it("fails readably before enqueue when continuation prompt and sceneContext are empty", async () => {
    await expect(
      videoExtendDefinition.execute(
        makeContext({
          params: {
            model: "fal-ai/wan-25-preview/image-to-video",
            prompt: "",
          },
          inputs: {
            input: {
              generationId: "upstream-video-generation-id",
            },
          },
        }),
      ),
    ).rejects.toThrow(/prompt de continuação ou um contexto de cena/);

    expect(mockPrisma.generation.findUnique).not.toHaveBeenCalled();
    expect(mockEnqueueVideoGenerationJob).not.toHaveBeenCalled();
  });
});

describe("video-assembly node", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPrisma.generation.findUnique.mockReset();
    mockPrisma.asset.create.mockReset();
    mockEnqueueVideoGenerationJob.mockReset();
    mockConcatClips.mockReset();
    mockMixAudioTrack.mockReset();
    mockUploadBufferAssetToSupabase.mockReset();
    mockFetch.mockReset();
    mockConcatClips.mockImplementation(async (_clipPaths, options) => {
      const bytes = Buffer.from("assembled-mp4");

      if (options?.outputPath) {
        await fs.writeFile(options.outputPath, bytes);
      }

      return bytes;
    });
    mockMixAudioTrack.mockImplementation(async (_videoPath, _audioPath, options) => {
      const bytes = Buffer.from("assembled-with-audio-mp4");

      if (options?.outputPath) {
        await fs.writeFile(options.outputPath, bytes);
      }

      return bytes;
    });
    mockUploadBufferAssetToSupabase.mockResolvedValue({
      bucket: "assets",
      path: "workspaces/workspace/flow-runs/flow-run/assembly-node/video.mp4",
      url: "https://assets.example.com/assembled.mp4",
      contentType: "video/mp4",
      sizeBytes: 13,
    });
    mockPrisma.asset.create.mockResolvedValue({
      id: "assembled-asset-id",
    });
    mockFetch.mockResolvedValue({
      ok: true,
      headers: {
        get: (name: string) => (name === "content-type" ? "video/mp4" : null),
      },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
  });

  it("has a zero estimate because concat is local", () => {
    expect(
      videoAssemblyDefinition.estimateCost({
        nodeId: "assembly-node",
        params: {},
        inputs: {},
      }),
    ).toMatchObject({
      usd: 0,
      brl: 0,
    });
  });

  it("waits for all clips, concatenates in input order and creates a deliverable Asset", async () => {
    const videosByGenerationId = new Map([
      ["gen-left", "https://assets.example.com/left.mp4"],
      ["gen-middle", "https://assets.example.com/middle.mp4"],
      ["gen-right", "https://assets.example.com/right.mp4"],
    ]);
    mockPrisma.generation.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: "DONE",
        errorMessage: null,
        assets: [
          {
            url: videosByGenerationId.get(where.id),
          },
        ],
      }),
    );

    const result = await videoAssemblyDefinition.execute(
      makeContext({
        nodeId: "assembly-node",
        params: {},
        inputs: {
          input: [
            { generationId: "gen-left" },
            { generationId: "gen-middle" },
            { generationId: "gen-right" },
          ],
        },
      }),
    );

    expect(mockEnqueueVideoGenerationJob).not.toHaveBeenCalled();
    expect(mockPrisma.generation.findUnique).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://assets.example.com/left.mp4",
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://assets.example.com/middle.mp4",
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      "https://assets.example.com/right.mp4",
    );
    expect(mockConcatClips).toHaveBeenCalledWith(
      [
        expect.stringMatching(/clip-001\.mp4$/),
        expect.stringMatching(/clip-002\.mp4$/),
        expect.stringMatching(/clip-003\.mp4$/),
      ],
      expect.objectContaining({
        outputPath: expect.stringMatching(/montagem-concat\.mp4$/),
      }),
    );
    expect(mockMixAudioTrack).not.toHaveBeenCalled();
    expect(mockUploadBufferAssetToSupabase).toHaveBeenCalledWith(
      expect.objectContaining({
        bytes: Buffer.from("assembled-mp4"),
        workspaceId: "workspace",
        keyPrefix: "workspaces/workspace/flow-runs/flow-run/assembly-node",
        contentType: "video/mp4",
        fileName: "montagem.mp4",
      }),
    );
    expect(mockPrisma.asset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace",
        generationId: null,
        type: "VIDEO",
        origin: "GENERATED",
        url: "https://assets.example.com/assembled.mp4",
        storageBucket: "assets",
        storagePath: "workspaces/workspace/flow-runs/flow-run/assembly-node/video.mp4",
        contentType: "video/mp4",
        sizeBytes: 13,
        provider: "labia/ffmpeg",
        model: "concat",
        metadata: {
          clipCount: 3,
          sourceGenerationIds: ["gen-left", "gen-middle", "gen-right"],
          flowRunId: "flow-run",
          nodeId: "assembly-node",
          hasAudioTrack: false,
        },
      }),
    });
    expect(result).toMatchObject({
      outputs: {
        output: {
          assetId: "assembled-asset-id",
          url: "https://assets.example.com/assembled.mp4",
          type: "video",
          status: "done",
          clipCount: 3,
        },
        assetId: "assembled-asset-id",
        url: "https://assets.example.com/assembled.mp4",
      },
      actualCost: {
        usd: 0,
        brl: 0,
      },
    });
  });

  it("fails readably and creates no Asset when fewer than two clips are connected", async () => {
    await expect(
      videoAssemblyDefinition.execute(
        makeContext({
          nodeId: "assembly-node",
          params: {},
          inputs: {
            input: [{ generationId: "only-one" }],
          },
        }),
      ),
    ).rejects.toThrow(/Conecte ao menos dois clipes para montar/);

    expect(mockPrisma.generation.findUnique).not.toHaveBeenCalled();
    expect(mockConcatClips).not.toHaveBeenCalled();
    expect(mockMixAudioTrack).not.toHaveBeenCalled();
    expect(mockUploadBufferAssetToSupabase).not.toHaveBeenCalled();
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
  });

  it("fails readably and creates no Asset when any source Generation failed", async () => {
    mockPrisma.generation.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: where.id === "failed-gen" ? "FAILED" : "DONE",
        errorMessage: where.id === "failed-gen" ? "erro do provedor" : null,
        assets:
          where.id === "failed-gen"
            ? []
            : [
                {
                  url: `https://assets.example.com/${where.id}.mp4`,
                },
              ],
      }),
    );

    await expect(
      videoAssemblyDefinition.execute(
        makeContext({
          nodeId: "assembly-node",
          params: {},
          inputs: {
            input: [{ generationId: "done-gen" }, { generationId: "failed-gen" }],
          },
        }),
      ),
    ).rejects.toThrow(/falhou: erro do provedor.*Montagem não criada/);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockConcatClips).not.toHaveBeenCalled();
    expect(mockMixAudioTrack).not.toHaveBeenCalled();
    expect(mockUploadBufferAssetToSupabase).not.toHaveBeenCalled();
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
  });

  it("mixes an uploaded audio track when audioAssetUrl is configured", async () => {
    const videosByGenerationId = new Map([
      ["gen-left", "https://assets.example.com/left.mp4"],
      ["gen-right", "https://assets.example.com/right.mp4"],
    ]);
    mockPrisma.generation.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        status: "DONE",
        errorMessage: null,
        assets: [
          {
            url: videosByGenerationId.get(where.id),
          },
        ],
      }),
    );
    mockFetch.mockImplementation(async (url: string) => ({
      ok: true,
      headers: {
        get: (name: string) =>
          name === "content-type" && url.endsWith(".mp3")
            ? "audio/mpeg"
            : "video/mp4",
      },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }));

    const result = await videoAssemblyDefinition.execute(
      makeContext({
        nodeId: "assembly-node",
        params: {
          audioAssetId: "audio-asset-id",
          audioAssetUrl: "https://assets.example.com/track.mp3",
        },
        inputs: {
          input: [{ generationId: "gen-left" }, { generationId: "gen-right" }],
        },
      }),
    );

    expect(mockConcatClips).toHaveBeenCalledWith(
      [
        expect.stringMatching(/clip-001\.mp4$/),
        expect.stringMatching(/clip-002\.mp4$/),
      ],
      expect.objectContaining({
        outputPath: expect.stringMatching(/montagem-concat\.mp4$/),
      }),
    );
    expect(mockMixAudioTrack).toHaveBeenCalledWith(
      expect.stringMatching(/montagem-concat\.mp4$/),
      expect.stringMatching(/trilha\.mp3$/),
      expect.objectContaining({
        outputPath: expect.stringMatching(/montagem-com-trilha\.mp4$/),
        trackVolume: 1,
        originalVolume: 1,
      }),
    );
    expect(mockUploadBufferAssetToSupabase).toHaveBeenCalledWith(
      expect.objectContaining({
        bytes: Buffer.from("assembled-with-audio-mp4"),
      }),
    );
    expect(mockPrisma.asset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          clipCount: 2,
          sourceGenerationIds: ["gen-left", "gen-right"],
          flowRunId: "flow-run",
          nodeId: "assembly-node",
          audioAssetId: "audio-asset-id",
          hasAudioTrack: true,
        },
      }),
    });
    expect(result.outputs.output).toMatchObject({
      audioAssetId: "audio-asset-id",
      clipCount: 2,
    });
  });
});

describe("text2video node", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockPrisma.generation.findUnique.mockReset();
    mockEnqueueVideoGenerationJob.mockReset();
    mockEnqueueVideoGenerationJob.mockResolvedValue({
      generationId: "text-video-generation-id",
      queueJobId: "text-video-queue-job-id",
      estimatedCost,
    });
  });

  it("delegates estimateCost to FalProvider without image_url", () => {
    const spy = vi
      .spyOn(FalProvider.prototype, "estimateCost")
      .mockReturnValue(estimatedCost);

    const result = text2VideoDefinition.estimateCost({
      nodeId: "text2video-node",
      params: {
        model: "fal-ai/wan-25-preview/image-to-video",
        prompt: "produto girando em luz suave",
        duration: "5",
        resolution: "480p",
      },
      inputs: {},
    });

    expect(result).toBe(estimatedCost);
    expect(spy).toHaveBeenCalledWith(
      "fal-ai/wan-25-preview/image-to-video",
      expect.not.objectContaining({
        image_url: expect.anything(),
      }),
    );
  });

  it("enqueues video with the prompt from the connected text input", async () => {
    const result = await text2VideoDefinition.execute(
      makeContext({
        nodeId: "text2video-node",
        params: {
          model: "fal-ai/wan-25-preview/image-to-video",
          prompt: "",
          duration: "5",
          resolution: "480p",
        },
        inputs: {
          input: {
            prompt: "câmera orbita o produto em ritmo lento",
          },
        },
      }),
    );

    expect(mockPrisma.generation.findUnique).not.toHaveBeenCalled();
    expect(mockEnqueueVideoGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace",
        model: "fal-ai/wan-25-preview/image-to-video",
        prompt: "câmera orbita o produto em ritmo lento",
        params: expect.not.objectContaining({
          image_url: expect.anything(),
        }),
      }),
    );
    expect(result.outputs.output).toMatchObject({
      generationId: "text-video-generation-id",
      status: "queued",
      model: "fal-ai/wan-25-preview/image-to-video",
      estimatedCost,
    });
  });

  it("fails readably and does not enqueue without a prompt", async () => {
    await expect(
      text2VideoDefinition.execute(
        makeContext({
          nodeId: "text2video-node",
          params: {
            model: "fal-ai/wan-25-preview/image-to-video",
            prompt: "",
            duration: "5",
            resolution: "480p",
          },
          inputs: {},
        }),
      ),
    ).rejects.toThrow(/Prompt obrigatório para gerar vídeo a partir de texto/);

    expect(mockEnqueueVideoGenerationJob).not.toHaveBeenCalled();
  });
});
