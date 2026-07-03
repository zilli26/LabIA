import type { NodeDefinition } from "@/lib/flows/types";
import { zeroCost } from "@/lib/flows/types";
import { FAL_IMAGE_MODELS } from "@/lib/providers/fal-models";
import { FalProvider } from "@/lib/providers/fal";
import type { CostEstimate, GenParams } from "@/lib/providers/model-provider";

const DEFAULT_IMAGE_MODEL = "fal-ai/flux/dev";

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getModel(params: Record<string, unknown>) {
  return getString(params.model) ?? DEFAULT_IMAGE_MODEL;
}

function getPromptFromInput(input: unknown) {
  if (typeof input === "string") {
    return input;
  }

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    return getString(record.prompt) ?? getString(record.text) ?? getString(record.output);
  }

  return undefined;
}

function buildImageParams({
  params,
  prompt,
}: {
  params: Record<string, unknown>;
  prompt: string;
}): GenParams {
  return {
    ...Object.fromEntries(
      Object.entries(params).filter(
        ([key]) => !["model", "prompt", "assetUrl", "generationId"].includes(key),
      ),
    ),
    prompt,
  };
}

function estimateImageCost(params: Record<string, unknown>): CostEstimate {
  const provider = new FalProvider();
  const prompt = getString(params.prompt) ?? "placeholder";

  return provider.estimateCost(
    getModel(params),
    buildImageParams({
      params,
      prompt,
    }),
  );
}

export const imageNodeDefinitions: NodeDefinition[] = [
  {
    type: "prompt",
    label: "Prompt",
    description: "Texto estruturado para orientar gerações de imagem.",
    inputs: [],
    outputs: [
      {
        id: "output",
        label: "Prompt",
        type: "text",
      },
    ],
    estimateCost() {
      return zeroCost;
    },
    async execute(ctx) {
      const prompt = getString(ctx.params.prompt) ?? "";

      return {
        outputs: {
          output: prompt,
          prompt,
        },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "prompt",
    },
  },
  {
    type: "image-generation",
    label: "Gerar Imagem",
    description: "Enfileira geração text-to-image via fal.ai com custo visível.",
    inputs: [
      {
        id: "input",
        label: "Prompt",
        type: "text",
        required: true,
      },
    ],
    outputs: [
      {
        id: "output",
        label: "Imagem",
        type: "image",
      },
    ],
    estimateCost(ctx) {
      return estimateImageCost(ctx.params);
    },
    async execute(ctx) {
      const prompt =
        getPromptFromInput(ctx.inputs.input) ?? getString(ctx.params.prompt) ?? "";

      if (!prompt.trim()) {
        throw new Error("Prompt obrigatório para gerar imagem.");
      }

      const model = getModel(ctx.params);
      const generationParams = buildImageParams({
        params: ctx.params,
        prompt,
      });
      const { enqueueImageGenerationJob } = await import(
        "@/lib/providers/image-generation-job"
      );
      const queued = await enqueueImageGenerationJob({
        workspaceId: ctx.workspaceId,
        model,
        prompt,
        params: generationParams,
        flowRunId: ctx.flowRunId,
        flowNodeId: ctx.nodeId,
      });

      return {
        outputs: {
          output: {
            generationId: queued.generationId,
            queueJobId: queued.queueJobId,
            status: "queued",
            prompt,
            model,
            estimatedCost: queued.estimatedCost,
          },
          generationId: queued.generationId,
          queueJobId: queued.queueJobId,
          prompt,
          model,
        },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "image-generation",
    },
  },
];

export const imageGenerationModelOptions = FAL_IMAGE_MODELS.map((model) => ({
  id: model.id,
  name: model.name,
  unit: model.pricing.unit,
  unitPriceUsd: model.pricing.unitPriceUsd,
  note: model.pricing.note,
}));
