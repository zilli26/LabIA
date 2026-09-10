import Link from "next/link";
import { ArrowRight, Clock3, WalletCards } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewFlowButton } from "@/app/(studio)/fluxos/new-flow-button";
import type { listRecentFlows } from "@/lib/db/flows";
import { formatBrl, formatDate } from "@/lib/format";

export type RecentFlow = Awaited<ReturnType<typeof listRecentFlows>>[number];

function flowCostLabel(flow: RecentFlow) {
  const latestRun = flow.runs.at(0);
  const actual = Number(latestRun?.totalActualCostBrl ?? 0);
  const estimated = Number(latestRun?.totalEstimatedCostBrl ?? 0);

  if (actual > 0) {
    return formatBrl(actual);
  }

  if (estimated > 0) {
    return `~${formatBrl(estimated)}`;
  }

  return formatBrl(0);
}

type PainelSectionProps = {
  id: string;
  flows: RecentFlow[];
  monthSpend: number;
};

export function PainelSection({ id, flows, monthSpend }: PainelSectionProps) {
  return (
    <main
      id={id}
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 py-8"
    >
      <section className="flex flex-col gap-5 border-b border-lab-border pb-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase text-lab-text-muted">
            Painel do laboratório
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-lab-text">
            Produção por fluxo, custo sempre à vista.
          </h1>
          <p className="mt-3 text-sm leading-6 text-lab-text-dim">
            Comece por um fluxo recente ou monte um novo experimento para imagem,
            copy, vídeo e publicação.
          </p>
        </div>
        <NewFlowButton />
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">
              Últimos fluxos
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/fluxos">
                Ver todos
                <ArrowRight />
              </Link>
            </Button>
          </div>

          {flows.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {flows.map((flow) => (
                <Link
                  key={flow.id}
                  href={`/fluxos/${flow.id}`}
                  className="group rounded-control border border-lab-border bg-lab-surface-1 p-4 transition-colors hover:border-lab-border-strong hover:bg-lab-surface-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-semibold">
                        {flow.name}
                      </h3>
                      <div className="mt-2 flex items-center gap-2 text-xs text-lab-text-muted">
                        <Clock3 className="size-3.5" />
                        {formatDate(flow.updatedAt)}
                      </div>
                    </div>
                    <Badge variant="cost">{flowCostLabel(flow)}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-control border border-dashed border-lab-border bg-lab-surface-1 p-6 text-sm text-lab-text-dim">
              Nenhum fluxo encontrado. Crie o primeiro para começar pelo canvas.
            </div>
          )}
        </div>

        <aside className="rounded-control border border-lab-border bg-lab-surface-1 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase text-lab-text-muted">
                Gasto do mês
              </p>
              <div className="mt-2 font-display text-2xl font-semibold">
                {formatBrl(monthSpend)}
              </div>
            </div>
            <div className="flex size-10 items-center justify-center rounded-control border border-lab-border bg-lab-surface-2 text-lab-reagent-bright">
              <WalletCards className="size-5" />
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-lab-text-dim">
            Soma dos custos reais registrados nas gerações concluídas neste mês.
          </p>
        </aside>
      </section>
    </main>
  );
}
