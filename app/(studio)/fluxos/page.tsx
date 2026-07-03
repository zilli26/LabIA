import Link from "next/link";
import { Clock3, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { listRecentFlows } from "@/lib/db/flows";
import { NewFlowButton } from "@/app/(studio)/fluxos/new-flow-button";

export const dynamic = "force-dynamic";

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function flowCostLabel(flow: Awaited<ReturnType<typeof listRecentFlows>>[number]) {
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

export default async function FlowsPage() {
  const flows = await listRecentFlows(24).catch(() => []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8">
      <section className="flex flex-col gap-4 border-b border-lab-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase text-lab-text-muted">
            Fluxos
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            Experimentos do LabIA
          </h1>
        </div>
        <NewFlowButton />
      </section>

      {flows.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {flows.map((flow) => (
            <Link
              key={flow.id}
              href={`/fluxos/${flow.id}`}
              className="group rounded-control border border-lab-border bg-lab-surface-1 p-4 transition-colors hover:border-lab-border-strong hover:bg-lab-surface-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-control border border-lab-border bg-lab-surface-2 text-lab-reagent-bright">
                    <Workflow className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-base font-semibold">
                      {flow.name}
                    </h2>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-lab-text-muted">
                      <Clock3 className="size-3.5" />
                      {formatDate(flow.updatedAt)}
                    </div>
                  </div>
                </div>
                <Badge variant="cost">{flowCostLabel(flow)}</Badge>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-control border border-dashed border-lab-border bg-lab-surface-1 p-8 text-center">
          <h2 className="font-display text-lg font-semibold">
            Nenhum fluxo criado
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-lab-text-dim">
            Crie um fluxo para abrir o canvas e conectar nós de produção.
          </p>
          <div className="mt-5">
            <NewFlowButton />
          </div>
        </section>
      )}
    </main>
  );
}
