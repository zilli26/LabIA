import { fal } from "@fal-ai/client";

import {
  DEFAULT_USD_BRL_RATE,
  FAL_IMAGE_MODELS,
  FAL_VIDEO_MODELS,
  FAL_PROVIDER_ID,
  findFalImageModel,
  findFalVideoModel,
  resolveFalImageModelId,
  resolveFalVideoModelId,
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

function getPromptValue(params: GenParams, kind: "imagem" | "video") {
  const prompt = getStringParam(params, "prompt");

  if (!prompt?.trim()) {
    throw new Error(`prompt e obrigatorio para gerar ${kind}.`);
  }

  return prompt;
}

function getImageCount(params: GenParams) {
  const requested = getNumberParam(params, "numImages") ?? getNumberParam(params, "num_images") ?? 1;

  if (!Number.isInteger(requested) || requested < 1 || requested > 4) {
    throw new Error("numImages deve ser um inteiro entre 1 e 4.");
  }

  return requested;
}

function getPrompt(params: GenParams) {
  return getPromptValue(params, "imagem");
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

function getVideoMode(params: GenParams) {
  if (getStringParam(params, "reference_video_url") ?? getStringParam(params, "video_url")) {
    return "reference-to-video" as const;
  }

  if (getStringParam(params, "image_url") ?? getStringParam(params, "imageUrl")) {
    return "image-to-video" as const;
  }

  return "text-to-video" as const;
}

function getVideoEndpoint(model: string, params: GenParams) {
  const modelInfo = findFalVideoModel(model);

  if (!modelInfo) {
    throw new Error(`Modelo de video fal.ai nao catalogado: ${model}`);
  }

  const mode = getVideoMode(params);
  const endpoint = modelInfo.endpoints[mode];

  if (!endpoint) {
    throw new Error(`${modelInfo.name} nao suporta ${mode} pela fal.ai.`);
  }

  return {
    endpoint,
    mode,
    modelInfo,
  };
}

function normalizeVideoDurationValue(params: GenParams, fallback?: unknown) {
  return params.duration ?? params.durationSeconds ?? params.duration_seconds ?? fallback;
}

function parseDurationSeconds(value: unknown, modelName: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    if (value === "auto") {
      throw new Error(`${modelName}: duracao auto nao permite estimativa de custo antes da geracao.`);
    }

    const normalized = value.trim().replace(/s$/i, "");
    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`${modelName}: duracao de video invalida.`);
}

function getVideoDurationSeconds(params: GenParams, modelName: string, fallback?: unknown) {
  const duration = parseDurationSeconds(normalizeVideoDurationValue(params, fallback), modelName);

  if (duration <= 0) {
    throw new Error(`${modelName}: duracao precisa ser maior que zero.`);
  }

  return duration;
}

function getVideoResolution(params: GenParams, fallback?: unknown) {
  const resolution = params.resolution ?? fallback;
  return typeof resolution === "string" ? resolution : undefined;
}

function normalizeDurationInput(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }

  return value;
}

function normalizeFalVideoInput(model: string, params: GenParams) {
  const { endpoint, mode, modelInfo } = getVideoEndpoint(model, params);
  const defaultInput = modelInfo.defaultInput;
  const prompt = getPromptValue(params, "video");
  const imageUrl = getStringParam(params, "image_url") ?? getStringParam(params, "imageUrl");
  const referenceVideoUrl =
    getStringParam(params, "reference_video_url") ?? getStringParam(params, "video_url");
  const duration = normalizeDurationInput(normalizeVideoDurationValue(params, defaultInput.duration));
  const resolution =
    getStringParam(params, "resolution") ??
    (typeof defaultInput.resolution === "string" ? defaultInput.resolution : undefined);
  const aspectRatio =
    getStringParam(params, "aspect_ratio") ??
    getStringParam(params, "aspectRatio") ??
    (typeof defaultInput.aspect_ratio === "string" ? defaultInput.aspect_ratio : undefined);

  if (mode === "image-to-video" && !imageUrl) {
    throw new Error("image_url e obrigatorio para gerar video a partir de imagem.");
  }

  if (mode === "reference-to-video" && !referenceVideoUrl) {
    throw new Error("reference_video_url e obrigatorio para reference-to-video.");
  }

  const common = {
    prompt,
    duration,
    resolution,
    aspect_ratio: aspectRatio,
    seed: getNumberParam(params, "seed"),
    end_user_id: getStringParam(params, "end_user_id") ?? getStringParam(params, "endUserId"),
  };

  if (endpoint.includes("wan-25-preview")) {
    return removeUndefined({
      prompt,
      image_url: imageUrl,
      audio_url: getStringParam(params, "audio_url") ?? getStringParam(params, "audioUrl"),
      resolution,
      duration,
      aspect_ratio: aspectRatio,
      enable_prompt_expansion:
        getBooleanParam(params, "enable_prompt_expansion") ??
        getBooleanParam(params, "enablePromptExpansion") ??
        (typeof defaultInput.enable_prompt_expansion === "boolean"
          ? defaultInput.enable_prompt_expansion
          : undefined),
      enable_safety_checker:
        getBooleanParam(params, "enable_safety_checker") ??
        getBooleanParam(params, "enableSafetyChecker") ??
        (typeof defaultInput.enable_safety_checker === "boolean"
          ? defaultInput.enable_safety_checker
          : undefined),
      seed: common.seed,
    });
  }

  if (endpoint.includes("kling-video")) {
    return removeUndefined({
      prompt,
      image_url: imageUrl,
      duration,
      negative_prompt:
        getStringParam(params, "negative_prompt") ??
        getStringParam(params, "negativePrompt") ??
        (typeof defaultInput.negative_prompt === "string" ? defaultInput.negative_prompt : undefined),
      cfg_scale:
        getNumberParam(params, "cfg_scale") ??
        getNumberParam(params, "cfgScale") ??
        (typeof defaultInput.cfg_scale === "number" ? defaultInput.cfg_scale : undefined),
    });
  }

  if (endpoint.includes("minimax/hailuo-2.3")) {
    return removeUndefined({
      prompt,
      image_url: imageUrl,
      duration,
      prompt_optimizer:
        getBooleanParam(params, "prompt_optimizer") ??
        getBooleanParam(params, "promptOptimizer") ??
        (typeof defaultInput.prompt_optimizer === "boolean"
          ? defaultInput.prompt_optimizer
          : undefined),
    });
  }

  if (endpoint.includes("seedance-2.0")) {
    return removeUndefined({
      ...common,
      image_url: imageUrl,
      video_url: referenceVideoUrl,
      end_image_url:
        getStringParam(params, "end_image_url") ?? getStringParam(params, "endImageUrl"),
      generate_audio:
        getBooleanParam(params, "generate_audio") ??
        getBooleanParam(params, "generateAudio") ??
        (typeof defaultInput.generate_audio === "boolean" ? defaultInput.generate_audio : undefined),
    });
  }

  if (endpoint.includes("veo3")) {
    return removeUndefined({
      ...common,
      image_url: imageUrl,
      generate_audio:
        getBooleanParam(params, "generate_audio") ??
        getBooleanParam(params, "generateAudio") ??
        (typeof defaultInput.generate_audio === "boolean" ? defaultInput.generate_audio : undefined),
      auto_fix:
        getBooleanParam(params, "auto_fix") ??
        getBooleanParam(params, "autoFix") ??
        (typeof defaultInput.auto_fix === "boolean" ? defaultInput.auto_fix : undefined),
      safety_tolerance:
        getStringParam(params, "safety_tolerance") ??
        getStringParam(params, "safetyTolerance") ??
        (typeof defaultInput.safety_tolerance === "string" ? defaultInput.safety_tolerance : undefined),
    });
  }

  throw new Error(`Modelo de video fal.ai nao catalogado: ${model}`);
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

function normalizeGeneratedVideos(raw: unknown): GeneratedAsset[] {
  const maybeVideo =
    raw && typeof raw === "object" && "video" in raw
      ? (raw as { video?: unknown }).video
      : undefined;
  const videos = Array.isArray(maybeVideo) ? maybeVideo : maybeVideo ? [maybeVideo] : [];
  const rawDuration =
    raw && typeof raw === "object" && "duration" in raw && typeof raw.duration === "number"
      ? raw.duration
      : raw &&
          typeof raw === "object" &&
          "duration_seconds" in raw &&
          typeof raw.duration_seconds === "number"
        ? raw.duration_seconds
        : undefined;

  return videos
    .filter((video): video is Record<string, unknown> => Boolean(video) && typeof video === "object")
    .map((video) => ({
      url: typeof video.url === "string" ? video.url : "",
      contentType: typeof video.content_type === "string" ? video.content_type : undefined,
      fileName: typeof video.file_name === "string" ? video.file_name : undefined,
      fileSize: typeof video.file_size === "number" ? video.file_size : undefined,
      width: typeof video.width === "number" ? video.width : undefined,
      height: typeof video.height === "number" ? video.height : undefined,
      durationSeconds:
        typeof video.duration === "number"
          ? video.duration
          : typeof video.duration_seconds === "number"
            ? video.duration_seconds
            : rawDuration,
    }))
    .filter((video) => video.url);
}

function isLikelyFalVideoModel(model: string) {
  return /video|veo|wan|kling|hailuo|minimax|seedance|bytedance/i.test(model);
}

function videoCostSource(modelName: string) {
  if (modelName === "Seedance 2.0") {
    return "modulos/02-videos/fontes-tarefa-0.md + fal.ai/bytedance/seedance-2.0/image-to-video reconfirmado em 2026-07-04";
  }

  return "modulos/02-videos/fontes-tarefa-0.md + fal.ai docs consultadas em 2026-07-04";
}

function getWanUnitPriceUsd(resolution: string | undefined) {
  if (resolution === "480p") {
    return 0.05;
  }

  if (resolution === "720p") {
    return 0.1;
  }

  if (resolution === "1080p" || !resolution) {
    return 0.15;
  }

  throw new Error(`Wan 2.5: resolucao sem preco confirmado: ${resolution}`);
}

function getSeedanceUnitPriceUsd(resolution: string | undefined) {
  if (!resolution || resolution === "720p") {
    return 0.3034;
  }

  if (resolution === "1080p") {
    return 0.682;
  }

  throw new Error(`Seedance 2.0: preco ${resolution} nao confirmado.`);
}

function estimateFalVideoCost({
  model,
  params,
  usdBrlRate,
}: {
  model: string;
  params: GenParams;
  usdBrlRate: number;
}) {
  const modelInfo = findFalVideoModel(model);

  if (!modelInfo) {
    throw new Error(`Modelo de video fal.ai nao catalogado: ${model}`);
  }

  const duration = getVideoDurationSeconds(params, modelInfo.name, modelInfo.defaultInput.duration);
  const resolution = getVideoResolution(params, modelInfo.defaultInput.resolution);
  const generateAudio =
    getBooleanParam(params, "generate_audio") ??
    getBooleanParam(params, "generateAudio") ??
    (typeof modelInfo.defaultInput.generate_audio === "boolean"
      ? modelInfo.defaultInput.generate_audio
      : undefined);
  let label = modelInfo.name;
  let quantity = duration;
  let unit: CostLineItem["unit"] = "second";
  let unitPriceUsd = modelInfo.pricing.unitPriceUsd;
  let usd = duration * unitPriceUsd;

  if (modelInfo.id.includes("wan-25-preview")) {
    unitPriceUsd = getWanUnitPriceUsd(resolution);
    label = `${modelInfo.name} (${resolution ?? "1080p"})`;
    usd = duration * unitPriceUsd;
  } else if (modelInfo.id.includes("kling-video")) {
    label = `${modelInfo.name} (${duration}s)`;
    quantity = 1;
    unit = "clip";
    unitPriceUsd = duration <= 5 ? 0.35 : 0.35 + (duration - 5) * 0.07;
    usd = unitPriceUsd;
  } else if (modelInfo.id.includes("minimax/hailuo-2.3")) {
    label = `${modelInfo.name} (${duration}s)`;
    quantity = 1;
    unit = "clip";

    if (duration === 6) {
      unitPriceUsd = 0.28;
    } else if (duration === 10) {
      unitPriceUsd = 0.56;
    } else {
      throw new Error("Hailuo 2.3 Standard aceita apenas duracoes 6s ou 10s para custo confirmado.");
    }

    usd = unitPriceUsd;
  } else if (modelInfo.id.includes("seedance-2.0")) {
    unitPriceUsd = getSeedanceUnitPriceUsd(resolution);
    label = `${modelInfo.name} (${resolution ?? "720p"}, audio incluso)`;
    usd = duration * unitPriceUsd;
  } else if (modelInfo.id.includes("veo3")) {
    unitPriceUsd = generateAudio === false ? 0.2 : 0.4;
    label = `${modelInfo.name} (${generateAudio === false ? "sem audio" : "com audio"})`;
    usd = duration * unitPriceUsd;
  }

  return toCostEstimate({
    usdBrlRate,
    source: videoCostSource(modelInfo.name),
    lineItems: [
      {
        label,
        quantity,
        unit,
        unitPriceUsd,
        usd,
      },
    ],
  });
}

function estimateFalVideoActualCost({
  model,
  params,
  videos,
  usdBrlRate,
}: {
  model: string;
  params: GenParams;
  videos: GeneratedAsset[];
  usdBrlRate: number;
}) {
  const actualDuration = videos.find((video) => video.durationSeconds)?.durationSeconds;

  if (!actualDuration) {
    return estimateFalVideoCost({
      model,
      params,
      usdBrlRate,
    });
  }

  return estimateFalVideoCost({
    model,
    params: {
      ...params,
      duration: actualDuration,
    },
    usdBrlRate,
  });
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
    if (kind === "video") {
      return FAL_VIDEO_MODELS.map(({ aliases, defaultInput, ...model }) => {
        void aliases;
        void defaultInput;
        return model;
      });
    }

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
    const videoModel = findFalVideoModel(model);

    if (videoModel) {
      return estimateFalVideoCost({
        model: videoModel.id,
        params,
        usdBrlRate: this.usdBrlRate,
      });
    }

    if (isLikelyFalVideoModel(model)) {
      resolveFalVideoModelId(model);
    }

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

    const resolvedModel = findFalVideoModel(model)
      ? getVideoEndpoint(model, params).endpoint
      : resolveFalImageModelId(model);
    const webhookUrl = getStringParam(params, "webhookUrl");
    const response = await fal.queue.submit(resolvedModel as never, {
      input: findFalVideoModel(resolvedModel)
        ? normalizeFalVideoInput(resolvedModel, params)
        : normalizeFalInput(resolvedModel, params),
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
    const videoModel = findFalVideoModel(handle.model);

    if (videoModel) {
      const videos = normalizeGeneratedVideos(result.data);

      if (videos.length === 0) {
        throw new Error("fal.ai concluiu sem retornar URL de video.");
      }

      return {
        provider: this.id,
        model: handle.model,
        requestId: result.requestId,
        images: [],
        videos,
        cost: this.estimateActualCost(handle.model, params, videos),
        raw: result.data,
      };
    }

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
    assets: GeneratedAsset[],
  ): CostEstimate {
    const videoModel = findFalVideoModel(model);

    if (videoModel) {
      return estimateFalVideoActualCost({
        model: videoModel.id,
        params,
        videos: assets,
        usdBrlRate: this.usdBrlRate,
      });
    }

    const resolvedModel = resolveFalImageModelId(model);

    if (resolvedModel !== "fal-ai/flux/dev") {
      return this.estimateCost(resolvedModel, params);
    }

    const modelInfo = findFalImageModel(resolvedModel);

    if (!modelInfo) {
      throw new Error(`Modelo fal.ai nao suportado: ${model}`);
    }

    const quantity = assets.reduce((total, image) => {
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
