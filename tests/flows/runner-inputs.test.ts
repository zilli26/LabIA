import { describe, expect, it } from "vitest";

import type { FlowGraph, LabFlowNode, LabNodeKind } from "@/lib/flows/graph";
import { getNodeDefinition } from "@/lib/flows/registry";
import { collectInputs } from "@/lib/flows/runner";
import { buildExecutionPlan } from "@/lib/flows/topology";

function makeNode(
  id: string,
  kind: LabNodeKind,
  position: { x: number; y: number },
): LabFlowNode {
  return {
    id,
    type: "labNode",
    position,
    data: {
      kind,
      title: id,
      description: id,
      status: "idle",
    },
  };
}

describe("collectInputs", () => {
  it("collects multiple target handles ordered by source node position", () => {
    const graph: FlowGraph = {
      nodes: [
        makeNode("clip-right", "video-generation", { x: 300, y: 20 }),
        makeNode("clip-left", "video-generation", { x: 100, y: 40 }),
        makeNode("clip-middle", "video-generation", { x: 200, y: 10 }),
        makeNode("assembly", "video-assembly", { x: 500, y: 20 }),
      ],
      edges: [
        { id: "right", source: "clip-right", target: "assembly" },
        { id: "left", source: "clip-left", target: "assembly" },
        { id: "middle", source: "clip-middle", target: "assembly" },
      ],
    };
    const plan = buildExecutionPlan(graph);
    const plannedNode = plan.nodes.find((node) => node.nodeId === "assembly");
    const definition = getNodeDefinition("video-assembly");

    if (!plannedNode || !definition) {
      throw new Error("Test setup failed.");
    }

    const inputs = collectInputs(
      plannedNode,
      [
        { nodeId: "clip-right", outputs: { output: "right" } },
        { nodeId: "clip-left", outputs: { output: "left" } },
        { nodeId: "clip-middle", outputs: { output: "middle" } },
      ],
      graph,
      definition.inputs,
    );

    expect(inputs.input).toEqual(["left", "middle", "right"]);
  });

  it("uses Y and source id as deterministic tie-breakers for multiple inputs", () => {
    const graph: FlowGraph = {
      nodes: [
        makeNode("clip-b", "video-generation", { x: 100, y: 20 }),
        makeNode("clip-a", "video-generation", { x: 100, y: 20 }),
        makeNode("clip-top", "video-generation", { x: 100, y: 10 }),
        makeNode("assembly", "video-assembly", { x: 500, y: 20 }),
      ],
      edges: [
        { id: "b", source: "clip-b", target: "assembly" },
        { id: "a", source: "clip-a", target: "assembly" },
        { id: "top", source: "clip-top", target: "assembly" },
      ],
    };
    const plan = buildExecutionPlan(graph);
    const plannedNode = plan.nodes.find((node) => node.nodeId === "assembly");
    const definition = getNodeDefinition("video-assembly");

    if (!plannedNode || !definition) {
      throw new Error("Test setup failed.");
    }

    const inputs = collectInputs(
      plannedNode,
      [
        { nodeId: "clip-b", outputs: { output: "b" } },
        { nodeId: "clip-a", outputs: { output: "a" } },
        { nodeId: "clip-top", outputs: { output: "top" } },
      ],
      graph,
      definition.inputs,
    );

    expect(inputs.input).toEqual(["top", "a", "b"]);
  });

  it("keeps non-multiple target handles as a single value", () => {
    const graph: FlowGraph = {
      nodes: [
        makeNode("image-a", "image-generation", { x: 100, y: 20 }),
        makeNode("image-b", "image-generation", { x: 200, y: 20 }),
        makeNode("video", "video-generation", { x: 500, y: 20 }),
      ],
      edges: [
        { id: "a", source: "image-a", target: "video" },
        { id: "b", source: "image-b", target: "video" },
      ],
    };
    const plan = buildExecutionPlan(graph);
    const plannedNode = plan.nodes.find((node) => node.nodeId === "video");
    const definition = getNodeDefinition("video-generation");

    if (!plannedNode || !definition) {
      throw new Error("Test setup failed.");
    }

    const inputs = collectInputs(
      plannedNode,
      [
        { nodeId: "image-a", outputs: { output: "first" } },
        { nodeId: "image-b", outputs: { output: "second" } },
      ],
      graph,
      definition.inputs,
    );

    expect(inputs.input).toBe("second");
  });
});
