import { describe, expect, it } from "vitest";

import { serializeFlowRun } from "@/lib/flows/serialization";

describe("serializeFlowRun billingMode", () => {
  it("preserves billingMode in historical total and node costs", () => {
    const now = new Date("2026-09-12T20:00:00.000Z");
    const run = {
      id: "run-1", workspaceId: "workspace-1", flowId: "flow-1", status: "done",
      graph: { nodes: [], edges: [] }, nodeOrder: [], targetNodeId: null,
      totalEstimatedCostUsd: { toString: () => "1" }, totalEstimatedCostBrl: { toString: () => "5" },
      totalActualCostUsd: { toString: () => "1" }, totalActualCostBrl: { toString: () => "5" },
      outputs: null, error: null, startedAt: now, completedAt: now,
      createdAt: now, updatedAt: now,
      nodes: [{
        id: "node-run-1", flowRunId: "run-1", nodeId: "image-1", type: "image-generation", sequence: 0,
        status: "done", dependencyNodeIds: [], params: { providerId: "fal" }, inputs: null,
        outputs: null, error: null, pgBossJobId: null,
        estimatedCostUsd: { toString: () => "1" }, estimatedCostBrl: { toString: () => "5" },
        actualCostUsd: { toString: () => "1" }, actualCostBrl: { toString: () => "5" },
        startedAt: now, completedAt: now, createdAt: now, updatedAt: now,
      }],
    };

    const serialized = serializeFlowRun(run as never);
    expect(serialized.totalEstimatedCost.billingMode).toBe("api");
    expect(serialized.totalActualCost.billingMode).toBe("api");
    expect(serialized.nodes[0].estimatedCost.billingMode).toBe("api");
    expect(serialized.nodes[0].actualCost.billingMode).toBe("api");
  });

  it("rejects an unknown provider instead of silently treating it as api", () => {
    const now = new Date("2026-09-12T20:00:00.000Z");
    const run = {
      id: "run-unknown", workspaceId: "workspace-1", flowId: "flow-1", status: "done",
      graph: { nodes: [], edges: [] }, nodeOrder: [], targetNodeId: null,
      totalEstimatedCostUsd: { toString: () => "1" }, totalEstimatedCostBrl: { toString: () => "5" },
      totalActualCostUsd: { toString: () => "0" }, totalActualCostBrl: { toString: () => "0" },
      outputs: null, error: null, startedAt: now, completedAt: now,
      createdAt: now, updatedAt: now,
      nodes: [{
        id: "node-unknown", flowRunId: "run-unknown", nodeId: "unknown-1", type: "unknown", sequence: 0,
        status: "done", dependencyNodeIds: [], params: { providerId: "unknown-provider" }, inputs: null,
        outputs: null, error: null, pgBossJobId: null,
        estimatedCostUsd: { toString: () => "1" }, estimatedCostBrl: { toString: () => "5" },
        actualCostUsd: { toString: () => "0" }, actualCostBrl: { toString: () => "0" },
        startedAt: now, completedAt: now, createdAt: now, updatedAt: now,
      }],
    };

    expect(() => serializeFlowRun(run as never)).toThrow(/provider/i);
  });
});
