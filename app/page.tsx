import "./landing.css";

import { HeroCanvas } from "@/components/landing/hero-canvas";
import { BeatSection } from "@/components/landing/beat-section";
import { PainelSection } from "@/components/home/painel-section";
import { listRecentFlows, getCurrentMonthSpendBrl } from "@/lib/db/flows";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [flows, monthSpend] = await Promise.all([
    listRecentFlows(4).catch(() => []),
    getCurrentMonthSpendBrl().catch(() => 0),
  ]);

  return (
    <>
      <HeroCanvas />

      {/* Seções Normais pós-hero */}
      <BeatSection beat="b4">
        <p className="font-mono text-xs uppercase tracking-wide text-lab-text-muted">
          Para onde o laboratório caminha
        </p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-lab-text sm:text-4xl">
          Métrica vira aprendizado, aprendizado vira pauta.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-lab-text-dim sm:text-lg">
          É a direção que estamos construindo: o resultado de cada fluxo
          alimentando o próximo, fechando o loop entre o que performou e o
          que ainda vamos produzir.
        </p>
      </BeatSection>

      <BeatSection beat="b5">
        <h2 className="font-display text-3xl font-semibold text-lab-text sm:text-4xl">
          Crie seu primeiro fluxo.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-lab-text-dim sm:text-lg">
          O painel está logo abaixo, com seus fluxos recentes e o gasto do
          mês.
        </p>
        <a
          href="#painel"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-control bg-lab-reagent px-6 font-display text-sm font-semibold text-lab-bg transition-colors hover:bg-lab-reagent-bright"
        >
          Criar seu primeiro fluxo
        </a>
      </BeatSection>

      <PainelSection id="painel" flows={flows} monthSpend={monthSpend} />

      <a
        href="#painel"
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-lab-border bg-lab-surface-1 px-4 py-2 text-xs font-medium text-lab-text-dim shadow-lg transition-colors hover:border-lab-border-strong hover:text-lab-text"
      >
        Pular para o painel
      </a>
    </>
  );
}
