import { describe, expect, it } from "vitest";

import type { FlowGraph, LabFlowNode } from "@/lib/flows/graph";
import { buildExecutionPlan } from "@/lib/flows/topology";

function node(id: string, kind: LabFlowNode["data"]["kind"] = "note"): LabFlowNode {
  return {
    id,
    type: "labNode",
    position: { x: 0, y: 0 },
    data: {
      kind,
      title: id,
      description: "",
      status: "idle",
    },
  };
}

function edge(id: string, source: string, target: string) {
  return { id, source, target, type: "smoothstep" };
}

describe("buildExecutionPlan — topological ordering", () => {
  it("orders a linear chain input -> note -> output", () => {
    const graph: FlowGraph = {
      nodes: [
        node("a", "text-input"),
        node("b", "note"),
        node("c", "asset-output"),
      ],
      edges: [edge("a-b", "a", "b"), edge("b-c", "b", "c")],
    };

    const plan = buildExecutionPlan(graph);

    expect(plan.nodeOrder).toEqual(["a", "b", "c"]);
    expect(plan.rootNodeIds).toEqual(["a"]);
  });

  it("keeps original node order as tie-break for independent branches", () => {
    // b and c both depend only on a, neither depends on the other.
    // Insertion order in graph.nodes is a, c, b — plan should respect that
    // order among nodes that become ready at the same time.
    const graph: FlowGraph = {
      nodes: [node("a", "text-input"), node("c", "note"), node("b", "note")],
      edges: [edge("a-c", "a", "c"), edge("a-b", "a", "b")],
    };

    const plan = buildExecutionPlan(graph);

    expect(plan.nodeOrder[0]).toBe("a");
    expect(plan.nodeOrder.slice(1)).toEqual(["c", "b"]);
  });

  it("computes dependencyNodeIds, incomingEdges and outgoingEdges per node", () => {
    const graph: FlowGraph = {
      nodes: [node("a", "text-input"), node("b", "note"), node("c", "asset-output")],
      edges: [edge("a-b", "a", "b"), edge("b-c", "b", "c")],
    };

    const plan = buildExecutionPlan(graph);
    const bPlan = plan.nodes.find((n) => n.nodeId === "b");

    expect(bPlan?.dependencyNodeIds).toEqual(["a"]);
    expect(bPlan?.incomingEdges.map((e) => e.id)).toEqual(["a-b"]);
    expect(bPlan?.outgoingEdges.map((e) => e.id)).toEqual(["b-c"]);
  });

  it("identifies all nodes without incoming edges as rootNodeIds", () => {
    const graph: FlowGraph = {
      nodes: [node("a", "text-input"), node("b", "text-input"), node("c", "note")],
      edges: [edge("a-c", "a", "c"), edge("b-c", "b", "c")],
    };

    const plan = buildExecutionPlan(graph);

    expect(new Set(plan.rootNodeIds)).toEqual(new Set(["a", "b"]));
  });

  describe("targetNodeId — partial plan restricted to ancestors", () => {
    it("includes only the target and its transitive dependencies", () => {
      const graph: FlowGraph = {
        nodes: [
          node("a", "text-input"),
          node("b", "note"),
          node("c", "note"),
          node("unrelated", "note"),
        ],
        edges: [edge("a-b", "a", "b"), edge("b-c", "b", "c")],
      };

      const plan = buildExecutionPlan(graph, { targetNodeId: "b" });

      expect(new Set(plan.nodeOrder)).toEqual(new Set(["a", "b"]));
      expect(plan.nodeOrder).not.toContain("c");
      expect(plan.nodeOrder).not.toContain("unrelated");
    });

    it("throws when targetNodeId does not exist in the graph", () => {
      const graph: FlowGraph = {
        nodes: [node("a", "text-input")],
        edges: [],
      };

      expect(() => buildExecutionPlan(graph, { targetNodeId: "missing" })).toThrow(
        /Nó alvo não existe no grafo/,
      );
    });

    it("returns just the target node when it has no dependencies", () => {
      const graph: FlowGraph = {
        nodes: [node("a", "text-input"), node("b", "note")],
        edges: [edge("a-b", "a", "b")],
      };

      const plan = buildExecutionPlan(graph, { targetNodeId: "a" });

      expect(plan.nodeOrder).toEqual(["a"]);
    });
  });

  describe("cycle detection", () => {
    it("throws for a direct two-node cycle (a -> b -> a)", () => {
      const graph: FlowGraph = {
        nodes: [node("a", "note"), node("b", "note")],
        edges: [edge("a-b", "a", "b"), edge("b-a", "b", "a")],
      };

      expect(() => buildExecutionPlan(graph)).toThrow(/Grafo inválido para execução/);
    });

    it("throws for a longer cycle (a -> b -> c -> a)", () => {
      const graph: FlowGraph = {
        nodes: [node("a", "note"), node("b", "note"), node("c", "note")],
        edges: [edge("a-b", "a", "b"), edge("b-c", "b", "c"), edge("c-a", "c", "a")],
      };

      expect(() => buildExecutionPlan(graph)).toThrow(/Grafo inválido para execução/);
    });

    it("throws for a self-loop (a -> a)", () => {
      const graph: FlowGraph = {
        nodes: [node("a", "note")],
        edges: [edge("a-a", "a", "a")],
      };

      expect(() => buildExecutionPlan(graph)).toThrow(/Grafo inválido para execução/);
    });
  });

  it("throws when the graph references an unregistered node type", () => {
    const graph: FlowGraph = {
      // @ts-expect-error - intentionally invalid kind to exercise validation
      nodes: [node("a", "does-not-exist")],
      edges: [],
    };

    expect(() => buildExecutionPlan(graph)).toThrow(/Grafo inválido para execução/);
  });
});
