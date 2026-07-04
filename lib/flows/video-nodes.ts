import { prisma } from "@/lib/db/prisma";
import type { NodeDefinition } from "@/lib/flows/types";
import { zeroCost } from "@/lib/flows/types";
import { FAL_VIDEO_MODELS } from "@/lib/providers/fal-models";
import { FalProvider } from "@/lib/providers/fal";
import type { CostEstimate, GenParams } from "@/lib/providers/model-provider";

const DEFAULT_VIDEO_MODEL = "fal-ai/wan-25-preview/image-to-video";
const DEFAULT_IMAGE_WAIT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_IMAGE_POLL_INTERVAL_MS = 2000;

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

function buildVideoParams({
  params,
  prompt,
  imageUrl,
}: {
  params: Record<string, unknown>;
  prompt: string;
  imageUrl?: string;
}): GenParams {
  return {
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
            "imageWaitTimeoutMs",
            "imagePollIntervalMs",
          ].includes(key),
      ),
    ),
    prompt,
    image_url: imageUrl ?? getDirectImageUrl(params),
  };
}

function estimateVideoCost(params: Record<string, unknown>): CostEstimate {
  const provider = new FalProvider();
  const prompt = getPrompt(params) ?? "placeholder";

  return provider.estimateCost(
    getModel(params),
    buildVideoParams({
      params,
      prompt,
    }),
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForImageAssetUrl({
  generationId,
  timeoutMs,
  pollIntervalMs,
}: {
  generationId: string;
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
            type: "IMAGE",
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 1,
        },
      },
    });

    if (!generation) {
      throw new Error(`Generation de imagem não encontrada: ${generationId}.`);
    }

    if (generation.status === "DONE") {
      const assetUrl = generation.assets[0]?.url;

      if (!assetUrl) {
        throw new Error(
          `Generation de imagem ${generationId} concluiu sem Asset de imagem.`,
        );
      }

      return assetUrl;
    }

    if (generation.status === "FAILED") {
      throw new Error(
        `Generation de imagem ${generationId} falhou: ${
          generation.errorMessage ?? "erro sem detalhe registrado"
        }. Vídeo não enfileirado.`,
      );
    }

    if (Date.now() - startedAt >= timeoutMs) {
      throw new Error(
        `Tempo esgotado aguardando a imagem ${generationId} ficar pronta. Vídeo não enfileirado.`,
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

  return waitForImageAssetUrl({
    generationId,
    timeoutMs:
      getNumber(params.imageWaitTimeoutMs) ?? DEFAULT_IMAGE_WAIT_TIMEOUT_MS,
    pollIntervalMs:
      getNumber(params.imagePollIntervalMs) ?? DEFAULT_IMAGE_POLL_INTERVAL_MS,
  });
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
      return estimateVideoCost(ctx.params);
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
];

export const videoGenerationModelOptions = FAL_VIDEO_MODELS.map((model) => ({
  id: model.id,
  name: model.name,
  pricing: model.pricing,
  supportedDurations: model.supportedDurations,
  nativeAudio: model.nativeAudio,
  defaultInput: model.defaultInput,
}));
