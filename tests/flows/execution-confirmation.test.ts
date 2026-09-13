import { describe, expect, it } from "vitest";

import {
  ExecutionConfirmationService,
  type ExecutionConfirmationStore,
} from "@/lib/flows/execution-confirmation";

const snapshot = {
  ownerId: "owner-1",
  workspaceId: "workspace-1",
  flowId: "flow-1",
  targetNodeId: null,
  graphHash: "graph-hash",
  selections: [{ nodeId: "image-1", providerId: "fal", connectionId: null, modelId: "fal-ai/flux/dev", params: { prompt: "x" }, billingMode: "api" as const }],
  estimatedCost: { usd: 0.1, brl: 0.5 },
  currency: "BRL" as const,
  billingMode: "api" as const,
};

function memoryStore(): ExecutionConfirmationStore {
  const rows = new Map<string, { snapshotHash: string; expiresAt: number; consumedAt: number | null }>();
  return {
    async issue(input) {
      rows.set(input.jti, { snapshotHash: input.snapshotHash, expiresAt: input.expiresAt, consumedAt: null });
    },
    async consume(input) {
      const row = rows.get(input.jti);
      if (!row || row.consumedAt !== null || row.expiresAt <= input.now || row.snapshotHash !== input.snapshotHash) return false;
      row.consumedAt = input.now;
      return true;
    },
  };
}

describe("execution confirmation", () => {
  it("é assinada, vinculada ao snapshot completo e de uso único", async () => {
    const service = new ExecutionConfirmationService({ store: memoryStore(), secret: "secret-for-tests" });
    const issued = await service.issue(snapshot, 1_000);

    expect(await service.consume(issued.token, snapshot, 1_001)).toBe(true);
    expect(await service.consume(issued.token, snapshot, 1_002)).toBe(false);
    expect(await service.consume(issued.token, { ...snapshot, selections: [{ ...snapshot.selections[0], modelId: "changed" }] }, 1_003)).toBe(false);
  });
});
