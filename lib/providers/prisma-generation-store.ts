import { createHash } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { uploadRemoteAssetToSupabase } from "@/lib/providers/asset-storage";
import type { GeneratedAsset, GenerationResult, JobHandle } from "@/lib/providers/model-provider";
import {
  GenerationCoordinator,
  type GenerationStore,
  type GenerationStoreCreateInput,
  type GenerationStoreRecord,
} from "./generation-coordinator";
import { normalizeBillingMode, type ModelProvider } from "./model-provider";

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export function deterministicAssetKey(generationId: string, outputIndex: number) {
  return createHash("sha256")
    .update(`${generationId}:${outputIndex}`)
    .digest("hex");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function findOrCreateGeneration(
  store: PrismaGenerationStore,
  input: GenerationStoreCreateInput,
) {
  const matches = (existing: GenerationStoreRecord) =>
    existing.provider === input.provider &&
    existing.model === input.model &&
    existing.connectionId === input.connectionId &&
    canonicalJson(existing.params) === canonicalJson(input.params);

  const existing = await store.findByOperationKey(input.operationKey);
  if (existing) {
    if (!matches(existing)) throw new Error("operationKey já usado por outro snapshot de execução.");
    return existing;
  }

  try {
    return await store.create(input);
  } catch (error) {
    const raced = await store.findByOperationKey(input.operationKey);
    if (!raced || !matches(raced)) throw error;
    return raced;
  }
}

function toRecord(row: {
  id: string;
  operationKey: string;
  provider: string;
  model: string;
  params: unknown;
  status: string;
  submissionState: string;
  providerJobId: string | null;
  result: unknown;
  errorMessage: string | null;
  workspaceId?: string;
  brandId?: string | null;
  connectionId?: string | null;
  flowRunId?: string | null;
  flowNodeId?: string | null;
  billingMode: string;
  currency: string;
}): GenerationStoreRecord {
  return {
    id: row.id,
    operationKey: row.operationKey,
    provider: row.provider,
    model: row.model,
    params: row.params as GenerationStoreRecord["params"],
    status: row.status === "DONE" ? "done" : row.status === "FAILED" ? "failed" : row.status === "RUNNING" ? "running" : "queued",
    submissionState: row.submissionState as GenerationStoreRecord["submissionState"],
    providerJobId: row.providerJobId ?? undefined,
    result: row.result as GenerationResult | undefined,
    errorMessage: row.errorMessage ?? undefined,
    workspaceId: row.workspaceId,
    brandId: row.brandId ?? undefined,
    connectionId: row.connectionId ?? undefined,
    flowRunId: row.flowRunId ?? undefined,
    flowNodeId: row.flowNodeId ?? undefined,
    billingMode: normalizeBillingMode(row.billingMode, row.provider),
    currency: row.currency,
  };
}

export class PrismaGenerationStore implements GenerationStore {
  async findByOperationKey(operationKey: string) {
    const row = await prisma.generation.findUnique({ where: { operationKey } });
    return row ? toRecord(row) : null;
  }

  async create(input: GenerationStoreCreateInput) {
    if (!input.workspaceId) throw new Error("workspaceId server-side ausente para Generation.");
    const row = await prisma.generation.create({
      data: {
        workspaceId: input.workspaceId,
        brandId: input.brandId,
        provider: input.provider,
        connectionId: input.connectionId,
        flowRunId: input.flowRunId,
        flowNodeId: input.flowNodeId,
        model: input.model,
        prompt: typeof input.params.prompt === "string" ? input.params.prompt : "",
        params: toJson(input.params),
        operationKey: input.operationKey,
        submissionState: "not_submitted",
        billingMode: input.billingMode,
        currency: input.currency ?? "BRL",
        estimatedCostUsd: input.estimatedCostUsd ?? 0,
        estimatedCostBrl: input.estimatedCostBrl ?? 0,
      },
    });
    return toRecord(row);
  }

  async claim(id: string) {
    const result = await prisma.generation.updateMany({
      where: { id, status: "QUEUED", submissionState: "not_submitted" },
      data: { status: "RUNNING", submissionState: "submitting", startedAt: new Date(), errorMessage: null },
    });
    return result.count === 1;
  }

  async markSubmitted(id: string, handle: JobHandle) {
    await prisma.generation.updateMany({
      where: { id, submissionState: "submitting" },
      data: { providerJobId: handle.id, submissionState: "submitted" },
    });
  }

  async markUnknown(id: string, errorMessage: string) {
    await prisma.generation.update({
      where: { id },
      data: { submissionState: "submission_unknown", status: "FAILED", errorMessage, completedAt: new Date() },
    });
  }

  async markDone(id: string, result: GenerationResult) {
    await prisma.generation.update({
      where: { id },
      data: {
        status: "DONE",
        submissionState: "completed",
        actualCostUsd: result.cost.usd,
        actualCostBrl: result.cost.brl,
        result: toJson(result.raw),
        completedAt: new Date(),
      },
    });
  }

  async markFailed(id: string, errorMessage: string) {
    await prisma.generation.update({
      where: { id },
      data: { status: "FAILED", submissionState: "failed", errorMessage, completedAt: new Date() },
    });
  }

  async get(id: string) {
    const row = await prisma.generation.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async persistAsset(id: string, index: number, asset: unknown) {
    const generation = await prisma.generation.findUnique({ where: { id } });
    if (!generation) throw new Error(`Generation não encontrada: ${id}`);
    const image = asset as GeneratedAsset;
    const existing = await prisma.asset.findUnique({ where: { generationId_outputIndex: { generationId: id, outputIndex: index } } });
    if (existing) return;
    const uploaded = await uploadRemoteAssetToSupabase({
      sourceUrl: image.url,
      workspaceId: generation.workspaceId,
      generationId: id,
      contentType: image.contentType,
      fileName: image.fileName,
    });
    await prisma.asset.upsert({
      where: { generationId_outputIndex: { generationId: id, outputIndex: index } },
      update: {},
      create: {
        assetKey: deterministicAssetKey(id, index),
        outputIndex: index,
        workspaceId: generation.workspaceId,
        brandId: generation.brandId,
        generationId: id,
        type: image.durationSeconds === undefined ? "IMAGE" : "VIDEO",
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
        metadata: toJson({ sourceUrl: image.url, sourceFileName: image.fileName, outputIndex: index }),
      },
    });
  }
}

export function createPrismaGenerationCoordinator(options: {
  provider: ModelProvider;
}) {
  return new GenerationCoordinator({
    store: new PrismaGenerationStore(),
    provider: options.provider,
  });
}
