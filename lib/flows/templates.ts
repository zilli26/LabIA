import type { FlowGraph, LabFlowNode } from "@/lib/flows/graph";

export type FlowTemplateId = "image-to-video" | "image-only";

function node(
  id: string,
  kind: LabFlowNode["data"]["kind"],
  title: string,
  description: string,
  position: { x: number; y: number },
  params?: Record<string, unknown>,
): LabFlowNode {
  return { id, type: "labNode", position, data: { kind, title, description, status: "idle", params } };
}

export function createFlowTemplateGraph(template: FlowTemplateId): FlowGraph {
  const prompt = node("template-prompt", "prompt", "Prompt", "Direção da imagem-base.", { x: 96, y: 120 }, { prompt: "" });
  const image = node("template-image", "image-generation", "Gerar Imagem", "Imagem-base com provider selecionável no canvas.", { x: 448, y: 120 }, { providerId: "fal", model: "fal-ai/flux/dev", prompt: "" });
  const output = node("template-output", "asset-output", "Saída", "Destino do resultado produzido pelo fluxo.", { x: template === "image-to-video" ? 1152 : 800, y: 120 });

  if (template === "image-only") {
    return {
      nodes: [prompt, image, output],
      edges: [
        { id: "template-prompt-to-image", source: prompt.id, target: image.id, type: "smoothstep" },
        { id: "template-image-to-output", source: image.id, target: output.id, type: "smoothstep" },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }

  const video = node("template-video", "video-generation", "Gerar Vídeo", "Vídeo curto fal.ai a partir da imagem-base.", { x: 800, y: 120 }, {
    providerId: "fal",
    model: "fal-ai/wan-25-preview/image-to-video",
    duration: "5",
    resolution: "1080p",
    prompt: "",
  });

  return {
    nodes: [prompt, image, video, output],
    edges: [
      { id: "template-prompt-to-image", source: prompt.id, target: image.id, type: "smoothstep" },
      { id: "template-image-to-video", source: image.id, target: video.id, type: "smoothstep" },
      { id: "template-video-to-output", source: video.id, target: output.id, type: "smoothstep" },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
