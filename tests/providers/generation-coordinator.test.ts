import { describe, expect, it } from "vitest";

import {
  GenerationCoordinator,
  type GenerationStoreRecord,
  type GenerationStore,
} from "@/lib/providers/generation-coordinator";
import type { GenerationResult, JobHandle, ModelProvider } from "@/lib/providers/model-provider";

function result(): GenerationResult {
  return {
    provider: "fake",
    model: "fake-image",
    requestId: "request-1",
    images: [{ url: "https://assets.test/image.png", contentType: "image/png" }],
    cost: { usd: 1, brl: 5, source: "fake", billingMode: "api" },
    raw: { image: "ok" },
  };
}

function provider(overrides: Partial<ModelProvider> = {}): ModelProvider {
  return {
    id: "fake",
    listModels: () => [],
    estimateCost: () => ({ usd: 1, brl: 5, source: "fake", billingMode: "api" }),
    generate: async (): Promise<JobHandle> => ({ id: "remote-1", provider: "fake", model: "fake-image" }),
    waitForResult: async () => result(),
    ...overrides,
  };
}

function store(): GenerationStore {
  const records = new Map<string, GenerationStoreRecord>();
  const assets: Array<{ generationId: string; index: number; asset: unknown }> = [];
  return {
    async findByOperationKey(operationKey) {
      return [...records.values()].find((record) => record.operationKey === operationKey) ?? null;
    },
    async create(input) {
      const record: GenerationStoreRecord = { id: `generation-${records.size + 1}`, ...input, status: "queued", submissionState: "not_submitted" };
      records.set(record.id, record);
      return record;
    },
    async claim(id) {
      const record = records.get(id);
      if (!record || record.submissionState !== "not_submitted") return false;
      record.submissionState = "submitting";
      record.status = "running";
      return true;
    },
    async markSubmitted(id, handle) {
      const record = records.get(id);
      if (!record) throw new Error("generation missing");
      record.providerJobId = handle.id;
      record.submissionState = "submitted";
    },
    async markUnknown(id, error) {
      const record = records.get(id);
      if (!record) throw new Error("generation missing");
      record.submissionState = "submission_unknown";
      record.errorMessage = error;
    },
    async markDone(id, generationResult) {
      const record = records.get(id);
      if (!record) throw new Error("generation missing");
      record.status = "done";
      record.submissionState = "completed";
      record.result = generationResult;
    },
    async markFailed(id, error) {
      const record = records.get(id);
      if (!record) throw new Error("generation missing");
      record.status = "failed";
      record.submissionState = "failed";
      record.errorMessage = error;
    },
    async get(id) { return records.get(id) ?? null; },
    async persistAsset(id, assetIndex, asset) {
      const existing = assets.find((entry) => entry.generationId === id && entry.index === assetIndex);
      if (!existing) assets.push({ generationId: id, index: assetIndex, asset });
    },
  };
}

describe("GenerationCoordinator", () => {
  it("serializa duas entregas da mesma operação e envia ao provider uma única vez", async () => {
    const generationStore = store();
    let submits = 0;
    const fake = provider({ generate: async () => { submits += 1; return { id: "remote-1", provider: "fake", model: "fake-image" }; } });
    const coordinator = new GenerationCoordinator({ store: generationStore, provider: fake });

    const [first, second] = await Promise.all([
      coordinator.run({ operationKey: "run-1:node-1", provider: "fake", model: "fake-image", params: { prompt: "x" }, billingMode: "api" }),
      coordinator.run({ operationKey: "run-1:node-1", provider: "fake", model: "fake-image", params: { prompt: "x" }, billingMode: "api" }),
    ]);

    expect(submits).toBe(1);
    expect(first.generationId).toBe(second.generationId);
    expect(first.result.images).toHaveLength(1);
  });

  it("marca submit ambíguo e nunca reenvia automaticamente", async () => {
    const generationStore = store();
    const coordinator = new GenerationCoordinator({
      store: generationStore,
      provider: provider({ generate: async () => { throw new Error("timeout depois do envio"); } }),
    });

    await expect(coordinator.run({ operationKey: "run-2:node-1", provider: "fake", model: "fake-image", params: { prompt: "x" }, billingMode: "api" })).rejects.toThrow(
      /ambíguo/i,
    );
    await expect(coordinator.run({ operationKey: "run-2:node-1", provider: "fake", model: "fake-image", params: { prompt: "x" }, billingMode: "api" })).rejects.toThrow(
      /ambíguo/i,
    );
  });
});
