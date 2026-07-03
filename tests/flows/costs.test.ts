import { describe, expect, it } from "vitest";

import type { FlowGraph, LabFlowNode } from "@/lib/flows/graph";
import { estimateFlowCost, sumCosts } from "@/lib/flows/costs";
import { getNodeDefinition, nodeDefinitionRegistry } from "@/lib/flows/registry";
import type { CostEstimate } from "@/lib/providers/model-provider";

function node(id: string, kind: LabFlowNode["data"]["kind"], params?: Record<string, unknown>): LabFlowNode {
  return {
    id,
    type: "labNode",
    position: { x: 0, y: 0 },
    data: {
      kind,
      title: id,
      description: "",
      status: "idle",
      params,
    },
  };
}

function edge(id: string, source: string, target: string) {
  return { id, source, target, type: "smoothstep" };
}

function cost(usd: number, brl: number, extra: Partial<CostEstimate> = {}): CostEstimate {
  return { usd, brl, ...extra };
}

describe("sumCosts", () => {
  it("returns zeroCost for an empty list", () => {
    const result = sumCosts([]);

    expect(result.usd).toBe(0);
    expect(result.brl).toBe(0);
    expect(result.lineItems).toEqual([]);
  });

  it("sums usd and brl across multiple cost entries", () => {
    const result = sumCosts([cost(1.5, 7.5), cost(2.25, 11.25), cost(0.25, 1.25)]);

    expect(result.usd).toBeCloseTo(4, 5);
    expect(result.brl).toBeCloseTo(20, 5);
  });

  it("concatenates lineItems from every cost entry, preserving order", () => {
    const lineA = { label: "A", quantity: 1, unit: "image" as const, unitPriceUsd: 1, usd: 1 };
    const lineB = { label: "B", quantity: 2, unit: "second" as const, unitPriceUsd: 0.5, usd: 1 };

    const result = sumCosts([
      cost(1, 5, { lineItems: [lineA] }),
      cost(1, 5, { lineItems: [lineB] }),
    ]);

    expect(result.lineItems).toEqual([lineA, lineB]);
  });

  it("tags the combined result with source 'flow'", () => {
    const result = sumCosts([cost(1, 5, { source: "fal" }), cost(2, 10, { source: "openai" })]);

    expect(result.source).toBe("flow");
  });

  // Regressão (corrigida 2026-07-03): sumCosts computava usdBrlRate como
  // `cost.usdBrlRate || total.usdBrlRate` inside a left-fold reduce, i.e. it keeps
  // overwriting the running rate with the LAST node's non-zero rate instead of an
  // aggregate consistent with the summed totals. When different nodes carry different
  // usdBrlRate values (plausible if costs are estimated at different times/providers),
  // `total.usdBrlRate` silently reflects only the last node in the list and disagrees
  // with `total.brl / total.usd`. This test asserts the consistent aggregate rate and
  // is EXPECTED TO FAIL until the implementation is fixed (review decision).
  it("returns a usdBrlRate consistent with the summed usd/brl totals", () => {
    const result = sumCosts([
      cost(10, 50, { usdBrlRate: 5.0 }),
      cost(10, 60, { usdBrlRate: 6.0 }),
    ]);

    // Combined rate implied by totals: (50 + 60) / (10 + 10) = 5.5
    expect(result.usdBrlRate).toBeCloseTo(result.brl / result.usd, 5);
  });
});

describe("estimateFlowCost", () => {
  it("returns zero total cost for a graph made only of free utility nodes", async () => {
    const graph: FlowGraph = {
      nodes: [
        node("a", "text-input"),
        node("b", "note"),
        node("c", "asset-output"),
      ],
      edges: [edge("a-b", "a", "b"), edge("b-c", "b", "c")],
    };

    const result = await estimateFlowCost(graph);

    expect(result.total.usd).toBe(0);
    expect(result.total.brl).toBe(0);
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes.map((n) => n.nodeId)).toEqual(["a", "b", "c"]);
  });

  it("restricts estimate to ancestors of targetNodeId", async () => {
    const graph: FlowGraph = {
      nodes: [
        node("a", "text-input"),
        node("b", "note"),
        node("unrelated", "note"),
      ],
      edges: [edge("a-b", "a", "b")],
    };

    const result = await estimateFlowCost(graph, { targetNodeId: "b" });

    expect(result.nodes.map((n) => n.nodeId).sort()).toEqual(["a", "b"]);
  });

  it("reuses a precomputed plan when provided instead of rebuilding it", async () => {
    const graph: FlowGraph = {
      nodes: [node("a", "text-input")],
      edges: [],
    };

    const { buildExecutionPlan } = await import("@/lib/flows/topology");
    const plan = buildExecutionPlan(graph);

    const result = await estimateFlowCost(graph, { plan });

    expect(result.nodes.map((n) => n.nodeId)).toEqual(["a"]);
  });

  it("throws if the graph is invalid (e.g. contains a cycle)", async () => {
    const graph: FlowGraph = {
      nodes: [node("a", "note"), node("b", "note")],
      edges: [edge("a-b", "a", "b"), edge("b-a", "b", "a")],
    };

    await expect(estimateFlowCost(graph)).rejects.toThrow(/Grafo inválido para execução/);
  });

  it("sums per-node estimated costs into the flow total", async () => {
    // note nodes are free; simulate a paid node by monkeypatching is not available since
    // registry only has free utility nodes. Instead, verify total equals sumCosts of node costs
    // directly, which also guards against total/nodes drifting apart.
    const graph: FlowGraph = {
      nodes: [node("a", "text-input"), node("b", "note")],
      edges: [edge("a-b", "a", "b")],
    };

    const result = await estimateFlowCost(graph);
    const { sumCosts: sum } = await import("@/lib/flows/costs");
    const expectedTotal = sum(result.nodes.map((n) => n.estimatedCost));

    expect(result.total).toEqual(expectedTotal);
  });

  // Regressão (corrigida 2026-07-03): `definitionsByType` era um snapshot de Map em
  // module load time (`listNodeDefinitions()` evaluated once, top-level). Any
  // NodeDefinition registered in nodeDefinitionRegistry AFTER costs.ts is first
  // imported is invisible to estimateFlowCost, which throws "NodeDefinition não
  // registrado" mesmo com a definição no registry vivo. estimateFlowCost agora
  // passes validateFlowGraph. Late registration is the documented extension path
  // ("novas capacidades nascem como NÓS do canvas"), so cost estimation silently
  // breaks for every dynamically registered node. estimateFlowCost should consult
  // consulta o registry vivo (getNodeDefinition).
  it("estimates cost for a node type registered after costs.ts was imported", async () => {
    const PAID_TYPE = "test-paid-node";

    nodeDefinitionRegistry.register({
      type: PAID_TYPE,
      label: "Paid node",
      description: "test node with non-zero cost, registered late",
      inputs: [],
      outputs: [{ id: "out", label: "out", type: "any" }],
      estimateCost() {
        return { usd: 2, brl: 10, usdBrlRate: 5, lineItems: [], source: "test" };
      },
      async execute() {
        return { outputs: {} };
      },
      ui: { componentKey: "labNode", kind: PAID_TYPE },
    });

    // Sanity: the live registry sees the definition...
    expect(getNodeDefinition(PAID_TYPE)).toBeDefined();

    const graph: FlowGraph = {
      nodes: [node("p", PAID_TYPE as LabFlowNode["data"]["kind"])],
      edges: [],
    };

    // ...but estimateFlowCost uses the stale module-level snapshot and throws.
    const result = await estimateFlowCost(graph);

    expect(result.total.usd).toBeCloseTo(2, 5);
    expect(result.total.brl).toBeCloseTo(10, 5);
  });
});
