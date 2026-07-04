import type { Prisma } from "@prisma/client";
import { PgBoss, type Job } from "pg-boss";

import { prisma } from "../db/prisma";
import { uploadRemoteAssetToSupabase } from "./asset-storage";
import { FalProvider } from "./fal";
import type { GenParams, GeneratedAsset } from "./model-provider";
import { getProviderErrorMessage } from "./provider-errors";

export const VIDEO_GENERATION_QUEUE = "video.generate";

const VIDEO_JOB_EXPIRE_SECONDS = 1800;

export type EnqueueVideoGenerationInput = {
  workspaceId: string;
  brandId?: string;
  model: string;
  prompt: string;
  params?: Omit<GenParams, "prompt">;
  flowRunId?: string;
  flowNodeId?: string;
};

export type VideoGenerationJobPayload = {
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
  await boss.createQueue(VIDEO_GENERATION_QUEUE, {
    retryLimit: 1,
    retryDelay: 10,
    retryBackoff: true,
    // Video pode levar de 30s a 5min; deixamos folga para fila, polling e upload.
    expireInSeconds: VIDEO_JOB_EXPIRE_SECONDS,
    retentionSeconds: 60 * 60 * 24 * 14,
  });
  return boss;
}

export async function enqueueVideoGenerationJob(input: EnqueueVideoGenerationInput) {
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
      VIDEO_GENERATION_QUEUE,
      {
        generationId: generation.id,
      },
      {
        singletonKey: generation.id,
        retryLimit: 1,
        retryDelay: 10,
        retryBackoff: true,
        expireInSeconds: VIDEO_JOB_EXPIRE_SECONDS,
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

async function persistGeneratedVideo({
  generation,
  video,
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
  video: GeneratedAsset;
  index: number;
}) {
  const uploaded = await uploadRemoteAssetToSupabase({
    sourceUrl: video.url,
    workspaceId: generation.workspaceId,
    generationId: generation.id,
    contentType: video.contentType,
    fileName: video.fileName,
  });

  return prisma.asset.create({
    data: {
      workspaceId: generation.workspaceId,
      brandId: generation.brandId,
      generationId: generation.id,
      type: "VIDEO",
      origin: "GENERATED",
      url: uploaded.url,
      storageBucket: uploaded.bucket,
      storagePath: uploaded.path,
      contentType: uploaded.contentType,
      width: video.width,
      height: video.height,
      sizeBytes: uploaded.sizeBytes,
      prompt: generation.prompt,
      provider: generation.provider,
      model: generation.model,
      metadata: toJson({
        sourceUrl: video.url,
        sourceFileName: video.fileName,
        sourceFileSize: video.fileSize,
        durationSeconds: video.durationSeconds,
        outputIndex: index,
      }),
    },
  });
}

export async function processVideoGeneration(generationId: string) {
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

    const result = await provider.waitForResult(handle, params, {
      pollIntervalMs: 2000,
    });
    const videos = result.videos ?? [];

    if (videos.length === 0) {
      throw new Error("fal.ai concluiu sem retornar video.");
    }

    await Promise.all(
      videos.map((video, index) =>
        persistGeneratedVideo({
          generation,
          video,
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

export async function startVideoGenerationWorker() {
  const boss = await createStartedBoss();

  await boss.work<VideoGenerationJobPayload>(
    VIDEO_GENERATION_QUEUE,
    {
      batchSize: 1,
      pollingIntervalSeconds: 2,
    },
    async (jobs: Job<VideoGenerationJobPayload>[]) => {
      await Promise.all(jobs.map((job) => processVideoGeneration(job.data.generationId)));
    },
  );

  return boss;
}
