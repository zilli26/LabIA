"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";

import { isProjectAsset, ProjectAssetsPanel, type ProjectAsset } from "@/components/projects/project-assets-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Project = {
  id: string;
  name: string;
  type: string;
  objective: string;
  aspectRatio: string;
  durationSeconds?: number | null;
  status: string;
  primaryFlow?: { id: string; name?: string | null } | null;
};

type LoadState = "loading" | "ready" | "error";

const typeLabel: Record<string, string> = { IMAGE: "Imagem", VIDEO: "Vídeo" };
const statusLabel: Record<string, string> = {
  DRAFT: "Rascunho",
  IN_PROGRESS: "Em andamento",
  REVIEW: "Em revisão",
  APPROVED: "Aprovado",
  ARCHIVED: "Arquivado",
};

function formatProjectType(type: string) {
  return typeLabel[type] ?? "Tipo não informado";
}

function formatStatus(status: string) {
  return statusLabel[status] ?? "Status não informado";
}

async function readJson(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error("request_failed");
  return body;
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<Project>;
  return typeof project.id === "string"
    && typeof project.name === "string"
    && typeof project.objective === "string"
    && typeof project.aspectRatio === "string"
    && typeof project.type === "string"
    && typeof project.status === "string";
}

export function ProjectWorkspace({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [projectState, setProjectState] = useState<LoadState>("loading");
  const [assetsState, setAssetsState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setProject(null);
    setAssets([]);
    setProjectState("loading");
    setAssetsState("loading");

    const projectPath = `/api/projects/${encodeURIComponent(projectId)}`;
    const assetsPath = `${projectPath}/assets`;
    const request = { method: "GET", cache: "no-store" as const };

    void Promise.allSettled([
      fetch(projectPath, request).then(readJson),
      fetch(assetsPath, request).then(readJson),
    ]).then(([projectResult, assetsResult]) => {
      if (!active) return;

      if (projectResult.status === "fulfilled" && projectResult.value && typeof projectResult.value === "object" && isProject((projectResult.value as { project?: unknown }).project)) {
        setProject((projectResult.value as { project: Project }).project);
        setProjectState("ready");
      } else {
        setProjectState("error");
      }

      if (assetsResult.status === "fulfilled" && assetsResult.value && typeof assetsResult.value === "object" && Array.isArray((assetsResult.value as { assets?: unknown }).assets) && (assetsResult.value as { assets: unknown[] }).assets.every(isProjectAsset)) {
        setAssets((assetsResult.value as { assets: ProjectAsset[] }).assets);
        setAssetsState("ready");
      } else {
        setAssetsState("error");
      }
    });

    return () => {
      active = false;
    };
  }, [projectId, attempt]);

  const projectError = projectState === "error";
  const assetsError = assetsState === "error";

  function handleAssetUploaded(asset: ProjectAsset) {
    setAssets((current) => current.some((existing) => existing.assetId === asset.assetId) ? current : [...current, asset]);
    setAssetsState("ready");
  }

  return (
    <main data-project-id={projectId} className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/projetos" className="inline-flex items-center gap-2 text-sm text-lab-text-dim transition-colors hover:text-lab-text">
          <ArrowLeft className="size-4" />
          Projetos
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-lab-text-muted">Projeto · bancada de produção</span>
      </div>

      {projectState === "loading" ? <section className="rounded-lab border border-dashed border-lab-border bg-lab-surface-1 p-8" aria-live="polite"><p className="font-display text-xl font-semibold">Carregando Projeto…</p><p className="mt-2 text-sm text-lab-text-dim">Buscando o contexto deste trabalho.</p></section> : null}

      {projectError ? (
        <section role="alert" className="rounded-lab border border-lab-danger/40 bg-lab-surface-1 p-8">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-red-300">Estado indisponível</p>
          <h1 className="mt-2 font-display text-2xl font-semibold">Não foi possível carregar o Projeto</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-lab-text-dim">Nenhum dado foi inventado e nenhuma geração foi iniciada. Verifique o control-plane local e tente novamente.</p>
          <Button type="button" variant="secondary" className="mt-5" onClick={() => setAttempt((current) => current + 1)}><RefreshCw />Tentar novamente</Button>
        </section>
      ) : null}

      {project ? (
        <>
          <section className="rounded-lab border border-lab-border bg-lab-surface-1 p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sky-300">Projeto</p>
                <h1 className="mt-2 truncate font-display text-3xl font-semibold">{project.name}</h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-lab-text-dim">{project.objective}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Badge>{formatStatus(project.status)}</Badge>
                {project.primaryFlow?.id ? <Button asChild variant="secondary"><Link href={`/fluxos/${project.primaryFlow.id}`}><ExternalLink />Abrir Flow</Link></Button> : <Button type="button" variant="secondary" disabled>Abrir Flow</Button>}
              </div>
            </div>
            <dl className="mt-6 grid gap-4 border-t border-lab-border pt-5 sm:grid-cols-3">
              <div><dt className="text-xs uppercase tracking-wide text-lab-text-muted">Objetivo</dt><dd className="mt-1 line-clamp-2 text-sm text-lab-text">{project.objective}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-lab-text-muted">Formato</dt><dd className="mt-1 text-sm text-lab-text">{formatProjectType(project.type)} · {project.aspectRatio}</dd></div>
              <div><dt className="text-xs uppercase tracking-wide text-lab-text-muted">Duração</dt><dd className="mt-1 font-mono text-sm text-lab-reagent-bright">{project.durationSeconds ? `${project.durationSeconds}s` : "Não definida"}</dd></div>
            </dl>
          </section>

          <ProjectAssetsPanel projectId={projectId} assets={assets} loading={assetsState === "loading"} error={assetsError ? "Não foi possível carregar Fontes e referências. Nenhum Asset foi simulado." : null} onUploaded={handleAssetUploaded} />
        </>
      ) : null}
    </main>
  );
}
