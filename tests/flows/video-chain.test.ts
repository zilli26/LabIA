import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type { LabFlowNode, LabNodeKind } from "@/lib/flows/graph";
import { countConsecutiveVideoExtends } from "@/lib/flows/video-chain";

function makeNode(id: string, kind: LabNodeKind): LabFlowNode {
  return {
    id,
    type: "labNode",
    position: { x: 0, y: 0 },
    data: {
      kind,
      title: id,
      description: id,
      status: "idle",
    },
  };
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
  };
}

describe("countConsecutiveVideoExtends", () => {
  it("counts the current extend plus consecutive upstream extends", () => {
    const nodes = [
      makeNode("video", "video-generation"),
      makeNode("extend-1", "video-extend"),
      makeNode("extend-2", "video-extend"),
      makeNode("extend-3", "video-extend"),
      makeNode("extend-4", "video-extend"),
      makeNode("extend-5", "video-extend"),
      makeNode("extend-6", "video-extend"),
    ];
    const edges = [
      makeEdge("video", "extend-1"),
      makeEdge("extend-1", "extend-2"),
      makeEdge("extend-2", "extend-3"),
      makeEdge("extend-3", "extend-4"),
      makeEdge("extend-4", "extend-5"),
      makeEdge("extend-5", "extend-6"),
    ];

    expect(
      countConsecutiveVideoExtends({
        nodes,
        edges,
        nodeId: "extend-6",
      }),
    ).toBe(6);
  });

  it("stops counting when the upstream node is not an extend", () => {
    const nodes = [
      makeNode("text2video", "text2video"),
      makeNode("extend-1", "video-extend"),
    ];
    const edges = [makeEdge("text2video", "extend-1")];

    expect(
      countConsecutiveVideoExtends({
        nodes,
        edges,
        nodeId: "extend-1",
      }),
    ).toBe(1);
  });
});
