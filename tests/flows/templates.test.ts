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

  it("creates the imported product to short video recipe without image generation", () => {
    const graph = createFlowTemplateGraph("product-imported-to-video");

    expect(graph.nodes.map((node) => node.data.kind)).toEqual([
      "asset-input",
      "video-generation",
      "asset-output",
    ]);
    expect(graph.nodes.some((node) => node.data.kind === "image-generation")).toBe(false);
    expect(graph.nodes.find((node) => node.id === "template-asset")?.data.params).toMatchObject({
      assetId: "",
      projectRole: "source",
      pending: true,
    });
    expect(graph.edges).toEqual([
      expect.objectContaining({
        source: "template-asset",
        sourceHandle: "image",
        target: "template-video",
      }),
      expect.objectContaining({
        source: "template-video",
        target: "template-output",
      }),
    ]);
    expect(validateFlowGraph(graph)).toEqual({ valid: true, issues: [] });
  });
});
