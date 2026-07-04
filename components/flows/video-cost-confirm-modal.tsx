"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LabNodeKind } from "@/lib/flows/graph";

export type VideoCostConfirmItem = {
  nodeId: string;
  label: string;
  kind: LabNodeKind;
  brl: number;
};

type VideoCostConfirmModalProps = {
  open: boolean;
  totalBrl: number | null;
  items: VideoCostConfirmItem[];
  isLoading: boolean;
  isConfirming: boolean;
  errorMessage: string | null;
  formatBrl: (value: number) => string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function VideoCostConfirmModal({
  open,
  totalBrl,
  items,
  isLoading,
  isConfirming,
  errorMessage,
  formatBrl,
  onCancel,
  onConfirm,
}: VideoCostConfirmModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => cancelButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  const canConfirm = !isLoading && !isConfirming && !errorMessage && totalBrl !== null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-lab-bg/80 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
      data-id="cost-confirm-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-lg rounded-lab border border-lab-border-strong bg-lab-surface-1 p-5 text-lab-text shadow-lab-focus"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-control border border-lab-border bg-lab-surface-2 text-[var(--lab-node-video)]">
            {isLoading ? <Loader2 className="animate-spin" /> : <AlertTriangle />}
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              Confirmar custo do fluxo
            </h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-lab-text-dim">
              Este valor é uma estimativa antes da execução. Confirmar vai
              enfileirar o fluxo e pode gerar gasto real na fal.ai.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-control border border-lab-reagent/20 bg-lab-reagent-dim px-4 py-3">
          <div className="text-[11px] font-medium uppercase text-lab-text-muted">
            Custo estimado total
          </div>
          <div
            className="mt-1 font-mono text-3xl font-semibold text-lab-reagent-bright"
            data-id="cost-confirm-total"
          >
            {isLoading || totalBrl === null ? "Calculando..." : formatBrl(totalBrl)}
          </div>
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-control border border-lab-danger/40 bg-lab-surface-2 px-3 py-2 text-sm leading-6 text-lab-danger">
            {errorMessage}
          </p>
        ) : (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-medium uppercase text-lab-text-muted">
              Nós pagos de vídeo
            </div>
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-control border border-lab-border bg-lab-surface-2 px-3 py-3 text-sm text-lab-text-dim">
                <Loader2 className="size-4 animate-spin text-lab-reagent-bright" />
                Buscando estimativa fresca do fluxo atual.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-control border border-lab-border bg-lab-surface-2">
                {items.map((item) => (
                  <div
                    key={item.nodeId}
                    className="flex items-center justify-between gap-3 border-b border-lab-border px-3 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-lab-text">
                        {item.label}
                      </div>
                      <div className="font-mono text-[11px] text-lab-text-muted">
                        {item.kind}
                      </div>
                    </div>
                    <div className="shrink-0 font-mono text-sm text-lab-reagent-bright">
                      {formatBrl(item.brl)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            ref={cancelButtonRef}
            data-id="cost-confirm-cancel"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            data-id="cost-confirm-accept"
          >
            {isConfirming ? <Loader2 className="animate-spin" /> : null}
            Confirmar e executar
          </Button>
        </div>
      </div>
    </div>
  );
}
