"use client";

import type { CSSProperties } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position, useReactFlow } from "@xyflow/react";
import {
  FileText,
  MessageSquareText,
  StickyNote,
  UploadCloud,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FAL_IMAGE_MODELS } from "@/lib/providers/fal-models";
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

function emitNodeDataChange() {
  window.dispatchEvent(new CustomEvent("lab-flow-node-data-change"));
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
  const selectedModel =
    getString(params.model) ?? imageModelOptions[0]?.id ?? "fal-ai/flux/dev";
  const selectedModelInfo =
    imageModelOptions.find((model) => model.id === selectedModel) ??
    imageModelOptions[0];
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
                value={selectedModel}
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

            {selectedModelInfo ? (
              <div className="flex items-center justify-between gap-2 rounded-control border border-lab-border bg-lab-surface-1 px-2.5 py-2">
                <span className="truncate font-mono text-[11px] text-lab-text-dim">
                  {selectedModelInfo.name}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-lab-reagent-bright">
                  {formatUsd(selectedModelInfo.unitPriceUsd)}/
                  {selectedModelInfo.unit}
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
