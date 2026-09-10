"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handler = () => {
      const hero = document.getElementById("hero");
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const raw = -rect.top / scrollable;
      setProgress(Math.max(0, Math.min(1, raw)));
    };

    window.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return progress;
}

export function HeroOverlay() {
  const progress = useScrollProgress();

  const fade = (inStart: number, inEnd: number, outStart: number, outEnd: number) => {
    if (progress < inStart || progress > outEnd) return 0;
    if (progress >= inEnd && progress <= outStart) return 1;
    if (progress < inEnd) return (progress - inStart) / (inEnd - inStart);
    return 1 - (progress - outStart) / (outEnd - outStart);
  };

  const oB0 = fade(0, 0, 0.10, 0.15);
  const oB1 = fade(0.12, 0.18, 0.35, 0.40);
  const oB2 = fade(0.38, 0.42, 0.68, 0.73);
  const oB3 = fade(0.70, 0.75, 1.0, 1.0);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">

      {/* B0 — Hero inicial */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-5 text-center"
        style={{ opacity: oB0, pointerEvents: oB0 > 0.3 ? "auto" : "none" }}
      >
        <p className="font-mono text-xs uppercase tracking-widest text-lab-text-muted">
          Laboratório de produção com IA
        </p>
        <h1 className="lab-wordmark text-5xl sm:text-7xl">
          Lab<span>IA</span>
        </h1>
        <p className="max-w-lg text-balance text-lg leading-8 text-lab-text-dim sm:text-xl">
          Cada post nasce de um fluxo. Copy, imagem, vídeo e publicação
          conectados num só lugar, com o custo de cada geração à vista antes
          de rodar.
        </p>
        <Link
          href="#painel"
          className="inline-flex h-11 items-center justify-center rounded-control bg-lab-reagent px-6 font-display text-sm font-semibold text-lab-bg transition-colors hover:bg-lab-reagent-bright"
        >
          Entrar no painel
        </Link>
      </div>

      {/* B1 */}
      <div
        className="absolute inset-0 flex items-center justify-center px-5 text-center"
        style={{ opacity: oB1 }}
      >
        <p className="font-display text-2xl font-medium leading-snug text-lab-text sm:text-4xl max-w-xl drop-shadow-lg">
          Todo resultado nasce de um fluxo.
        </p>
      </div>

      {/* B2 */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center"
        style={{ opacity: oB2 }}
      >
        <h2 className="font-display text-3xl font-semibold text-lab-text sm:text-4xl drop-shadow-lg">
          Um fluxo, quatro raízes.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-lab-text-dim sm:text-lg drop-shadow-md">
          Copy, imagem, vídeo e publicação não são ferramentas separadas — são
          módulos do mesmo fluxo, cada um com sua cor: copy em{" "}
          <span className="text-[#FFC46B] font-medium">âmbar</span>, imagem em{" "}
          <span className="text-[#8B7CFF] font-medium">violeta</span>, vídeo em{" "}
          <span className="text-[#4DD8FF] font-medium">ciano</span>, publicação
          em <span className="text-[#5EE38B] font-medium">verde</span>.
        </p>
      </div>

      {/* B3 */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center"
        style={{ opacity: oB3 }}
      >
        <h2 className="font-display text-3xl font-semibold text-lab-text sm:text-4xl drop-shadow-lg">
          Executa vendo o custo, não depois dele.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-lab-text-dim sm:text-lg drop-shadow-md">
          Antes de rodar, o fluxo mostra quanto vai custar. Depois de rodar,
          mostra quanto custou de verdade. Sem plano fixo, sem surpresa na
          fatura.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-lab-reagent/20 bg-lab-reagent-dim px-4 py-2 font-mono text-sm text-lab-reagent-bright shadow-lg">
          ~R$0,43
        </div>
      </div>
    </div>
  );
}
