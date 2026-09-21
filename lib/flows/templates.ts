import type { FlowGraph, LabFlowNode } from "@/lib/flows/graph";

export type FlowTemplateId = "image-to-video" | "image-only";
export type ProductFlowTemplateId =
  | "product-imported-to-video"
  | "product-production-blueprint";

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

export function createFlowTemplateGraph(
  template: FlowTemplateId | ProductFlowTemplateId,
): FlowGraph {
  if (template === "product-production-blueprint") {
    const briefing = node(
      "blueprint-briefing",
      "text-input",
      "Briefing",
      "Intenção, público e hipótese que o fluxo precisa responder.",
      { x: 48, y: 64 },
      { text: "", stage: "briefing" },
    );
    const context = node(
      "blueprint-context",
      "note",
      "Contexto do Projeto",
      "Registro de contexto para uma futura camada MCP de direção.",
      { x: 336, y: 64 },
      { stage: "context", mcpTool: "read_project_context" },
    );
    const asset = node(
      "blueprint-source",
      "asset-input",
      "Imagem-base",
      "Asset source importado e aprovado no Projeto.",
      { x: 48, y: 300 },
      { assetId: "", projectRole: "source", pending: true, stage: "source" },
    );
    const animate = node(
      "blueprint-animate",
      "video-generation",
      "Animar imagem",
      "Primeiro clipe: testar movimento com custo visível.",
      { x: 432, y: 300 },
      {
        providerId: "fal",
        model: "fal-ai/wan-25-preview/image-to-video",
        duration: "5",
        resolution: "1080p",
        prompt: "",
        stage: "test",
        mcpTool: "estimate_and_request_generation",
      },
    );
    const review = node(
      "blueprint-review",
      "note",
      "Revisar / escolher",
      "Ponto de decisão: registre a escolha antes de expandir a cena.",
      { x: 816, y: 300 },
      { stage: "review", humanApprovalRequired: true, mcpTool: "record_human_decision" },
    );
    const extend = node(
      "blueprint-continue",
      "video-extend",
      "Continuar clipe",
      "Expandir a cena aprovada a partir do último frame.",
      { x: 1200, y: 300 },
      {
        providerId: "fal",
        model: "fal-ai/wan-25-preview/image-to-video",
        duration: "5",
        resolution: "1080p",
        prompt: "",
        sceneContext: "",
        stage: "expand",
        mcpTool: "extend_approved_clip",
      },
    );
    const assembly = node(
      "blueprint-assembly",
      "video-assembly",
      "Juntar clipes",
      "Montagem local das cenas aprovadas; custo R$0.",
      { x: 1600, y: 300 },
      { stage: "finalize", mcpTool: "assemble_approved_clips" },
    );
    const output = node(
      "blueprint-output",
      "asset-output",
      "Saída",
      "Entrega final e evidência recuperável do trabalho.",
      { x: 1960, y: 300 },
      { stage: "deliver" },
    );

    return {
      nodes: [briefing, context, asset, animate, review, extend, assembly, output],
      edges: [
        { id: "blueprint-briefing-to-context", source: briefing.id, target: context.id, type: "smoothstep" },
        { id: "blueprint-asset-to-animate", source: asset.id, sourceHandle: "image", target: animate.id, type: "smoothstep" },
        { id: "blueprint-animate-to-review", source: animate.id, target: review.id, type: "smoothstep" },
        { id: "blueprint-review-to-continue", source: review.id, target: extend.id, type: "smoothstep" },
        { id: "blueprint-animate-to-assembly", source: animate.id, target: assembly.id, type: "smoothstep" },
        { id: "blueprint-continue-to-assembly", source: extend.id, target: assembly.id, type: "smoothstep" },
        { id: "blueprint-assembly-to-output", source: assembly.id, target: output.id, type: "smoothstep" },
      ],
      viewport: { x: 0, y: 0, zoom: 0.8 },
    };
  }

  if (template === "product-imported-to-video") {
    const asset = node(
      "template-asset",
      "asset-input",
      "Imagem-base",
      "Selecione um Asset source importado no Projeto.",
      { x: 96, y: 120 },
      { assetId: "", projectRole: "source", pending: true },
    );
    const video = node(
      "template-video",
      "video-generation",
      "Animar imagem",
      "Vídeo curto a partir da imagem-base selecionada.",
      { x: 512, y: 120 },
      {
        providerId: "fal",
        model: "fal-ai/wan-25-preview/image-to-video",
        duration: "5",
        resolution: "1080p",
        prompt: "",
      },
    );
    const output = node(
      "template-output",
      "asset-output",
      "Saída",
      "Destino do resultado produzido pelo fluxo.",
      { x: 928, y: 120 },
    );

    return {
      nodes: [asset, video, output],
      edges: [
        {
          id: "template-asset-to-video",
          source: asset.id,
          sourceHandle: "image",
          target: video.id,
          type: "smoothstep",
        },
        {
          id: "template-video-to-output",
          source: video.id,
          target: output.id,
          type: "smoothstep",
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }
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
