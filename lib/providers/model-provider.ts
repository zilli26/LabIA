export type ModelKind = "image" | "video" | "text";

export type PricingUnit = "image" | "megapixel" | "second" | "clip" | "token";

export type BillingMode = "api" | "subscription" | "local";

export function billingModeFromProvider(providerId: string): BillingMode {
  if (providerId === "openai") return "subscription";
  if (providerId === "labia/ffmpeg") return "local";
  if (providerId === "fal") return "api";
  throw new Error(`Provider desconhecido para billingMode: ${providerId}`);
}

export function assertBillingMode(value: unknown): BillingMode {
  if (value === "api" || value === "subscription" || value === "local") return value;
  throw new Error(`billingMode desconhecido: ${String(value)}`);
}

export function normalizeBillingMode(value: unknown, providerId: string): BillingMode {
  const providerMode = billingModeFromProvider(providerId);
  const billingMode = assertBillingMode(value);
  if (billingMode !== providerMode) {
    throw new Error(`billingMode ${billingMode} incompatível com provider ${providerId}`);
  }
  return billingMode;
}

export type CostLineItem = {
  label: string;
  quantity: number;
  unit: PricingUnit;
  unitPriceUsd: number;
  usd: number;
};

export type CostEstimate = {
  usd: number;
  brl: number;
  usdBrlRate?: number;
  lineItems?: CostLineItem[];
  source?: string;
  billingMode: BillingMode;
};

export type ModelInfo = {
  id: string;
  provider: string;
  name: string;
  kind: ModelKind;
  description: string;
  pricing: {
    unit: PricingUnit;
    unitPriceUsd: number;
    note: string;
  };
};

export type ImageGenerationParams = {
  [key: string]: unknown;
  prompt: string;
  numImages?: number;
  num_images?: number;
  seed?: number;
  outputFormat?: "jpeg" | "png" | "webp";
  output_format?: "jpeg" | "png" | "webp";
  imageSize?:
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
  image_size?:
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
  aspectRatio?:
    | "auto"
    | "21:9"
    | "16:9"
    | "3:2"
    | "4:3"
    | "5:4"
    | "1:1"
    | "4:5"
    | "3:4"
    | "2:3"
    | "9:16"
    | "4:1"
    | "1:4"
    | "8:1"
    | "1:8";
  aspect_ratio?:
    | "auto"
    | "21:9"
    | "16:9"
    | "3:2"
    | "4:3"
    | "5:4"
    | "3:4"
    | "1:1"
    | "4:5"
    | "2:3"
    | "9:16"
    | "4:1"
    | "1:4"
    | "8:1"
    | "1:8";
  resolution?: "0.5K" | "1K" | "2K" | "4K";
  enableWebSearch?: boolean;
  enable_web_search?: boolean;
  thinkingLevel?: "minimal" | "high";
  thinking_level?: "minimal" | "high";
  webhookUrl?: string;
};

export type GenParams = ImageGenerationParams | Record<string, unknown>;

export type JobHandle = {
  id: string;
  provider: string;
  model: string;
};

export type GeneratedAsset = {
  url: string;
  contentType?: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

export type GenerationResult = {
  provider: string;
  model: string;
  requestId: string;
  images: GeneratedAsset[];
  videos?: GeneratedAsset[];
  cost: CostEstimate;
  raw: unknown;
};

export type ProviderCapabilities = {
  image: boolean;
  video: boolean;
  recoverableResults: boolean;
};

export interface ModelProvider {
  id: string;
  capabilities?: ProviderCapabilities;
  listModels(kind: ModelKind): ModelInfo[];
  estimateCost(model: string, params: GenParams): CostEstimate;
  generate(model: string, params: GenParams): Promise<JobHandle>;
  waitForResult(
    handle: JobHandle,
    params: GenParams,
    options?: { pollIntervalMs?: number },
  ): Promise<GenerationResult>;
}
