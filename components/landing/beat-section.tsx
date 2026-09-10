import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type BeatSection = "b0" | "b1" | "b2" | "b3" | "b4" | "b5";

type BeatSectionProps = {
  beat: BeatSection;
  className?: string;
  children: ReactNode;
};

/**
 * Section genérica de um beat da narrativa de scroll da landing.
 * F1: estática, sem animação — apenas estrutura e copy.
 * `data-beat` identifica o beat para fases futuras (reveal/observer).
 */
export function BeatSection({ beat, className, children }: BeatSectionProps) {
  return (
    <section
      data-beat={beat}
      className={cn(
        "relative mx-auto flex w-full max-w-4xl flex-col items-center px-5 py-24 text-center",
        className,
      )}
    >
      {children}
    </section>
  );
}
