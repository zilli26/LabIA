import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ProjectOnboarding } from "@/components/projects/project-onboarding";
import { getOwnedExecutionScope } from "@/lib/flows/ownership";
import { listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

const typeLabel = { IMAGE: "Imagem", VIDEO: "Vídeo" } as const;
const statusLabel = { DRAFT: "Rascunho", IN_PROGRESS: "Em andamento", REVIEW: "Em revisão", APPROVED: "Aprovado", ARCHIVED: "Arquivado" } as const;

export default async function ProjectsPage() {
  const projects = await getOwnedExecutionScope().then(listProjects).catch(() => []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8">
      <section className="border-b border-lab-border pb-6">
        <p className="font-mono text-xs uppercase text-lab-text-muted">Projetos</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Peças que você quer aprovar</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-lab-text-dim">Cada Projeto agrupa objetivo, Flow, tentativas e Assets. Criar aqui apenas prepara o trabalho; geração exige uma ação posterior.</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ProjectOnboarding />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Projetos recentes</h2>
            <Badge variant="default">{projects.length}</Badge>
          </div>
          {projects.length > 0 ? projects.map((project) => (
            <Link key={project.id} href={`/projetos/${project.id}`} aria-label={`Abrir Projeto ${project.name}`} className="group block rounded-control border border-lab-border bg-lab-surface-1 p-4 transition-colors hover:border-lab-border-strong hover:bg-lab-surface-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-control border border-lab-border bg-lab-surface-2 text-lab-reagent-bright"><FolderKanban className="size-5" /></div>
                  <div className="min-w-0">
                    <h3 className="truncate font-display font-semibold">{project.name}</h3>
                    <p className="mt-1 text-xs text-lab-text-muted">{typeLabel[project.type as keyof typeof typeLabel]} · {project.aspectRatio}{project.durationSeconds ? ` · ${project.durationSeconds}s` : ""}</p>
                  </div>
                </div>
                <Badge variant="default">{statusLabel[project.status as keyof typeof statusLabel]}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-lab-text-dim">{project.objective}</p>
              <span className="mt-4 inline-flex text-sm font-medium text-lab-reagent-bright group-hover:underline">Abrir Projeto →</span>
            </Link>
          )) : <div className="rounded-control border border-dashed border-lab-border bg-lab-surface-1 p-8 text-center text-sm text-lab-text-dim">Nenhum Projeto ainda. Comece pelo onboarding ao lado.</div>}
        </div>
      </section>
    </main>
  );
}
