"use client";

import { useState } from "react";
import { ChevronRight, Clapperboard, FileImage, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FlowTemplate = "image-to-video" | "image-only" | "product-imported-to-video";

const templates: Array<{ id: FlowTemplate; title: string; description: string; primary?: boolean }> = [
  {
    id: "image-to-video",
    title: "Imagem-base → Vídeo curto",
    description: "Gere uma imagem, ajuste o movimento e continue no canvas.",
    primary: true,
  },
  {
    id: "image-only",
    title: "Imagem-base",
    description: "Comece com um fluxo de imagem e edite a receita no canvas.",
  },
  {
    id: "product-imported-to-video",
    title: "Produto importado → Vídeo curto",
    description: "Começa com uma imagem-base do Projeto e não gera imagem automaticamente.",
  },
];

type ProductProjectDraft = {
  name: string;
  objective: string;
  aspectRatio: "9:16";
  durationSeconds: 5;
};

async function createTemplate(template: FlowTemplate, project?: ProductProjectDraft) {
  const response = await fetch("/api/flows", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(project ? { template, project } : { template }),
  });
  const payload = (await response.json().catch(() => ({}))) as { flow?: { id?: unknown }; error?: unknown };
  if (!response.ok || typeof payload.flow?.id !== "string") {
    throw new Error(typeof payload.error === "string" ? payload.error : "Não foi possível criar o fluxo.");
  }
  return payload.flow.id;
}

export function CreateWorkspace() {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate>("image-to-video");
  const [projectName, setProjectName] = useState("");
  const [projectObjective, setProjectObjective] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (isCreating) return;
    const isProductImport = selectedTemplate === "product-imported-to-video";
    if (isProductImport && !projectName.trim()) {
      setError("Informe um nome para o Projeto.");
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      const flowId = await createTemplate(
        selectedTemplate,
        isProductImport
          ? {
              name: projectName.trim(),
              objective: projectObjective.trim(),
              aspectRatio: "9:16",
              durationSeconds: 5,
            }
          : undefined,
      );
      router.push(`/fluxos/${flowId}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível criar o fluxo.");
      setIsCreating(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-5 px-4 py-5 lg:px-6 lg:py-8">
      <header className="border-b border-lab-border pb-5">
        <p className="font-mono text-xs uppercase tracking-wide text-lab-text-muted">Novo fluxo</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">O que você quer criar?</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-lab-text-dim">Escolha uma receita inicial. O Flow real será criado e aberto no canvas para edição e execução.</p>
      </header>

      <section className="rounded-lab border border-lab-border bg-lab-surface-1 p-5" aria-labelledby="template-heading">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase text-lab-text-muted">Receitas iniciais</p>
            <h2 id="template-heading" className="mt-1 font-display text-xl font-semibold">Comece pelo resultado</h2>
          </div>
          <Clapperboard className="size-5 text-lab-reagent-bright" aria-hidden />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Template de fluxo">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              role="radio"
              aria-checked={selectedTemplate === template.id}
              data-template={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={cn("flex min-h-32 items-start gap-3 rounded-control border p-4 text-left transition-colors", selectedTemplate === template.id ? "border-lab-reagent/60 bg-lab-reagent-dim" : "border-lab-border bg-lab-surface-2 hover:border-lab-border-strong")}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-lab-border bg-lab-surface-1 text-[var(--lab-node-video)]">
                {template.primary ? <Clapperboard className="size-4" aria-hidden /> : <FileImage className="size-4" aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium text-lab-text">
                  {template.title}
                  {template.primary ? <Badge className="px-1.5 py-0 text-[10px]">Recomendado</Badge> : null}
                </span>
                <span className="mt-2 block text-xs leading-5 text-lab-text-dim">{template.description}</span>
              </span>
            </button>
          ))}
        </div>

        {selectedTemplate === "product-imported-to-video" ? (
          <div className="mt-5 grid gap-4 rounded-control border border-lab-border bg-lab-surface-2 p-4 sm:grid-cols-2" aria-label="Dados do Projeto">
            <label className="grid gap-1.5 text-sm text-lab-text" htmlFor="project-name">
              Nome do Projeto <span className="text-xs text-lab-text-muted">obrigatório</span>
              <input
                id="project-name"
                name="project-name"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Ex.: Produto X — TikTok Shop"
                required
                className="lab-ghost-input"
              />
            </label>
            <label className="grid gap-1.5 text-sm text-lab-text" htmlFor="project-objective">
              Objetivo do Projeto <span className="text-xs text-lab-text-muted">opcional</span>
              <textarea
                id="project-objective"
                name="project-objective"
                value={projectObjective}
                onChange={(event) => setProjectObjective(event.target.value)}
                placeholder="Ex.: demonstrar o produto em um vídeo curto."
                rows={3}
                className="lab-ghost-input min-h-20 resize-y"
              />
            </label>
            <div className="flex items-center gap-4 text-xs text-lab-text-muted sm:col-span-2">
              <span>Proporção padrão: <strong className="text-lab-text">9:16</strong></span>
              <span>Duração padrão: <strong className="text-lab-text">5 segundos</strong></span>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-lab-border pt-5">
          <Button type="button" onClick={() => void handleCreate()} disabled={isCreating} data-id="create-template">
            {isCreating ? <Loader2 className="animate-spin" aria-hidden /> : <ChevronRight aria-hidden />}
            {isCreating
              ? selectedTemplate === "product-imported-to-video"
                ? "Criando Projeto..."
                : "Criando fluxo..."
              : selectedTemplate === "product-imported-to-video"
                ? "Criar Projeto e abrir canvas"
                : "Editar no canvas"}
          </Button>
          <p className="text-xs text-lab-text-muted">Nenhuma geração é executada nesta etapa.</p>
        </div>
        {error ? <p role="alert" className="mt-4 rounded-control border border-lab-danger/40 bg-lab-surface-2 px-3 py-2 text-sm text-lab-danger">{error}</p> : null}
      </section>
    </main>
  );
}
