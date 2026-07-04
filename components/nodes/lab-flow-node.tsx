"use client";

import type { CSSProperties } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import {
  Clapperboard,
  FileText,
  MessageSquareText,
  StickyNote,
  UploadCloud,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FAL_IMAGE_MODELS, FAL_VIDEO_MODELS } from "@/lib/providers/fal-models";
import { cn } from "@/lib/utils";
import type { LabFlowNode, LabNodeKind } from "@/lib/flows/graph";

const nodeMeta: Record<
  LabNodeKind,
  {
    label: string;
    accent: string;
    Icon: LucideIcon;
  }
> = {
  "text-input": {
    label: "texto",
    accent: "var(--lab-node-copy)",
    Icon: FileText,
  },
  prompt: {
    label: "prompt",
    accent: "var(--lab-node-image)",
    Icon: MessageSquareText,
  },
  "image-generation": {
    label: "imagem",
    accent: "var(--lab-node-image)",
    Icon: WandSparkles,
  },
  "video-generation": {
    label: "vídeo",
    accent: "var(--lab-node-video)",
    Icon: Clapperboard,
  },
  note: {
    label: "nota",
    accent: "var(--lab-node-utility)",
    Icon: StickyNote,
  },
  "asset-output": {
    label: "saída",
    accent: "var(--lab-node-design)",
    Icon: UploadCloud,
  },
};

const imageModelOptions = FAL_IMAGE_MODELS.map((model) => ({
  id: model.id,
  name: model.name,
  unit: model.pricing.unit === "megapixel" ? "MP" : "img",
  unitPriceUsd: model.pricing.unitPriceUsd,
}));

const videoModelOptions = FAL_VIDEO_MODELS.map((model) => ({
  id: model.id,
  name: model.name,
  supportedDurations: model.supportedDurations,
  nativeAudio: model.nativeAudio,
  defaultInput: model.defaultInput,
}));

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function emitNodeDataChange() {
  window.dispatchEvent(new CustomEvent("lab-flow-node-data-change"));
}

function getVideoDurationOptions(model: (typeof videoModelOptions)[number]) {
  if (model.supportedDurations.includes("4-15")) {
    return Array.from({ length: 12 }, (_, index) => String(index + 4));
  }

  return model.supportedDurations
    .filter((duration) => duration !== "auto")
    .map((duration) => duration.replace(/s$/i, ""));
}

function getVideoResolutionOptions(modelId: string) {
  if (modelId.includes("wan-25-preview")) {
    return ["480p", "720p", "1080p"];
  }

  if (modelId.includes("seedance-2.0")) {
    return ["720p", "1080p"];
  }

  return [];
}

function supportsNativeAudio(model: (typeof videoModelOptions)[number]) {
  return model.nativeAudio.status === "supported";
}

function getVideoPriceLabel(modelId: string) {
  if (modelId.includes("wan-25-preview")) {
    return "US$0,05-0,15/s por resolução";
  }

  if (modelId.includes("kling-video")) {
    return "US$0,35/5s ou US$0,70/10s";
  }

  if (modelId.includes("hailuo-2.3")) {
    return "US$0,28/6s ou US$0,56/10s";
  }

  if (modelId.includes("seedance-2.0")) {
    return "US$0,3034-0,682/s com áudio incluso";
  }

  if (modelId.includes("veo3")) {
    return "US$0,20/s sem áudio ou US$0,40/s com áudio";
  }

  return "Preço catalogado";
}

export function LabFlowNodeComponent({
  id,
  data,
  selected,
}: NodeProps<LabFlowNode>) {
  const meta = nodeMeta[data.kind];
  const Icon = meta.Icon;
  const { setNodes } = useReactFlow<LabFlowNode>();
  const params = data.params ?? {};
  const selectedImageModel =
    getString(params.model) ?? imageModelOptions[0]?.id ?? "fal-ai/flux/dev";
  const selectedImageModelInfo =
    imageModelOptions.find((model) => model.id === selectedImageModel) ??
    imageModelOptions[0];
  const selectedVideoModel =
    getString(params.model) ??
    videoModelOptions[0]?.id ??
    "fal-ai/wan-25-preview/image-to-video";
  const selectedVideoModelInfo =
    videoModelOptions.find((model) => model.id === selectedVideoModel) ??
    videoModelOptions[0];
  const videoDurationOptions = selectedVideoModelInfo
    ? getVideoDurationOptions(selectedVideoModelInfo)
    : [];
  const selectedVideoDuration =
    getString(params.duration)?.replace(/s$/i, "") ??
    (typeof selectedVideoModelInfo?.defaultInput.duration === "string"
      ? selectedVideoModelInfo.defaultInput.duration.replace(/s$/i, "")
      : videoDurationOptions[0]);
  const videoResolutionOptions = getVideoResolutionOptions(selectedVideoModel);
  const selectedVideoResolution =
    getString(params.resolution) ??
    (typeof selectedVideoModelInfo?.defaultInput.resolution === "string"
      ? selectedVideoModelInfo.defaultInput.resolution
      : videoResolutionOptions[0]);
  const selectedGenerateAudio =
    getBoolean(params.generate_audio) ??
    (typeof selectedVideoModelInfo?.defaultInput.generate_audio === "boolean"
      ? selectedVideoModelInfo.defaultInput.generate_audio
      : false);
  const assetUrl = getString(params.assetUrl);
  const generationStatus = getString(params.generationStatus);
  const actualCostBrl = getNumber(params.actualCostBrl);
  const costLabel =
    actualCostBrl !== undefined ? `${formatBrl(actualCostBrl)} ok` : data.costLabel;

  function updateParams(nextParams: Record<string, unknown>) {
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                params: {
                  ...(node.data.params ?? {}),
                  ...nextParams,
                },
              },
            }
          : node,
      ),
    );
    emitNodeDataChange();
  }

  return (
    <div
      className={cn(
        "relative w-64 overflow-hidden rounded-lab border bg-lab-surface-2 text-lab-text shadow-none transition-colors",
        selected ? "border-lab-reagent shadow-lab-focus" : "border-lab-border",
      )}
      style={{ "--node-accent": meta.accent } as CSSProperties}
    >
      <div className="h-0.5 w-full bg-[var(--node-accent)]" />
      <div className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-control border border-lab-border bg-lab-surface-1 text-[var(--node-accent)]">
              <Icon aria-hidden className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-semibold">
                {data.title}
              </div>
              <div className="font-mono text-[11px] text-lab-text-muted">
                {meta.label}
              </div>
            </div>
          </div>
          {costLabel ? <Badge variant="cost">{costLabel}</Badge> : null}
        </div>

        <p className="mt-3 line-clamp-2 text-xs leading-5 text-lab-text-muted">
          {data.description}
        </p>

        {data.kind === "prompt" ? (
          <textarea
            aria-label="Prompt"
            value={getString(params.prompt) ?? ""}
            onChange={(event) => updateParams({ prompt: event.target.value })}
            placeholder="Descreva a imagem..."
            className="nodrag nowheel mt-3 h-24 w-full resize-none rounded-control border border-lab-border bg-lab-surface-1 px-3 py-2 font-mono text-xs leading-5 text-lab-text outline-none transition-colors placeholder:text-lab-text-muted focus:border-lab-border-strong focus:shadow-lab-focus"
          />
        ) : null}

        {data.kind === "image-generation" ? (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase text-lab-text-muted">
                modelo
              </span>
              <select
                aria-label="Modelo de imagem"
                value={selectedImageModel}
                onChange={(event) => updateParams({ model: event.target.value })}
                className="nodrag nowheel h-9 w-full rounded-control border border-lab-border bg-lab-surface-1 px-2 text-xs text-lab-text outline-none transition-colors focus:border-lab-border-strong focus:shadow-lab-focus"
              >
                {imageModelOptions.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {formatUsd(model.unitPriceUsd)}/{model.unit}
                  </option>
                ))}
              </select>
            </label>

            {selectedImageModelInfo ? (
              <div className="flex items-center justify-between gap-2 rounded-control border border-lab-border bg-lab-surface-1 px-2.5 py-2">
                <span className="truncate font-mono text-[11px] text-lab-text-dim">
                  {selectedImageModelInfo.name}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-lab-reagent-bright">
                  {formatUsd(selectedImageModelInfo.unitPriceUsd)}/
                  {selectedImageModelInfo.unit}
                </span>
              </div>
            ) : null}

            {assetUrl ? (
              <div className="overflow-hidden rounded-control border border-lab-border bg-lab-surface-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetUrl}
                  alt="Imagem gerada"
                  className="aspect-square w-full object-cover"
                />
              </div>
            ) : generationStatus ? (
              <div className="flex h-28 items-center justify-center rounded-control border border-dashed border-lab-border bg-lab-surface-1 text-xs text-lab-text-muted">
                {generationStatus === "done"
                  ? "imagem indisponível"
                  : generationStatus}
              </div>
            ) : (
              <div className="flex h-20 items-center justify-center rounded-control border border-dashed border-lab-border bg-lab-surface-1 text-center text-xs text-lab-text-muted">
                Conecte um Prompt e execute.
              </div>
            )}

            {getString(params.errorMessage) ? (
              <p className="rounded-control border border-lab-danger/40 bg-lab-surface-1 px-2 py-1.5 text-xs text-lab-danger">
                {getString(params.errorMessage)}
              </p>
            ) : null}
          </div>
        ) : null}

        {data.kind === "video-generation" && selectedVideoModelInfo ? (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase text-lab-text-muted">
                modelo
              </span>
              <select
                aria-label="Modelo de vídeo"
                value={selectedVideoModel}
                onChange={(event) => {
                  const nextModel =
                    videoModelOptions.find(
                      (model) => model.id === event.target.value,
                    ) ?? videoModelOptions[0];
                  const nextDurations = getVideoDurationOptions(nextModel);
                  const nextResolutions = getVideoResolutionOptions(nextModel.id);

                  updateParams({
                    model: nextModel.id,
                    duration:
                      typeof nextModel.defaultInput.duration === "string"
                        ? nextModel.defaultInput.duration.replace(/s$/i, "")
                        : nextDurations[0],
                    resolution:
                      typeof nextModel.defaultInput.resolution === "string"
                        ? nextModel.defaultInput.resolution
                        : nextResolutions[0],
                    generate_audio:
                      typeof nextModel.defaultInput.generate_audio === "boolean"
                        ? nextModel.defaultInput.generate_audio
                        : false,
                  });
                }}
                className="nodrag nowheel h-9 w-full rounded-control border border-lab-border bg-lab-surface-1 px-2 text-xs text-lab-text outline-none transition-colors focus:border-lab-border-strong focus:shadow-lab-focus"
              >
                {videoModelOptions.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {getVideoPriceLabel(model.id)}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-control border border-lab-border bg-lab-surface-1 px-2.5 py-2">
              <div className="truncate font-mono text-[11px] text-lab-text-dim">
                {selectedVideoModelInfo.name}
              </div>
              <div className="mt-1 font-mono text-[11px] text-lab-reagent-bright">
                {getVideoPriceLabel(selectedVideoModel)}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase text-lab-text-muted">
                movimento
              </span>
              <textarea
                aria-label="Prompt de movimento"
                value={getString(params.prompt) ?? ""}
                onChange={(event) => updateParams({ prompt: event.target.value })}
                placeholder="Descreva movimento, câmera e ritmo..."
                className="nodrag nowheel h-20 w-full resize-none rounded-control border border-lab-border bg-lab-surface-1 px-3 py-2 font-mono text-xs leading-5 text-lab-text outline-none transition-colors placeholder:text-lab-text-muted focus:border-lab-border-strong focus:shadow-lab-focus"
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase text-lab-text-muted">
                duração
              </span>
              <select
                aria-label="Duração do vídeo"
                value={selectedVideoDuration}
                onChange={(event) => updateParams({ duration: event.target.value })}
                className="nodrag nowheel h-9 w-full rounded-control border border-lab-border bg-lab-surface-1 px-2 text-xs text-lab-text outline-none transition-colors focus:border-lab-border-strong focus:shadow-lab-focus"
              >
                {videoDurationOptions.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}s
                  </option>
                ))}
              </select>
            </label>

            {videoResolutionOptions.length > 0 ? (
              <label className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase text-lab-text-muted">
                  resolução
                </span>
                <select
                  aria-label="Resolução do vídeo"
                  value={selectedVideoResolution}
                  onChange={(event) =>
                    updateParams({ resolution: event.target.value })
                  }
                  className="nodrag nowheel h-9 w-full rounded-control border border-lab-border bg-lab-surface-1 px-2 text-xs text-lab-text outline-none transition-colors focus:border-lab-border-strong focus:shadow-lab-focus"
                >
                  {videoResolutionOptions.map((resolution) => (
                    <option key={resolution} value={resolution}>
                      {resolution}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {supportsNativeAudio(selectedVideoModelInfo) ? (
              <label className="flex items-center justify-between gap-3 rounded-control border border-lab-border bg-lab-surface-1 px-2.5 py-2">
                <span className="text-xs text-lab-text-dim">Gerar áudio</span>
                <input
                  type="checkbox"
                  aria-label="Gerar áudio"
                  checked={selectedGenerateAudio}
                  onChange={(event) =>
                    updateParams({ generate_audio: event.target.checked })
                  }
                  className="nodrag size-4 accent-lab-reagent"
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase text-lab-text-muted">
                imagem de entrada
              </span>
              <input
                aria-label="URL da imagem de entrada"
                value={
                  getString(params.image_url) ??
                  getString(params.imageUrl) ??
                  getString(params.assetUrl) ??
                  ""
                }
                onChange={(event) =>
                  updateParams({ image_url: event.target.value || undefined })
                }
                placeholder="URL de asset, se não houver nó conectado"
                className="nodrag nowheel h-9 w-full rounded-control border border-lab-border bg-lab-surface-1 px-2 font-mono text-xs text-lab-text outline-none transition-colors placeholder:text-lab-text-muted focus:border-lab-border-strong focus:shadow-lab-focus"
              />
            </label>

            {getString(params.generationId) && assetUrl ? (
              <div className="overflow-hidden rounded-control border border-lab-border bg-lab-surface-1">
                <video
                  src={assetUrl}
                  controls
                  className="aspect-video w-full object-cover"
                />
              </div>
            ) : generationStatus ? (
              <div className="flex h-24 items-center justify-center rounded-control border border-dashed border-lab-border bg-lab-surface-1 text-xs text-lab-text-muted">
                {generationStatus === "done"
                  ? "vídeo indisponível"
                  : generationStatus}
              </div>
            ) : (
              <div className="flex h-20 items-center justify-center rounded-control border border-dashed border-lab-border bg-lab-surface-1 px-3 text-center text-xs text-lab-text-muted">
                Conecte uma imagem ou informe um asset.
              </div>
            )}

            {getString(params.errorMessage) ? (
              <p className="rounded-control border border-lab-danger/40 bg-lab-surface-1 px-2 py-1.5 text-xs text-lab-danger">
                {getString(params.errorMessage)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!left-[-5px]"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!right-[-5px]"
      />
    </div>
  );
}
