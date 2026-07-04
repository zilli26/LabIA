import { describe, expect, it } from "vitest";

import type { LabFlowNode, LabNodeKind } from "@/lib/flows/graph";
import { hasPaidVideoNode, PAID_VIDEO_KINDS } from "@/lib/flows/video-cost-gate";

function node(id: string, kind: LabNodeKind): LabFlowNode {
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

describe("hasPaidVideoNode", () => {
  it.each(PAID_VIDEO_KINDS)("returns true for paid video kind %s", (kind) => {
    expect(hasPaidVideoNode([node(kind, kind)])).toBe(true);
  });

  it("returns false for image and prompt-only flows", () => {
    expect(
      hasPaidVideoNode([
        node("briefing", "text-input"),
        node("prompt", "prompt"),
        node("image", "image-generation"),
      ]),
    ).toBe(false);
  });

  it("returns false when the flow only has local video assembly", () => {
    expect(hasPaidVideoNode([node("assembly", "video-assembly")])).toBe(false);
  });
});
