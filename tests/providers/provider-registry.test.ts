import { describe, expect, it } from "vitest";

import {
  ModelProviderRegistry,
  resolveModelProvider,
} from "@/lib/providers/provider-registry";
import type {
  CostEstimate,
  GenParams,
  JobHandle,
  ModelInfo,
  ModelKind,
  ModelProvider,
} from "@/lib/providers/model-provider";

function fakeProvider(id: string): ModelProvider {
  const cost: CostEstimate = { usd: 1, brl: 5, source: "fake", billingMode: "api" };
  return {
    id,
    listModels: (_kind: ModelKind): ModelInfo[] => { void _kind; return []; },
    estimateCost: (_model: string, _params: GenParams) => { void _model; void _params; return cost; },
    generate: async (model: string, _params: GenParams): Promise<JobHandle> => {
      void _params;
      return { id: `${id}-job`, provider: id, model };
    },
    waitForResult: async () => ({
      provider: id,
      model: "fake-model",
      requestId: `${id}-request`,
      images: [],
      cost,
      raw: {},
    }),
  };
}

describe("ModelProviderRegistry", () => {
  it("resolve Provider por providerId e conexão, sem default global", () => {
    const registry = new ModelProviderRegistry();
    const provider = fakeProvider("fake");
    registry.register({ providerId: "fake", connectionId: "connection-1", provider });

    expect(resolveModelProvider({ registry, providerId: "fake", connectionId: "connection-1" })).toBe(provider);
    expect(() => resolveModelProvider({ registry, providerId: "fake", connectionId: "connection-2" })).toThrow(
      /conexão/i,
    );
    expect(() => resolveModelProvider({ registry, providerId: "unknown", connectionId: "connection-1" })).toThrow(
      /provider/i,
    );
  });

  it("mantém compatibilidade explícita para fal sem transformá-la em default de novos providers", () => {
    const registry = new ModelProviderRegistry();
    const legacy = fakeProvider("fal");
    registry.registerLegacy("fal", legacy);

    expect(resolveModelProvider({ registry, legacyProvider: "fal" })).toBe(legacy);
    expect(() => resolveModelProvider({ registry, providerId: "fal", connectionId: "missing" })).toThrow(/conexão/i);
  });
});
