import { prisma } from "@/lib/db/prisma";
import { parseProjectAssetMetadata } from "@/lib/assets/asset-input";
import type { NodeDefinition } from "@/lib/flows/types";
import { zeroCost } from "@/lib/flows/types";

export const utilityNodeDefinitions: NodeDefinition[] = [
  {
    type: "asset-input",
    label: "Asset importado",
    description: "Seleciona uma imagem ou vídeo já importado no Projeto.",
    inputs: [],
    outputs: [
      { id: "image", label: "Imagem", type: "image" },
      { id: "video", label: "Vídeo", type: "video" },
    ],
    estimateCost() {
      return zeroCost;
    },
    async execute(ctx) {
      const assetId = typeof ctx.params.assetId === "string" ? ctx.params.assetId.trim() : "";
      const projectRole = typeof ctx.params.projectRole === "string" ? ctx.params.projectRole : "";

      if (!assetId || !projectRole) {
        throw new Error("Selecione um Asset e seu papel no Projeto.");
      }

      const flowRun = await prisma.flowRun.findFirst({
        where: {
          id: ctx.flowRunId,
          flow: { workspaceId: ctx.workspaceId },
        },
        select: { flow: { select: { projectId: true } } },
      });
      const projectId = flowRun?.flow.projectId;

      if (!projectId) {
        throw new Error("O Flow precisa pertencer a um Projeto para usar Asset importado.");
      }

      const asset = await prisma.asset.findFirst({
        where: {
          id: assetId,
          workspaceId: ctx.workspaceId,
          projectId,
          origin: "UPLOADED",
          type: { in: ["IMAGE", "VIDEO"] },
        },
        select: { id: true, url: true, type: true, origin: true, metadata: true },
      });

      if (!asset) {
        throw new Error("Asset não encontrado no Projeto do Flow.");
      }

      const metadata = parseProjectAssetMetadata(asset.metadata);
      if (metadata.projectRole !== projectRole) {
        throw new Error("O papel selecionado não corresponde ao Asset do Projeto.");
      }

      const output = {
        assetId: asset.id,
        url: asset.url,
        type: asset.type === "IMAGE" ? "image" : "video",
        projectRole: metadata.projectRole,
      } as const;

      return {
        outputs: asset.type === "IMAGE" ? { image: output } : { video: output },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "asset-input",
    },
  },
  {
    type: "text-input",
    label: "Texto",
    description: "Entrada de texto para briefing, prompt ou contexto.",
    inputs: [],
    outputs: [
      {
        id: "text",
        label: "Texto",
        type: "text",
      },
    ],
    estimateCost() {
      return zeroCost;
    },
    async execute(ctx) {
      const text = typeof ctx.params.text === "string" ? ctx.params.text : "";

      return {
        outputs: {
          text,
        },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "text-input",
    },
  },
  {
    type: "note",
    label: "Nota",
    description: "Anotação interna que pode receber e repassar qualquer valor.",
    inputs: [
      {
        id: "input",
        label: "Entrada",
        type: "any",
      },
    ],
    outputs: [
      {
        id: "output",
        label: "Saída",
        type: "any",
      },
    ],
    estimateCost() {
      return zeroCost;
    },
    async execute(ctx) {
      return {
        outputs: {
          output: ctx.inputs.input ?? ctx.inputs,
        },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "note",
    },
  },
  {
    type: "asset-output",
    label: "Saída",
    description: "Destino lógico do resultado produzido pelo fluxo.",
    inputs: [
      {
        id: "input",
        label: "Entrada",
        type: "any",
      },
    ],
    outputs: [],
    estimateCost() {
      return zeroCost;
    },
    async execute(ctx) {
      return {
        outputs: {
          received: ctx.inputs.input ?? ctx.inputs,
        },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "asset-output",
    },
  },
];
