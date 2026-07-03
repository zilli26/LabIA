import type { ModelInfo, PricingUnit } from "./model-provider";

export const FAL_PROVIDER_ID = "fal";
export const DEFAULT_USD_BRL_RATE = 5.4;

type FalModelPricing = {
  unit: PricingUnit;
  unitPriceUsd: number;
  note: string;
};

export type FalImageModelInfo = ModelInfo & {
  aliases: string[];
  defaultInput: Record<string, unknown>;
  pricing: FalModelPricing;
};

export const FAL_IMAGE_MODELS = [
  {
    id: "fal-ai/flux/dev",
    aliases: ["flux-dev", "flux.1-dev", "flux"],
    provider: FAL_PROVIDER_ID,
    name: "FLUX.1 [dev]",
    kind: "image",
    description: "Modelo de qualidade media para texto->imagem via fal.ai.",
    pricing: {
      unit: "megapixel",
      unitPriceUsd: 0.025,
      note: "US$0.025/MP, arredondando para cima por imagem.",
    },
    defaultInput: {
      image_size: "landscape_4_3",
      num_images: 1,
      output_format: "jpeg",
      enable_safety_checker: true,
      acceleration: "none",
    },
  },
  {
    id: "fal-ai/nano-banana-2",
    aliases: ["nano-banana-2", "nanobanana-2", "banana-2"],
    provider: FAL_PROVIDER_ID,
    name: "Nano Banana 2",
    kind: "image",
    description: "Modelo top de imagem do Google via fal.ai.",
    pricing: {
      unit: "image",
      unitPriceUsd: 0.08,
      note: "US$0.08/imagem em 1K; 0.5K=0.75x, 2K=1.5x, 4K=2x.",
    },
    defaultInput: {
      aspect_ratio: "auto",
      resolution: "1K",
      num_images: 1,
      output_format: "png",
      safety_tolerance: "4",
      limit_generations: true,
    },
  },
] satisfies FalImageModelInfo[];

export type FalImageModelId = (typeof FAL_IMAGE_MODELS)[number]["id"];

export function findFalImageModel(model: string) {
  return FAL_IMAGE_MODELS.find(
    (candidate) => candidate.id === model || candidate.aliases.includes(model),
  );
}

export function resolveFalImageModelId(model: string) {
  const modelInfo = findFalImageModel(model);

  if (!modelInfo) {
    throw new Error(`Modelo fal.ai nao suportado: ${model}`);
  }

  return modelInfo.id;
}
