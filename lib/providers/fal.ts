import { fal } from "@fal-ai/client";

import {
  DEFAULT_USD_BRL_RATE,
  FAL_IMAGE_MODELS,
  FAL_PROVIDER_ID,
  findFalImageModel,
  resolveFalImageModelId,
} from "./fal-models";
import type {
  CostEstimate,
  CostLineItem,
  GenParams,
  GeneratedAsset,
  GenerationResult,
  JobHandle,
  ModelInfo,
  ModelKind,
  ModelProvider,
} from "./model-provider";

type FalProviderOptions = {
  apiKey?: string;
  usdBrlRate?: number;
};

type FalQueueOptions = {
  logs?: boolean;
  pollIntervalMs?: number;
};

type ImageSize =
  | "square_hd"
  | "square"
  | "portrait_4_3"
  | "portrait_16_9"
  | "landscape_4_3"
  | "landscape_16_9"
  | {
      width: number;
      height: number;
    };

const FLUX_IMAGE_SIZES: Record<Exclude<ImageSize, object>, [number, number]> = {
  square_hd: [1024, 1024],
  square: [512, 512],
  portrait_4_3: [768, 1024],
  portrait_16_9: [576, 1024],
  landscape_4_3: [1024, 768],
  landscape_16_9: [1024, 576],
};

const NANO_BANANA_RESOLUTION_MULTIPLIER = {
  "0.5K": 0.75,
  "1K": 1,
  "2K": 1.5,
  "4K": 2,
} as const;

function removeUndefined(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
}

function getStringParam(params: GenParams, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function getNumberParam(params: GenParams, key: string) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBooleanParam(params: GenParams, key: string) {
  const value = params[key];
  return typeof value === "boolean" ? value : undefined;
}

function getImageCount(params: GenParams) {
  const requested = getNumberParam(params, "numImages") ?? getNumberParam(params, "num_images") ?? 1;

  if (!Number.isInteger(requested) || requested < 1 || requested > 4) {
    throw new Error("numImages deve ser um inteiro entre 1 e 4.");
  }

  return requested;
}

function getPrompt(params: GenParams) {
  const prompt = getStringParam(params, "prompt");

  if (!prompt?.trim()) {
    throw new Error("prompt e obrigatorio para gerar imagem.");
  }

  return prompt;
}

function getUsdBrlRate(explicitRate?: number) {
  const rawRate = explicitRate ?? Number(process.env.USD_BRL_RATE);
  return Number.isFinite(rawRate) && rawRate > 0 ? rawRate : DEFAULT_USD_BRL_RATE;
}

function toCostEstimate({
  lineItems,
  source,
  usdBrlRate,
}: {
  lineItems: CostLineItem[];
  source: string;
  usdBrlRate: number;
}): CostEstimate {
  const usd = lineItems.reduce((total, item) => total + item.usd, 0);

  return {
    usd: Number(usd.toFixed(6)),
    brl: Number((usd * usdBrlRate).toFixed(4)),
    usdBrlRate,
    lineItems,
    source,
  };
}

function getFluxImageSize(params: GenParams): ImageSize {
  const value = params.imageSize ?? params.image_size ?? "landscape_4_3";

  if (typeof value === "object" && value && "width" in value && "height" in value) {
    return {
      width: Number(value.width),
      height: Number(value.height),
    };
  }

  if (typeof value === "string" && value in FLUX_IMAGE_SIZES) {
    return value as Exclude<ImageSize, object>;
  }

  throw new Error("imageSize invalido para FLUX dev.");
}

function getFluxMegapixels(params: GenParams) {
  const imageSize = getFluxImageSize(params);
  const [width, height] =
    typeof imageSize === "string"
      ? FLUX_IMAGE_SIZES[imageSize]
      : [imageSize.width, imageSize.height];

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("imageSize customizado precisa de width/height positivos.");
  }

  return Math.max(1, Math.ceil((width * height) / 1_000_000));
}

function normalizeOutputFormat(params: GenParams, fallback: "jpeg" | "png" | "webp") {
  return getStringParam(params, "outputFormat") ?? getStringParam(params, "output_format") ?? fallback;
}

function normalizeFalInput(model: string, params: GenParams) {
  const prompt = getPrompt(params);
  const numImages = getImageCount(params);

  if (model === "fal-ai/flux/dev") {
    return removeUndefined({
      prompt,
      image_size: params.imageSize ?? params.image_size ?? "landscape_4_3",
      num_images: numImages,
      seed: getNumberParam(params, "seed"),
      output_format: normalizeOutputFormat(params, "jpeg"),
      num_inference_steps: getNumberParam(params, "num_inference_steps"),
      guidance_scale: getNumberParam(params, "guidance_scale"),
      enable_safety_checker: getBooleanParam(params, "enable_safety_checker") ?? true,
      acceleration: getStringParam(params, "acceleration") ?? "none",
      sync_mode: false,
    });
  }

  if (model === "fal-ai/nano-banana-2") {
    return removeUndefined({
      prompt,
      aspect_ratio: getStringParam(params, "aspectRatio") ?? getStringParam(params, "aspect_ratio") ?? "auto",
      resolution: getStringParam(params, "resolution") ?? "1K",
      num_images: numImages,
      seed: getNumberParam(params, "seed"),
      output_format: normalizeOutputFormat(params, "png"),
      safety_tolerance: getStringParam(params, "safety_tolerance") ?? "4",
      limit_generations: getBooleanParam(params, "limit_generations") ?? true,
      enable_web_search:
        getBooleanParam(params, "enableWebSearch") ?? getBooleanParam(params, "enable_web_search"),
      thinking_level:
        getStringParam(params, "thinkingLevel") ?? getStringParam(params, "thinking_level"),
      sync_mode: false,
    });
  }

  throw new Error(`Modelo fal.ai nao suportado: ${model}`);
}

function normalizeGeneratedImages(raw: unknown): GeneratedAsset[] {
  const maybeImages =
    raw && typeof raw === "object" && "images" in raw
      ? (raw as { images?: unknown }).images
      : undefined;

  if (!Array.isArray(maybeImages)) {
    return [];
  }

  return maybeImages
    .filter((image): image is Record<string, unknown> => Boolean(image) && typeof image === "object")
    .map((image) => ({
      url: typeof image.url === "string" ? image.url : "",
      contentType: typeof image.content_type === "string" ? image.content_type : undefined,
      fileName: typeof image.file_name === "string" ? image.file_name : undefined,
      fileSize: typeof image.file_size === "number" ? image.file_size : undefined,
      width: typeof image.width === "number" ? image.width : undefined,
      height: typeof image.height === "number" ? image.height : undefined,
    }))
    .filter((image) => image.url);
}

export class FalProvider implements ModelProvider {
  id = FAL_PROVIDER_ID;
  private readonly hasCredentials: boolean;
  private readonly usdBrlRate: number;

  constructor(options: FalProviderOptions = {}) {
    this.usdBrlRate = getUsdBrlRate(options.usdBrlRate);

    const credentials = options.apiKey ?? process.env.FAL_KEY;
    this.hasCredentials = Boolean(credentials);

    if (credentials) {
      fal.config({
        credentials,
      });
    }
  }

  listModels(kind: ModelKind): ModelInfo[] {
    if (kind !== "image") {
      return [];
    }

    return FAL_IMAGE_MODELS.map(({ aliases, defaultInput, ...model }) => {
      void aliases;
      void defaultInput;
      return model;
    });
  }

  estimateCost(model: string, params: GenParams): CostEstimate {
    const resolvedModel = resolveFalImageModelId(model);
    const modelInfo = findFalImageModel(resolvedModel);

    if (!modelInfo) {
      throw new Error(`Modelo fal.ai nao suportado: ${model}`);
    }

    const imageCount = getImageCount(params);

    if (resolvedModel === "fal-ai/flux/dev") {
      const billedMegapixels = getFluxMegapixels(params);
      const quantity = imageCount * billedMegapixels;

      return toCostEstimate({
        usdBrlRate: this.usdBrlRate,
        source: "pesquisas/P1-gateways-precos.md + fal.ai/modelos em 2026-07-03",
        lineItems: [
          {
            label: "FLUX.1 [dev]",
            quantity,
            unit: "megapixel",
            unitPriceUsd: modelInfo.pricing.unitPriceUsd,
            usd: quantity * modelInfo.pricing.unitPriceUsd,
          },
        ],
      });
    }

    const resolution = getStringParam(params, "resolution") ?? "1K";
    const multiplier =
      resolution in NANO_BANANA_RESOLUTION_MULTIPLIER
        ? NANO_BANANA_RESOLUTION_MULTIPLIER[
            resolution as keyof typeof NANO_BANANA_RESOLUTION_MULTIPLIER
          ]
        : 1;
    const enableWebSearch =
      getBooleanParam(params, "enableWebSearch") ?? getBooleanParam(params, "enable_web_search") ?? false;
    const thinkingLevel =
      getStringParam(params, "thinkingLevel") ?? getStringParam(params, "thinking_level");
    const lineItems: CostLineItem[] = [
      {
        label: `Nano Banana 2 (${resolution})`,
        quantity: imageCount,
        unit: "image",
        unitPriceUsd: modelInfo.pricing.unitPriceUsd * multiplier,
        usd: imageCount * modelInfo.pricing.unitPriceUsd * multiplier,
      },
    ];

    if (enableWebSearch) {
      lineItems.push({
        label: "Nano Banana 2 web search",
        quantity: 1,
        unit: "image",
        unitPriceUsd: 0.015,
        usd: 0.015,
      });
    }

    if (thinkingLevel === "high") {
      lineItems.push({
        label: "Nano Banana 2 high thinking",
        quantity: 1,
        unit: "image",
        unitPriceUsd: 0.002,
        usd: 0.002,
      });
    }

    return toCostEstimate({
      usdBrlRate: this.usdBrlRate,
      source: "pesquisas/P1-gateways-precos.md + fal.ai/modelos em 2026-07-03",
      lineItems,
    });
  }

  async generate(model: string, params: GenParams): Promise<JobHandle> {
    if (!this.hasCredentials) {
      throw new Error("FAL_KEY nao configurada. Defina a chave da fal.ai antes de gerar.");
    }

    const resolvedModel = resolveFalImageModelId(model);
    const webhookUrl = getStringParam(params, "webhookUrl");
    const response = await fal.queue.submit(resolvedModel as never, {
      input: normalizeFalInput(resolvedModel, params),
      webhookUrl,
    } as never);

    return {
      id: response.request_id,
      provider: this.id,
      model: resolvedModel,
    };
  }

  async waitForResult(
    handle: JobHandle,
    params: GenParams,
    options: FalQueueOptions = {},
  ): Promise<GenerationResult> {
    if (handle.provider !== this.id) {
      throw new Error(`Job provider inesperado: ${handle.provider}`);
    }

    await fal.queue.subscribeToStatus(handle.model, {
      requestId: handle.id,
      logs: options.logs ?? true,
      mode: "polling",
      pollInterval: options.pollIntervalMs ?? 1000,
    });

    const result = await fal.queue.result(handle.model as never, {
      requestId: handle.id,
    });
    const images = normalizeGeneratedImages(result.data);

    if (images.length === 0) {
      throw new Error("fal.ai concluiu sem retornar imagem.");
    }

    return {
      provider: this.id,
      model: handle.model,
      requestId: result.requestId,
      images,
      cost: this.estimateActualCost(handle.model, params, images),
      raw: result.data,
    };
  }

  async generateAndWait(
    model: string,
    params: GenParams,
    options?: FalQueueOptions,
  ): Promise<GenerationResult> {
    const handle = await this.generate(model, params);
    return this.waitForResult(handle, params, options);
  }

  estimateActualCost(
    model: string,
    params: GenParams,
    images: GeneratedAsset[],
  ): CostEstimate {
    const resolvedModel = resolveFalImageModelId(model);

    if (resolvedModel !== "fal-ai/flux/dev") {
      return this.estimateCost(resolvedModel, params);
    }

    const modelInfo = findFalImageModel(resolvedModel);

    if (!modelInfo) {
      throw new Error(`Modelo fal.ai nao suportado: ${model}`);
    }

    const quantity = images.reduce((total, image) => {
      if (!image.width || !image.height) {
        return total + getFluxMegapixels(params);
      }

      return total + Math.max(1, Math.ceil((image.width * image.height) / 1_000_000));
    }, 0);

    return toCostEstimate({
      usdBrlRate: this.usdBrlRate,
      source: "fal.ai output real + tabela local de preco",
      lineItems: [
        {
          label: "FLUX.1 [dev]",
          quantity,
          unit: "megapixel",
          unitPriceUsd: modelInfo.pricing.unitPriceUsd,
          usd: quantity * modelInfo.pricing.unitPriceUsd,
        },
      ],
    });
  }
}
