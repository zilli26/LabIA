import { randomUUID } from "node:crypto";
import { PgBoss, type Job } from "pg-boss";

import { prisma } from "../db/prisma";
import type { GenParams } from "./model-provider";
import { normalizeBillingMode } from "./model-provider";
import { getProviderErrorMessage } from "./provider-errors";
import { resolveServerModelProvider } from "./provider-registry";
import { getOwnedExecutionScope, assertOwnedExecutionReferences } from "@/lib/flows/ownership";
import { GenerationCoordinator } from "./generation-coordinator";
import { findOrCreateGeneration, PrismaGenerationStore } from "./prisma-generation-store";
import { OPENAI_IMAGE_CONTRACT_UNAVAILABLE } from "./openai-codex-image";

export const VIDEO_GENERATION_QUEUE = "video.generate";

const VIDEO_JOB_EXPIRE_SECONDS = 1800;

export type EnqueueVideoGenerationInput = {
  workspaceId: string;
  brandId?: string;
  providerId?: string;
  connectionId?: string;
  operationKey?: string;
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

export function buildVideoGenerationParams({
  prompt,
  params,
}: {
  prompt: string;
  params?: Omit<GenParams, "prompt">;
}): GenParams {
  return {
    ...(params ?? {}),
    kind: "video",
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
  const { generation, estimatedCost } = await createVideoGeneration(input);
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

export async function processVideoGeneration(generationId: string) {
  const scope = await getOwnedExecutionScope();
  const generation = await prisma.generation.findFirst({ where: { id: generationId, workspaceId: scope.workspaceId } });

  if (!generation) {
    throw new Error(`Generation nao encontrada: ${generationId}`);
  }

  if (generation.status === "DONE") {
    return generation;
  }

  if (generation.provider === "openai") {
    throw new Error(`${OPENAI_IMAGE_CONTRACT_UNAVAILABLE}: OpenAI executor só oferece imagem`);
  }

  await assertOwnedExecutionReferences({
    ownerId: scope.ownerId,
    workspaceId: scope.workspaceId,
    brandId: generation.brandId ?? undefined,
    flowRunId: generation.flowRunId ?? undefined,
    flowNodeId: generation.flowNodeId ?? undefined,
    connectionId: generation.connectionId ?? undefined,
    providerId: generation.provider,
    repository: {
      flow: async (id) => prisma.flow.findFirst({ where: { id, workspaceId: scope.workspaceId }, select: { id: true, workspaceId: true } }),
      brand: async (id) => prisma.brand.findFirst({ where: { id, workspaceId: scope.workspaceId }, select: { id: true, workspaceId: true } }),
      flowRun: async (id) => prisma.flowRun.findFirst({ where: { id, workspaceId: scope.workspaceId }, select: { id: true, workspaceId: true, flowId: true } }),
      flowRunNode: async (flowRunId, nodeId) => prisma.flowRunNode.findFirst({ where: { flowRunId, nodeId }, select: { nodeId: true } }),
      connection: async (id) => prisma.providerConnection.findFirst({ where: { id, workspaceId: scope.workspaceId, ownerId: scope.ownerId }, select: { id: true, workspaceId: true, ownerId: true, provider: true } }),
    },
  });

  const provider = await resolveServerModelProvider({
    ownerId: scope.ownerId,
    workspaceId: scope.workspaceId,
    providerId: generation.provider,
    connectionId: generation.connectionId ?? undefined,
  });
  const store = new PrismaGenerationStore();
  const coordinator = new GenerationCoordinator({ store, provider });
  try {
    await coordinator.run({
      operationKey: generation.operationKey,
      provider: generation.provider,
      model: generation.model,
      params: { ...(generation.params as Record<string, unknown>), kind: "video", prompt: generation.prompt } as GenParams,
      workspaceId: scope.workspaceId,
      brandId: generation.brandId ?? undefined,
      connectionId: generation.connectionId ?? undefined,
      billingMode: generation.billingMode as "api" | "subscription" | "local",
      currency: generation.currency,
    });
    return prisma.generation.findUniqueOrThrow({ where: { id: generation.id } });
  } catch (error) {
    const errorMessage = getProviderErrorMessage(error);
    const current = await store.get(generation.id);
    if (current?.submissionState !== "submission_unknown") await store.markFailed(generation.id, errorMessage);

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

async function createVideoGeneration(input: EnqueueVideoGenerationInput) {
  const scope = await getOwnedExecutionScope();
  if (input.workspaceId !== scope.workspaceId) throw new Error("workspaceId não pertence ao owner autorizado.");
  await assertOwnedExecutionReferences({
    ownerId: scope.ownerId,
    workspaceId: scope.workspaceId,
    brandId: input.brandId,
    flowRunId: input.flowRunId,
    flowNodeId: input.flowNodeId,
    connectionId: input.connectionId,
    providerId: input.providerId ?? "fal",
    repository: {
      flow: async (id) => prisma.flow.findFirst({ where: { id, workspaceId: scope.workspaceId }, select: { id: true, workspaceId: true } }),
      brand: async (id) => prisma.brand.findFirst({ where: { id, workspaceId: scope.workspaceId }, select: { id: true, workspaceId: true } }),
      flowRun: async (id) => prisma.flowRun.findFirst({ where: { id, workspaceId: scope.workspaceId }, select: { id: true, workspaceId: true, flowId: true } }),
      flowRunNode: async (flowRunId, nodeId) => prisma.flowRunNode.findFirst({ where: { flowRunId, nodeId }, select: { nodeId: true } }),
      connection: async (id) => prisma.providerConnection.findFirst({ where: { id, workspaceId: scope.workspaceId, ownerId: scope.ownerId }, select: { id: true, workspaceId: true, ownerId: true, provider: true } }),
    },
  });
  const providerId = input.providerId ?? "fal";
  if (providerId === "openai") {
    throw new Error(`${OPENAI_IMAGE_CONTRACT_UNAVAILABLE}: OpenAI executor só oferece imagem`);
  }
  const provider = await resolveServerModelProvider({ ownerId: scope.ownerId, workspaceId: scope.workspaceId, providerId, connectionId: input.connectionId });
  const params = buildVideoGenerationParams(input);
  const estimatedCost = provider.estimateCost(input.model, params);
  const operationKey = input.flowRunId && input.flowNodeId
    ? `${scope.workspaceId}:${input.flowRunId}:${input.flowNodeId}`
    : `standalone:${randomUUID()}`;
  const store = new PrismaGenerationStore();
  const generation = await findOrCreateGeneration(store, {
    workspaceId: scope.workspaceId,
    brandId: input.brandId,
    connectionId: input.connectionId,
    provider: provider.id,
    model: input.model,
    params: { ...params, operationKey },
    operationKey,
    flowRunId: input.flowRunId,
    flowNodeId: input.flowNodeId,
    billingMode: normalizeBillingMode(estimatedCost.billingMode, provider.id),
    currency: "BRL",
    estimatedCostUsd: estimatedCost.usd,
    estimatedCostBrl: estimatedCost.brl,
  });
  return { generation, estimatedCost };
}
