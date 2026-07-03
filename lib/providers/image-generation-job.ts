import type { Prisma } from "@prisma/client";
import { PgBoss, type Job } from "pg-boss";

import { prisma } from "../db/prisma";
import { uploadRemoteAssetToSupabase } from "./asset-storage";
import { FalProvider } from "./fal";
import type { GenParams, GeneratedAsset } from "./model-provider";

export const IMAGE_GENERATION_QUEUE = "image.generate";

const DEFAULT_WORKSPACE_SLUG =
  process.env.DEFAULT_WORKSPACE_SLUG ?? "felipe-labia";

export type EnqueueImageGenerationInput = {
  workspaceId: string;
  brandId?: string;
  model: string;
  prompt: string;
  params?: Omit<GenParams, "prompt">;
  flowRunId?: string;
  flowNodeId?: string;
};

export type ImageGenerationJobPayload = {
  generationId: string;
};

function getPgBossConnectionString() {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL ou DIRECT_URL precisa estar configurado para pg-boss.");
  }

  return connectionString;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getProviderErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : String(error);

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const record = error as Record<string, unknown>;
  const bodyMessage = getErrorBodyMessage(record.body);
  const parts = [bodyMessage ?? fallback];

  if (typeof record.status === "number") {
    parts.push(`HTTP ${record.status}`);
  }

  if (typeof record.requestId === "string" && record.requestId.length > 0) {
    parts.push(`request ${record.requestId}`);
  }

  return parts.join(" - ");
}

function getErrorBodyMessage(body: unknown): string | undefined {
  if (typeof body === "string") {
    return body;
  }

  if (!body || typeof body !== "object") {
    return undefined;
  }

  const record = body as Record<string, unknown>;

  for (const key of ["message", "detail", "error"]) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    if (Array.isArray(value)) {
      const firstMessage = value
        .map((item) => getErrorBodyMessage(item))
        .find((message) => message && message.trim().length > 0);

      if (firstMessage) {
        return firstMessage;
      }
    }
  }

  if (typeof record.msg === "string" && record.msg.trim().length > 0) {
    return record.msg;
  }

  return undefined;
}

function buildGenerationParams({
  prompt,
  params,
}: {
  prompt: string;
  params?: Omit<GenParams, "prompt">;
}): GenParams {
  return {
    ...(params ?? {}),
    prompt,
  };
}

function createBoss() {
  return new PgBoss({
    connectionString: getPgBossConnectionString(),
  });
}

async function createStartedBoss() {
  const boss = createBoss();
  boss.on("error", (error) => {
    console.error(error);
  });
  await boss.start();
  await boss.createQueue(IMAGE_GENERATION_QUEUE, {
    retryLimit: 1,
    retryDelay: 5,
    retryBackoff: true,
    expireInSeconds: 900,
    retentionSeconds: 60 * 60 * 24 * 14,
  });
  return boss;
}

export async function ensureDefaultImageWorkspace() {
  return prisma.workspace.upsert({
    where: {
      slug: DEFAULT_WORKSPACE_SLUG,
    },
    update: {},
    create: {
      name: "Felipe Zilli",
      slug: DEFAULT_WORKSPACE_SLUG,
    },
  });
}

export async function enqueueImageGenerationJob(input: EnqueueImageGenerationInput) {
  const provider = new FalProvider();
  const params = buildGenerationParams(input);
  const estimatedCost = provider.estimateCost(input.model, params);
  const generation = await prisma.generation.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      provider: provider.id,
      model: input.model,
      prompt: input.prompt,
      params: toJson(params),
      estimatedCostUsd: estimatedCost.usd,
      estimatedCostBrl: estimatedCost.brl,
      flowRunId: input.flowRunId,
      flowNodeId: input.flowNodeId,
    },
  });
  const boss = await createStartedBoss();

  try {
    const queueJobId = await boss.send(
      IMAGE_GENERATION_QUEUE,
      {
        generationId: generation.id,
      },
      {
        singletonKey: generation.id,
        retryLimit: 1,
        retryDelay: 5,
        retryBackoff: true,
        expireInSeconds: 900,
      },
    );

    await prisma.generation.update({
      where: {
        id: generation.id,
      },
      data: {
        queueJobId,
      },
    });

    return {
      generationId: generation.id,
      queueJobId,
      estimatedCost,
    };
  } finally {
    await boss.stop();
  }
}

async function persistGeneratedImage({
  generation,
  image,
  index,
}: {
  generation: {
    id: string;
    workspaceId: string;
    brandId: string | null;
    prompt: string;
    provider: string;
    model: string;
  };
  image: GeneratedAsset;
  index: number;
}) {
  const uploaded = await uploadRemoteAssetToSupabase({
    sourceUrl: image.url,
    workspaceId: generation.workspaceId,
    generationId: generation.id,
    contentType: image.contentType,
    fileName: image.fileName,
  });

  return prisma.asset.create({
    data: {
      workspaceId: generation.workspaceId,
      brandId: generation.brandId,
      generationId: generation.id,
      type: "IMAGE",
      origin: "GENERATED",
      url: uploaded.url,
      storageBucket: uploaded.bucket,
      storagePath: uploaded.path,
      contentType: uploaded.contentType,
      width: image.width,
      height: image.height,
      sizeBytes: uploaded.sizeBytes,
      prompt: generation.prompt,
      provider: generation.provider,
      model: generation.model,
      metadata: toJson({
        sourceUrl: image.url,
        sourceFileName: image.fileName,
        sourceFileSize: image.fileSize,
        outputIndex: index,
      }),
    },
  });
}

export async function processImageGeneration(generationId: string) {
  const generation = await prisma.generation.findUnique({
    where: {
      id: generationId,
    },
  });

  if (!generation) {
    throw new Error(`Generation nao encontrada: ${generationId}`);
  }

  if (generation.status === "DONE") {
    return generation;
  }

  const provider = new FalProvider();
  const params = {
    ...(generation.params as Record<string, unknown>),
    prompt: generation.prompt,
  } as GenParams;

  await prisma.generation.update({
    where: {
      id: generation.id,
    },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      errorMessage: null,
    },
  });

  try {
    const handle = await provider.generate(generation.model, params);

    await prisma.generation.update({
      where: {
        id: generation.id,
      },
      data: {
        providerJobId: handle.id,
      },
    });

    const result = await provider.waitForResult(handle, params);

    await Promise.all(
      result.images.map((image, index) =>
        persistGeneratedImage({
          generation,
          image,
          index,
        }),
      ),
    );

    return prisma.generation.update({
      where: {
        id: generation.id,
      },
      data: {
        status: "DONE",
        actualCostUsd: result.cost.usd,
        actualCostBrl: result.cost.brl,
        result: toJson(result.raw),
        completedAt: new Date(),
      },
    });
  } catch (error) {
    const errorMessage = getProviderErrorMessage(error);

    await prisma.generation.update({
      where: {
        id: generation.id,
      },
      data: {
        status: "FAILED",
        errorMessage,
        completedAt: new Date(),
      },
    });

    throw new Error(errorMessage, {
      cause: error,
    });
  }
}

export async function runImageGenerationInline(input: EnqueueImageGenerationInput) {
  const provider = new FalProvider();
  const params = buildGenerationParams(input);
  const estimatedCost = provider.estimateCost(input.model, params);
  const generation = await prisma.generation.create({
    data: {
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      provider: provider.id,
      model: input.model,
      prompt: input.prompt,
      params: toJson(params),
      estimatedCostUsd: estimatedCost.usd,
      estimatedCostBrl: estimatedCost.brl,
      flowRunId: input.flowRunId,
      flowNodeId: input.flowNodeId,
    },
  });

  await processImageGeneration(generation.id);

  return prisma.generation.findUniqueOrThrow({
    where: {
      id: generation.id,
    },
    include: {
      assets: true,
    },
  });
}

export async function startImageGenerationWorker() {
  const boss = await createStartedBoss();

  await boss.work<ImageGenerationJobPayload>(
    IMAGE_GENERATION_QUEUE,
    {
      batchSize: 1,
      pollingIntervalSeconds: 2,
    },
    async (jobs: Job<ImageGenerationJobPayload>[]) => {
      await Promise.all(jobs.map((job) => processImageGeneration(job.data.generationId)));
    },
  );

  return boss;
}
