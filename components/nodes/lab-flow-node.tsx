"use client";

import type { CSSProperties } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { FileText, StickyNote, UploadCloud, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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

export function LabFlowNodeComponent({ data, selected }: NodeProps<LabFlowNode>) {
  const meta = nodeMeta[data.kind];
  const Icon = meta.Icon;

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
          <Badge variant="cost">{data.costLabel}</Badge>
        </div>

        <p className="mt-3 line-clamp-2 text-xs leading-5 text-lab-text-dim">
          {data.description}
        </p>
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
