import { describe, expect, it } from "vitest";

import { createFlowTemplateGraph } from "@/lib/flows/templates";
import { validateFlowGraph } from "@/lib/flows/validation";

describe("flow templates", () => {
  it("creates the real prompt to image to video to output graph", () => {
    const graph = createFlowTemplateGraph("image-to-video");
    const kinds = graph.nodes.map((node) => node.data.kind);

    expect(kinds).toEqual([
      "prompt",
      "image-generation",
      "video-generation",
      "asset-output",
    ]);
    expect(graph.edges.map(({ source, target }) => [source, target])).toEqual([
      ["template-prompt", "template-image"],
      ["template-image", "template-video"],
      ["template-video", "template-output"],
    ]);
    expect(graph.nodes.find((node) => node.id === "template-image")?.data.params).toMatchObject({
      providerId: "fal",
      model: "fal-ai/flux/dev",
    });
    expect(graph.nodes.find((node) => node.id === "template-video")?.data.params).toMatchObject({
      providerId: "fal",
      model: "fal-ai/wan-25-preview/image-to-video",
      duration: "5",
      resolution: "1080p",
      prompt: "",
    });
    expect(validateFlowGraph(graph)).toEqual({ valid: true, issues: [] });
  });

  it("preserves an image-only secondary graph", () => {
    const graph = createFlowTemplateGraph("image-only");
    expect(graph.nodes.map((node) => node.data.kind)).toEqual([
      "prompt",
      "image-generation",
      "asset-output",
    ]);
    expect(graph.edges).toHaveLength(2);
    expect(validateFlowGraph(graph)).toEqual({ valid: true, issues: [] });
  });
});
