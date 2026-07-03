import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Image as ImageIcon, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { hasDatabaseEnv } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { FAL_IMAGE_MODELS } from "@/lib/providers/fal-models";

type LibraryPageProps = {
  searchParams?: Promise<{
    model?: string;
    date?: string;
  }>;
};

const dateFilters = [
  { value: "all", label: "Tudo" },
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

function formatBrl(value: number | null) {
  if (value === null) {
    return "custo pendente";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function decimalToNumber(value: { toString(): string } | null | undefined) {
  return value ? Number(value.toString()) : null;
}

function getDateStart(filter: string | undefined) {
  const now = new Date();

  if (filter === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (filter === "7d") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (filter === "30d") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return undefined;
}

function getModelName(modelId: string | null) {
  if (!modelId) {
    return "modelo não informado";
  }

  return FAL_IMAGE_MODELS.find((model) => model.id === modelId)?.name ?? modelId;
}

function buildFilterHref({
  model,
  date,
}: {
  model?: string;
  date?: string;
}) {
  const params = new URLSearchParams();

  if (model && model !== "all") {
    params.set("model", model);
  }

  if (date && date !== "all") {
    params.set("date", date);
  }

  const query = params.toString();
  return query ? `/biblioteca?${query}` : "/biblioteca";
}

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const filters = (await searchParams) ?? {};
  const selectedModel = filters.model ?? "all";
  const selectedDate = filters.date ?? "all";

  if (!hasDatabaseEnv()) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8">
        <LibraryHeader assetCount={0} />
        <section className="rounded-control border border-dashed border-lab-border bg-lab-surface-1 p-8 text-sm text-lab-text-dim">
          Configure DATABASE_URL e DIRECT_URL para listar a biblioteca real.
        </section>
      </main>
    );
  }

  const assets = await prisma.asset.findMany({
    where: {
      type: "IMAGE",
      ...(selectedModel !== "all" ? { model: selectedModel } : {}),
      ...(getDateStart(selectedDate)
        ? {
            createdAt: {
              gte: getDateStart(selectedDate),
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      generation: true,
    },
    take: 80,
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8">
      <LibraryHeader assetCount={assets.length} />

      <section className="flex flex-wrap items-center gap-2 border-b border-lab-border pb-4">
        <div className="mr-2 flex items-center gap-2 text-xs text-lab-text-muted">
          <SlidersHorizontal className="size-4" />
          filtros
        </div>
        <FilterLink
          href={buildFilterHref({ date: selectedDate })}
          active={selectedModel === "all"}
        >
          todos modelos
        </FilterLink>
        {FAL_IMAGE_MODELS.map((model) => (
          <FilterLink
            key={model.id}
            href={buildFilterHref({ model: model.id, date: selectedDate })}
            active={selectedModel === model.id}
          >
            {model.name}
          </FilterLink>
        ))}
        <div className="mx-1 h-5 w-px bg-lab-border" />
        {dateFilters.map((filter) => (
          <FilterLink
            key={filter.value}
            href={buildFilterHref({ model: selectedModel, date: filter.value })}
            active={selectedDate === filter.value}
          >
            {filter.label}
          </FilterLink>
        ))}
      </section>

      {assets.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => {
            const actualCost = decimalToNumber(asset.generation?.actualCostBrl);
            const prompt = asset.prompt ?? asset.generation?.prompt ?? "";

            return (
              <article
                key={asset.id}
                className="overflow-hidden rounded-control border border-lab-border bg-lab-surface-1"
              >
                <div className="relative aspect-square bg-lab-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={prompt || "Asset gerado"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-3 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="default">{getModelName(asset.model)}</Badge>
                    <Badge variant="cost">{formatBrl(actualCost)}</Badge>
                  </div>
                  <p className="line-clamp-3 min-h-14 font-mono text-xs leading-5 text-lab-text-dim">
                    {prompt || "Prompt não registrado."}
                  </p>
                  <div className="flex items-center justify-between gap-3 border-t border-lab-border pt-3 text-[11px] text-lab-text-muted">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {formatDate(asset.createdAt)}
                    </span>
                    <span className="font-mono">
                      {asset.width && asset.height
                        ? `${asset.width}x${asset.height}`
                        : asset.type.toLowerCase()}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="flex min-h-80 flex-col items-center justify-center rounded-control border border-dashed border-lab-border bg-lab-surface-1 p-8 text-center">
          <ImageIcon className="size-8 text-lab-text-muted" />
          <h2 className="mt-4 font-display text-lg font-semibold">
            Nenhum asset encontrado
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-lab-text-dim">
            Execute um fluxo com o nó Gerar Imagem. Quando o worker concluir, a
            imagem aparece aqui com prompt e custo real.
          </p>
        </section>
      )}
    </main>
  );
}

function LibraryHeader({ assetCount }: { assetCount: number }) {
  return (
    <section className="border-b border-lab-border pb-6">
      <p className="font-mono text-xs uppercase text-lab-text-muted">
        Biblioteca
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">
            Assets e gerações
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-lab-text-dim">
            Grid real dos assets persistidos, com preview, prompt recuperável e
            custo real da geração.
          </p>
        </div>
        <Badge variant="default">{assetCount} assets</Badge>
      </div>
    </section>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full border border-lab-reagent/20 bg-lab-reagent-dim px-3 py-1.5 text-xs font-medium text-lab-reagent-bright"
          : "rounded-full border border-lab-border bg-lab-surface-2 px-3 py-1.5 text-xs font-medium text-lab-text-dim transition-colors hover:border-lab-border-strong hover:text-lab-text"
      }
    >
      {children}
    </Link>
  );
}
