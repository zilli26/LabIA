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

export const IMAGE_GENERATION_QUEUE = "image.generate";

const DEFAULT_WORKSPACE_SLUG =
  process.env.DEFAULT_WORKSPACE_SLUG ?? "felipe-labia";

export type EnqueueImageGenerationInput = {
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
  const { generation, estimatedCost } = await createImageGeneration(input);
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

export async function processImageGeneration(generationId: string) {
  const scope = await getOwnedExecutionScope();
  const generation = await prisma.generation.findFirst({
    where: { id: generationId, workspaceId: scope.workspaceId },
  });

  if (!generation) {
    throw new Error(`Generation nao encontrada: ${generationId}`);
  }

  if (generation.status === "DONE") {
    return generation;
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
      params: { ...(generation.params as Record<string, unknown>), prompt: generation.prompt } as GenParams,
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

export async function runImageGenerationInline(input: EnqueueImageGenerationInput) {
  const { generation } = await createImageGeneration(input);

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

async function createImageGeneration(input: EnqueueImageGenerationInput) {
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
  const provider = await resolveServerModelProvider({ ownerId: scope.ownerId, workspaceId: scope.workspaceId, providerId, connectionId: input.connectionId });
  const params = buildGenerationParams(input);
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
