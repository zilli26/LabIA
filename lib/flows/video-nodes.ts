import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { NodeDefinition } from "@/lib/flows/types";
import { zeroCost } from "@/lib/flows/types";
import { FAL_VIDEO_MODELS } from "@/lib/providers/fal-models";
import { FalProvider } from "@/lib/providers/fal";
import type { CostEstimate, GenParams } from "@/lib/providers/model-provider";

const DEFAULT_VIDEO_MODEL = "fal-ai/wan-25-preview/image-to-video";
const DEFAULT_GENERATION_WAIT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_GENERATION_POLL_INTERVAL_MS = 2000;

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getModel(params: Record<string, unknown>) {
  return getString(params.model) ?? DEFAULT_VIDEO_MODEL;
}

function getPrompt(params: Record<string, unknown>) {
  return (
    getString(params.prompt) ??
    getString(params.motionPrompt) ??
    getString(params.motion_prompt)
  );
}

function getPromptFromInput(input: unknown) {
  if (typeof input === "string") {
    return input;
  }

  const record = getRecord(input);

  if (!record) {
    return undefined;
  }

  return (
    getString(record.prompt) ??
    getString(record.text) ??
    getString(record.output)
  );
}

function getSceneContextFromInput(input: unknown) {
  const record = getRecord(input);

  if (!record) {
    return undefined;
  }

  return getString(record.sceneContext);
}

function getChainDepthFromInput(input: unknown) {
  const record = getRecord(input);

  if (!record) {
    return undefined;
  }

  return getNumber(record.chainDepth);
}

function getDirectImageUrl(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  const record = getRecord(value);

  if (!record) {
    return undefined;
  }

  return (
    getString(record.image_url) ??
    getString(record.imageUrl) ??
    getString(record.assetUrl) ??
    getString(record.url)
  );
}

function getGenerationId(value: unknown): string | undefined {
  const record = getRecord(value);
  return record ? getString(record.generationId) : undefined;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildVideoParams({
  params,
  prompt,
  imageUrl,
  includeImage = true,
}: {
  params: Record<string, unknown>;
  prompt: string;
  imageUrl?: string;
  includeImage?: boolean;
}): GenParams {
  const generationParams = {
    ...Object.fromEntries(
      Object.entries(params).filter(
        ([key]) =>
          ![
            "model",
            "prompt",
            "motionPrompt",
            "motion_prompt",
            "assetUrl",
            "imageUrl",
            "image_url",
            "generationId",
            "sceneContext",
            "chainDepth",
            "imageWaitTimeoutMs",
            "imagePollIntervalMs",
            "videoWaitTimeoutMs",
            "videoPollIntervalMs",
          ].includes(key),
      ),
    ),
    prompt,
  };

  if (!includeImage) {
    return generationParams;
  }

  return {
    ...generationParams,
    image_url: imageUrl ?? getDirectImageUrl(params),
  };
}

function estimateVideoCost(
  params: Record<string, unknown>,
  options: {
    includeImage?: boolean;
  } = {},
): CostEstimate {
  const provider = new FalProvider();
  const prompt = getPrompt(params) ?? "placeholder";

  return provider.estimateCost(
    getModel(params),
    buildVideoParams({
      params,
      prompt,
      includeImage: options.includeImage,
    }),
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGenerationAssetUrl({
  generationId,
  assetType,
  generationLabel,
  waitingLabel,
  readyLabel,
  notQueuedMessage,
  timeoutMs,
  pollIntervalMs,
}: {
  generationId: string;
  assetType: "IMAGE" | "VIDEO";
  generationLabel: string;
  waitingLabel: string;
  readyLabel: string;
  notQueuedMessage: string;
  timeoutMs: number;
  pollIntervalMs: number;
}) {
  const startedAt = Date.now();

  while (true) {
    const generation = await prisma.generation.findUnique({
      where: {
        id: generationId,
      },
      include: {
        assets: {
          where: {
            type: assetType,
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 1,
        },
      },
    });

    if (!generation) {
      throw new Error(`Generation de ${generationLabel} não encontrada: ${generationId}.`);
    }

    if (generation.status === "DONE") {
      const assetUrl = generation.assets[0]?.url;

      if (!assetUrl) {
        throw new Error(
          `Generation de ${generationLabel} ${generationId} concluiu sem Asset de ${generationLabel}.`,
        );
      }

      return assetUrl;
    }

    if (generation.status === "FAILED") {
      throw new Error(
        `Generation de ${generationLabel} ${generationId} falhou: ${
          generation.errorMessage ?? "erro sem detalhe registrado"
        }. ${notQueuedMessage}`,
      );
    }

    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        `Tempo esgotado aguardando ${waitingLabel} ${generationId} ficar ${readyLabel}. ${notQueuedMessage}`,
      );
    }

    await sleep(pollIntervalMs);
  }
}

async function resolveImageUrl({
  input,
  params,
}: {
  input: unknown;
  params: Record<string, unknown>;
}) {
  const directUrl = getDirectImageUrl(params) ?? getDirectImageUrl(input);

  if (directUrl) {
    return directUrl;
  }

  const generationId = getString(params.generationId) ?? getGenerationId(input);

  if (!generationId) {
    throw new Error(
      "Imagem obrigatória para gerar vídeo. Conecte uma imagem pronta ou informe uma URL de asset.",
    );
  }

  return waitForGenerationAssetUrl({
    generationId,
    assetType: "IMAGE",
    generationLabel: "imagem",
    waitingLabel: "a imagem",
    readyLabel: "pronta",
    notQueuedMessage: "Vídeo não enfileirado.",
    timeoutMs:
      getNumber(params.imageWaitTimeoutMs) ?? DEFAULT_GENERATION_WAIT_TIMEOUT_MS,
    pollIntervalMs:
      getNumber(params.imagePollIntervalMs) ?? DEFAULT_GENERATION_POLL_INTERVAL_MS,
  });
}

async function resolveUpstreamVideoUrl({
  input,
  params,
}: {
  input: unknown;
  params: Record<string, unknown>;
}) {
  const generationId = getString(params.generationId) ?? getGenerationId(input);

  if (!generationId) {
    throw new Error(
      "Vídeo obrigatório para estender. Conecte um nó de vídeo com generationId.",
    );
  }

  const assetUrl = await waitForGenerationAssetUrl({
    generationId,
    assetType: "VIDEO",
    generationLabel: "vídeo",
    waitingLabel: "o vídeo",
    readyLabel: "pronto",
    notQueuedMessage: "Extensão de vídeo não enfileirada.",
    timeoutMs:
      getNumber(params.videoWaitTimeoutMs) ?? DEFAULT_GENERATION_WAIT_TIMEOUT_MS,
    pollIntervalMs:
      getNumber(params.videoPollIntervalMs) ?? DEFAULT_GENERATION_POLL_INTERVAL_MS,
  });

  return {
    generationId,
    assetUrl,
  };
}

async function resolveAssemblyClip(
  input: unknown,
  params: Record<string, unknown>,
) {
  const generationId = getGenerationId(input);

  if (generationId) {
    const assetUrl = await waitForGenerationAssetUrl({
      generationId,
      assetType: "VIDEO",
      generationLabel: "vídeo",
      waitingLabel: "o vídeo",
      readyLabel: "pronto",
      notQueuedMessage: "Montagem não criada.",
      timeoutMs:
        getNumber(params.videoWaitTimeoutMs) ?? DEFAULT_GENERATION_WAIT_TIMEOUT_MS,
      pollIntervalMs:
        getNumber(params.videoPollIntervalMs) ??
        DEFAULT_GENERATION_POLL_INTERVAL_MS,
    });

    return {
      generationId,
      assetUrl,
    };
  }

  const directUrl = getDirectImageUrl(input);

  if (directUrl) {
    return {
      generationId: undefined,
      assetUrl: directUrl,
    };
  }

  throw new Error(
    "Clipe inválido na Montagem. Conecte vídeos prontos ou nós de vídeo com generationId.",
  );
}

function getExtensionFromContentType(contentType: string) {
  if (contentType.includes("mp4")) {
    return "mp4";
  }

  if (contentType.includes("quicktime")) {
    return "mov";
  }

  if (contentType.includes("webm")) {
    return "webm";
  }

  return "mp4";
}

async function downloadVideoToTemp(
  sourceUrl: string,
  options: {
    directory?: string;
    fileBaseName?: string;
  } = {},
) {
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(`Falha ao baixar vídeo upstream (${response.status}).`);
  }

  const contentType =
    response.headers.get("content-type") ?? "application/octet-stream";
  const bytes = Buffer.from(await response.arrayBuffer());
  const directory =
    options.directory ??
    (await fs.mkdtemp(path.join(os.tmpdir(), "labia-video-extend-")));
  const videoPath = path.join(
    directory,
    `${options.fileBaseName ?? "upstream"}.${getExtensionFromContentType(contentType)}`,
  );

  await fs.writeFile(videoPath, bytes);

  return {
    videoPath,
    cleanup: () =>
      options.directory
        ? Promise.resolve()
        : fs.rm(directory, { recursive: true, force: true }),
  };
}

function normalizeClipInputs(input: unknown) {
  return Array.isArray(input) ? input : [input];
}

function buildContinuationPrompt({
  continuation,
  sceneContext,
}: {
  continuation: string;
  sceneContext?: string;
}) {
  const trimmedContinuation = continuation.trim();
  const trimmedSceneContext = sceneContext?.trim();

  if (!trimmedContinuation && !trimmedSceneContext) {
    throw new Error(
      "Informe um prompt de continuação ou um contexto de cena para estender o vídeo.",
    );
  }

  if (!trimmedSceneContext) {
    return trimmedContinuation;
  }

  if (!trimmedContinuation) {
    return `Contexto de cena: ${trimmedSceneContext}`;
  }

  return `${trimmedContinuation}\n\nContexto de cena: ${trimmedSceneContext}`;
}

export const videoNodeDefinitions: NodeDefinition[] = [
  {
    type: "video-generation",
    label: "Gerar Vídeo",
    description: "Gera img2video via fal.ai com custo estimado antes do gasto.",
    inputs: [
      {
        id: "input",
        label: "Imagem",
        type: "image",
        required: true,
      },
    ],
    outputs: [
      {
        id: "output",
        label: "Vídeo",
        type: "video",
      },
    ],
    estimateCost(ctx) {
      return estimateVideoCost(ctx.params, { includeImage: true });
    },
    async execute(ctx) {
      const prompt = getPrompt(ctx.params) ?? "";

      if (!prompt.trim()) {
        throw new Error("Prompt de movimento obrigatório para gerar vídeo.");
      }

      const imageUrl = await resolveImageUrl({
        input: ctx.inputs.input,
        params: ctx.params,
      });
      const model = getModel(ctx.params);
      const generationParams = buildVideoParams({
        params: ctx.params,
        prompt,
        imageUrl,
      });
      const { enqueueVideoGenerationJob } = await import(
        "@/lib/providers/video-generation-job"
      );
      const queued = await enqueueVideoGenerationJob({
        workspaceId: ctx.workspaceId,
        model,
        prompt,
        params: generationParams,
        flowRunId: ctx.flowRunId,
        flowNodeId: ctx.nodeId,
      });

      return {
        outputs: {
          output: {
            generationId: queued.generationId,
            queueJobId: queued.queueJobId,
            status: "queued",
            prompt,
            model,
            estimatedCost: queued.estimatedCost,
          },
          generationId: queued.generationId,
          queueJobId: queued.queueJobId,
          prompt,
          model,
        },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "video-generation",
    },
  },
  {
    type: "video-extend",
    label: "Estender Vídeo",
    description: "Extrai o último frame do clipe anterior e gera a continuação.",
    inputs: [
      {
        id: "input",
        label: "Vídeo",
        type: "video",
        required: true,
      },
    ],
    outputs: [
      {
        id: "output",
        label: "Vídeo",
        type: "video",
      },
    ],
    estimateCost(ctx) {
      return estimateVideoCost(ctx.params, { includeImage: true });
    },
    async execute(ctx) {
      const continuationPrompt = getPrompt(ctx.params) ?? "";
      const sceneContext =
        getString(ctx.params.sceneContext) ??
        getSceneContextFromInput(ctx.inputs.input);
      const prompt = buildContinuationPrompt({
        continuation: continuationPrompt,
        sceneContext,
      });
      const upstreamVideo = await resolveUpstreamVideoUrl({
        input: ctx.inputs.input,
        params: ctx.params,
      });
      const tempVideo = await downloadVideoToTemp(upstreamVideo.assetUrl);

      try {
        const { extractLastFrame } = await import("@/lib/video/ffmpeg-service");
        const { uploadBufferAssetToSupabase } = await import(
          "@/lib/providers/asset-storage"
        );
        const frame = await extractLastFrame(tempVideo.videoPath);
        const uploadedFrame = await uploadBufferAssetToSupabase({
          bytes: frame,
          workspaceId: ctx.workspaceId,
          generationId: upstreamVideo.generationId,
          contentType: "image/png",
          fileName: "last-frame.png",
        });
        const model = getModel(ctx.params);
        const generationParams = buildVideoParams({
          params: ctx.params,
          prompt,
          imageUrl: uploadedFrame.url,
        });
        const { enqueueVideoGenerationJob } = await import(
          "@/lib/providers/video-generation-job"
        );
        const queued = await enqueueVideoGenerationJob({
          workspaceId: ctx.workspaceId,
          model,
          prompt,
          params: generationParams,
          flowRunId: ctx.flowRunId,
          flowNodeId: ctx.nodeId,
        });
        const chainDepth = (getChainDepthFromInput(ctx.inputs.input) ?? 0) + 1;
        const effectiveSceneContext = sceneContext?.trim() || undefined;

        return {
          outputs: {
            output: {
              generationId: queued.generationId,
              queueJobId: queued.queueJobId,
              status: "queued",
              prompt,
              model,
              estimatedCost: queued.estimatedCost,
              sceneContext: effectiveSceneContext,
              chainDepth,
            },
            generationId: queued.generationId,
            queueJobId: queued.queueJobId,
            prompt,
            model,
            sceneContext: effectiveSceneContext,
            chainDepth,
          },
          actualCost: zeroCost,
        };
      } finally {
        await tempVideo.cleanup();
      }
    },
    ui: {
      componentKey: "labNode",
      kind: "video-extend",
    },
  },
  {
    type: "video-assembly",
    label: "Montagem",
    description: "Concatena clipes localmente em um MP4 único com custo R$0.",
    inputs: [
      {
        id: "input",
        label: "Clipes",
        type: "video",
        required: true,
        multiple: true,
      },
    ],
    outputs: [
      {
        id: "output",
        label: "Vídeo",
        type: "video",
      },
    ],
    estimateCost() {
      return zeroCost;
    },
    async execute(ctx) {
      const clipInputs = normalizeClipInputs(ctx.inputs.input);

      if (clipInputs.length < 2) {
        throw new Error("Conecte ao menos dois clipes para montar.");
      }

      const resolvedClips = [];

      for (const clipInput of clipInputs) {
        resolvedClips.push(await resolveAssemblyClip(clipInput, ctx.params));
      }

      const tempDirectory = await fs.mkdtemp(
        path.join(os.tmpdir(), "labia-video-assembly-"),
      );

      try {
        const tempVideos = await Promise.all(
          resolvedClips.map((clip, index) =>
            downloadVideoToTemp(clip.assetUrl, {
              directory: tempDirectory,
              fileBaseName: `clip-${String(index + 1).padStart(3, "0")}`,
            }),
          ),
        );
        const { concatClips } = await import("@/lib/video/ffmpeg-service");
        const assembledVideo = await concatClips(
          tempVideos.map((video) => video.videoPath),
        );
        const { uploadBufferAssetToSupabase } = await import(
          "@/lib/providers/asset-storage"
        );
        const uploadedVideo = await uploadBufferAssetToSupabase({
          bytes: assembledVideo,
          workspaceId: ctx.workspaceId,
          keyPrefix: `workspaces/${ctx.workspaceId}/flow-runs/${ctx.flowRunId}/${ctx.nodeId}`,
          contentType: "video/mp4",
          fileName: "montagem.mp4",
        });
        const sourceGenerationIds = resolvedClips
          .map((clip) => clip.generationId)
          .filter((generationId): generationId is string => Boolean(generationId));
        const asset = await prisma.asset.create({
          data: {
            workspaceId: ctx.workspaceId,
            generationId: null,
            type: "VIDEO",
            origin: "GENERATED",
            url: uploadedVideo.url,
            storageBucket: uploadedVideo.bucket,
            storagePath: uploadedVideo.path,
            contentType: uploadedVideo.contentType,
            sizeBytes: uploadedVideo.sizeBytes,
            provider: "labia/ffmpeg",
            model: "concat",
            metadata: toJson({
              clipCount: resolvedClips.length,
              sourceGenerationIds,
              flowRunId: ctx.flowRunId,
              nodeId: ctx.nodeId,
            }),
          },
        });

        return {
          outputs: {
            output: {
              assetId: asset.id,
              url: uploadedVideo.url,
              type: "video",
              status: "done",
              clipCount: resolvedClips.length,
            },
            assetId: asset.id,
            url: uploadedVideo.url,
          },
          actualCost: zeroCost,
        };
      } finally {
        await fs.rm(tempDirectory, { recursive: true, force: true });
      }
    },
    ui: {
      componentKey: "labNode",
      kind: "video-assembly",
    },
  },
  {
    type: "text2video",
    label: "Texto para Vídeo",
    description: "Gera vídeo direto de texto via fal.ai, sem imagem de entrada.",
    inputs: [
      {
        id: "input",
        label: "Prompt",
        type: "text",
      },
    ],
    outputs: [
      {
        id: "output",
        label: "Vídeo",
        type: "video",
      },
    ],
    estimateCost(ctx) {
      return estimateVideoCost(ctx.params, { includeImage: false });
    },
    async execute(ctx) {
      const prompt =
        getPromptFromInput(ctx.inputs.input) ?? getPrompt(ctx.params) ?? "";

      if (!prompt.trim()) {
        throw new Error("Prompt obrigatório para gerar vídeo a partir de texto.");
      }

      const model = getModel(ctx.params);
      const generationParams = buildVideoParams({
        params: ctx.params,
        prompt,
        includeImage: false,
      });
      const { enqueueVideoGenerationJob } = await import(
        "@/lib/providers/video-generation-job"
      );
      const queued = await enqueueVideoGenerationJob({
        workspaceId: ctx.workspaceId,
        model,
        prompt,
        params: generationParams,
        flowRunId: ctx.flowRunId,
        flowNodeId: ctx.nodeId,
      });

      return {
        outputs: {
          output: {
            generationId: queued.generationId,
            queueJobId: queued.queueJobId,
            status: "queued",
            prompt,
            model,
            estimatedCost: queued.estimatedCost,
          },
          generationId: queued.generationId,
          queueJobId: queued.queueJobId,
          prompt,
          model,
        },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "text2video",
    },
  },
];

export const videoGenerationModelOptions = FAL_VIDEO_MODELS.map((model) => ({
  id: model.id,
  name: model.name,
  pricing: model.pricing,
  supportedDurations: model.supportedDurations,
  nativeAudio: model.nativeAudio,
  defaultInput: model.defaultInput,
}));
