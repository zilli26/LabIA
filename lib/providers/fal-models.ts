import type { ModelInfo, PricingUnit } from "./model-provider";

export const FAL_PROVIDER_ID = "fal";
export const DEFAULT_USD_BRL_RATE = 5.4;

type FalModelPricing = {
  unit: PricingUnit;
  unitPriceUsd: number;
  note: string;
};

type FalVideoEndpointMode = "text-to-video" | "image-to-video" | "reference-to-video";

type FalVideoAudioSupport = {
  status: "supported" | "unsupported" | "unknown";
  parameter?: string;
  generatedTogether: boolean;
  note: string;
};

type FalVideoExtendSupport = {
  status: "supported" | "unsupported" | "unknown";
  note: string;
};

type FalVideoPricingOption = {
  label: string;
  unit: PricingUnit;
  unitPriceUsd: number;
  note: string;
};

export type FalImageModelInfo = ModelInfo & {
  aliases: string[];
  defaultInput: Record<string, unknown>;
  pricing: FalModelPricing;
};

export type FalVideoModelInfo = ModelInfo & {
  aliases: string[];
  defaultInput: Record<string, unknown>;
  endpoints: Partial<Record<FalVideoEndpointMode, string>>;
  supportedModes: FalVideoEndpointMode[];
  supportedDurations: string[];
  nativeAudio: FalVideoAudioSupport;
  nativeExtend: FalVideoExtendSupport;
  pricing: FalModelPricing & {
    withoutAudioUnitPriceUsd?: number;
    withAudioUnitPriceUsd?: number;
    options?: FalVideoPricingOption[];
  };
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

export const FAL_VIDEO_MODELS = [
  {
    id: "fal-ai/wan-25-preview/image-to-video",
    aliases: ["wan-2.5", "wan-25", "wan-25-preview", "wan"],
    provider: FAL_PROVIDER_ID,
    name: "Wan 2.5 Preview",
    kind: "video",
    description: "Modelo Alibaba Wan 2.5 para texto->video e imagem->video via fal.ai.",
    pricing: {
      unit: "second",
      unitPriceUsd: 0.15,
      note: "US$0.05/s em 480p, US$0.10/s em 720p, US$0.15/s em 1080p. Doc fal.ai consultada em 2026-07-04.",
      options: [
        {
          label: "480p",
          unit: "second",
          unitPriceUsd: 0.05,
          note: "Mesmo preco documentado nas paginas text-to-video e image-to-video.",
        },
        {
          label: "720p",
          unit: "second",
          unitPriceUsd: 0.1,
          note: "Mesmo preco documentado nas paginas text-to-video e image-to-video.",
        },
        {
          label: "1080p",
          unit: "second",
          unitPriceUsd: 0.15,
          note: "Preco default local por usar resolucao 1080p no defaultInput.",
        },
      ],
    },
    endpoints: {
      "text-to-video": "fal-ai/wan-25-preview/text-to-video",
      "image-to-video": "fal-ai/wan-25-preview/image-to-video",
    },
    supportedModes: ["text-to-video", "image-to-video"],
    supportedDurations: ["5", "10"],
    nativeAudio: {
      status: "unsupported",
      parameter: "audio_url",
      generatedTogether: false,
      note: "A doc expõe audio_url como audio de entrada/background music; nao encontrei geracao nativa de audio.",
    },
    nativeExtend: {
      status: "unsupported",
      note: "Nao encontrei endpoint/parametro de extend nativo nas docs publicas da fal.ai para Wan 2.5.",
    },
    defaultInput: {
      resolution: "1080p",
      duration: "5",
      aspect_ratio: "16:9",
      enable_prompt_expansion: true,
      enable_safety_checker: true,
    },
  },
  {
    id: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    aliases: ["kling-2.5", "kling-v2.5", "kling-25", "kling"],
    provider: FAL_PROVIDER_ID,
    name: "Kling 2.5 Turbo Pro",
    kind: "video",
    description: "Modelo Kuaishou Kling 2.5 Turbo Pro para texto->video e imagem->video via fal.ai.",
    pricing: {
      unit: "clip",
      unitPriceUsd: 0.35,
      note: "US$0.35 por 5s; cada segundo adicional custa US$0.07. Doc fal.ai consultada em 2026-07-04.",
      options: [
        {
          label: "5s",
          unit: "clip",
          unitPriceUsd: 0.35,
          note: "Preco minimo documentado para clipe de 5s.",
        },
        {
          label: "10s",
          unit: "clip",
          unitPriceUsd: 0.7,
          note: "Calculado da regra publica: US$0.35 por 5s + 5 * US$0.07.",
        },
      ],
    },
    endpoints: {
      "text-to-video": "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
      "image-to-video": "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    },
    supportedModes: ["text-to-video", "image-to-video"],
    supportedDurations: ["5", "10"],
    nativeAudio: {
      status: "unsupported",
      generatedTogether: false,
      note: "Nao encontrei generate_audio/audio_url no endpoint geral Kling 2.5 Turbo Pro; audio aparece apenas em endpoints separados de avatar/lipsync.",
    },
    nativeExtend: {
      status: "unknown",
      note: "P2 cita extend nativo do Kling fora da fal.ai, mas nao encontrei endpoint/parametro de extend nativo para v2.5 nas docs publicas da fal.ai.",
    },
    defaultInput: {
      duration: "5",
      negative_prompt: "blur, distort, and low quality",
      cfg_scale: 0.5,
    },
  },
  {
    id: "fal-ai/minimax/hailuo-2.3/standard/image-to-video",
    aliases: ["hailuo", "hailuo-2.3", "minimax-hailuo", "minimax"],
    provider: FAL_PROVIDER_ID,
    name: "MiniMax Hailuo 2.3 Standard",
    kind: "video",
    description: "Modelo MiniMax Hailuo 2.3 Standard para texto->video e imagem->video via fal.ai.",
    pricing: {
      unit: "clip",
      unitPriceUsd: 0.28,
      note: "Standard: US$0.28/6s ou US$0.56/10s. Pro tambem existe a US$0.49/geracao, mas sem duracao explicita no schema publico. Docs fal.ai consultadas em 2026-07-04.",
      options: [
        {
          label: "Standard 6s",
          unit: "clip",
          unitPriceUsd: 0.28,
          note: "Endpoint standard text/image-to-video.",
        },
        {
          label: "Standard 10s",
          unit: "clip",
          unitPriceUsd: 0.56,
          note: "Endpoint standard text/image-to-video.",
        },
        {
          label: "Pro",
          unit: "clip",
          unitPriceUsd: 0.49,
          note: "Variante Pro documentada como US$0.49 por geracao; duracao nao ficou explicita no schema publico.",
        },
      ],
    },
    endpoints: {
      "text-to-video": "fal-ai/minimax/hailuo-2.3/standard/text-to-video",
      "image-to-video": "fal-ai/minimax/hailuo-2.3/standard/image-to-video",
    },
    supportedModes: ["text-to-video", "image-to-video"],
    supportedDurations: ["6", "10"],
    nativeAudio: {
      status: "unknown",
      generatedTogether: false,
      note: "Exemplos Pro incluem linha 'Audio:' no prompt, mas nao encontrei generate_audio/audio_url nem declaracao explicita de audio nativo na doc publica.",
    },
    nativeExtend: {
      status: "unsupported",
      note: "Nao encontrei endpoint/parametro de extend nativo nas docs publicas da fal.ai para Hailuo 2.3.",
    },
    defaultInput: {
      duration: "6",
      prompt_optimizer: true,
    },
  },
  {
    id: "bytedance/seedance-2.0/image-to-video",
    aliases: ["seedance", "seedance-2.0", "bytedance-seedance"],
    provider: FAL_PROVIDER_ID,
    name: "Seedance 2.0",
    kind: "video",
    description: "Modelo ByteDance Seedance 2.0 multimodal para texto->video, imagem->video e reference-to-video via fal.ai.",
    pricing: {
      unit: "second",
      unitPriceUsd: 0.3034,
      note: "US$0.3034/s em 720p com audio segundo pagina text-to-video; pagina image-to-video lista US$0.3024/s para Standard. Conflito registrado, usando o maior valor. Docs fal.ai consultadas em 2026-07-04.",
      withAudioUnitPriceUsd: 0.3034,
      withoutAudioUnitPriceUsd: 0.3034,
      options: [
        {
          label: "720p Standard com audio",
          unit: "second",
          unitPriceUsd: 0.3034,
          note: "Pagina text-to-video/overview.",
        },
        {
          label: "720p Standard image-to-video",
          unit: "second",
          unitPriceUsd: 0.3024,
          note: "Pagina image-to-video; conflitante por US$0.001/s com a pagina text-to-video.",
        },
        {
          label: "720p Fast com audio",
          unit: "second",
          unitPriceUsd: 0.2419,
          note: "Endpoints fast text/image/reference-to-video.",
        },
        {
          label: "1080p com audio",
          unit: "second",
          unitPriceUsd: 0.682,
          note: "Endpoint standard image-to-video reconfirmado em 2026-07-04 antes da tarefa 1.",
        },
      ],
    },
    endpoints: {
      "text-to-video": "bytedance/seedance-2.0/text-to-video",
      "image-to-video": "bytedance/seedance-2.0/image-to-video",
      "reference-to-video": "bytedance/seedance-2.0/reference-to-video",
    },
    supportedModes: ["text-to-video", "image-to-video", "reference-to-video"],
    supportedDurations: ["auto", "4-15"],
    nativeAudio: {
      status: "supported",
      parameter: "generate_audio",
      generatedTogether: true,
      note: "Audio e video sao gerados juntos; generate_audio default true. A pagina image-to-video diz que audio esta incluido sem custo extra.",
    },
    nativeExtend: {
      status: "supported",
      note: "A doc descreve extensao via reference-to-video: fornecer video de referencia e pedir o que acontece a seguir.",
    },
    defaultInput: {
      resolution: "720p",
      duration: "5",
      aspect_ratio: "auto",
      generate_audio: true,
    },
  },
  {
    id: "fal-ai/veo3/image-to-video",
    aliases: ["veo3", "veo-3", "google-veo3", "veo"],
    provider: FAL_PROVIDER_ID,
    name: "Google Veo 3",
    kind: "video",
    description: "Modelo Google Veo 3 para texto->video e imagem->video via fal.ai, com audio nativo opcional.",
    pricing: {
      unit: "second",
      unitPriceUsd: 0.4,
      note: "Pagina do endpoint lista US$0.20/s sem audio e US$0.40/s com audio. Readme da mesma pagina conflita com US$0.50/0.75 Standard e US$0.25/0.40 Fast; conflito registrado. Docs fal.ai consultadas em 2026-07-04.",
      withoutAudioUnitPriceUsd: 0.2,
      withAudioUnitPriceUsd: 0.4,
      options: [
        {
          label: "audio off",
          unit: "second",
          unitPriceUsd: 0.2,
          note: "Preco exibido no endpoint fal-ai/veo3 e fal-ai/veo3/image-to-video.",
        },
        {
          label: "audio on",
          unit: "second",
          unitPriceUsd: 0.4,
          note: "Preco exibido no endpoint fal-ai/veo3 e fal-ai/veo3/image-to-video.",
        },
      ],
    },
    endpoints: {
      "text-to-video": "fal-ai/veo3",
      "image-to-video": "fal-ai/veo3/image-to-video",
    },
    supportedModes: ["text-to-video", "image-to-video"],
    supportedDurations: ["4s", "6s", "8s"],
    nativeAudio: {
      status: "supported",
      parameter: "generate_audio",
      generatedTogether: true,
      note: "generate_audio controla audio nativo e defaulta para true.",
    },
    nativeExtend: {
      status: "unknown",
      note: "P2 cita extend/Frames-to-Video fora da fal.ai, mas nao encontrei endpoint/parametro de extend nativo nas docs publicas da fal.ai para Veo 3.",
    },
    defaultInput: {
      duration: "8s",
      resolution: "720p",
      aspect_ratio: "auto",
      generate_audio: true,
      auto_fix: true,
      safety_tolerance: "4",
    },
  },
] satisfies FalVideoModelInfo[];

export type FalImageModelId = (typeof FAL_IMAGE_MODELS)[number]["id"];
export type FalVideoModelId = (typeof FAL_VIDEO_MODELS)[number]["id"];

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

export function findFalVideoModel(model: string) {
  return FAL_VIDEO_MODELS.find(
    (candidate) =>
      candidate.id === model ||
      candidate.aliases.includes(model) ||
      Object.values(candidate.endpoints).includes(model),
  );
}

export function resolveFalVideoModelId(model: string) {
  const modelInfo = findFalVideoModel(model);

  if (!modelInfo) {
    throw new Error(`Modelo de video fal.ai nao catalogado: ${model}`);
  }

  return modelInfo.id;
}
