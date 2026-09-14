"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectOnboarding() {
  const router = useRouter();
  const [type, setType] = useState<"IMAGE" | "VIDEO">("VIDEO");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get("name"),
      type: form.get("type"),
      objective: form.get("objective"),
      aspectRatio: form.get("aspectRatio"),
      durationSeconds: type === "VIDEO" ? Number(form.get("durationSeconds")) : null,
    };

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?: string; project?: { primaryFlow?: { id?: string } } };
      if (!response.ok || !result.project?.primaryFlow?.id) {
        setError(result.error ?? "Não foi possível criar o Projeto.");
        return;
      }
      router.push(`/fluxos/${result.project.primaryFlow.id}`);
    } catch {
      setError("Não foi possível conectar ao control-plane local.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-control border border-lab-border bg-lab-surface-1 p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Novo Projeto</h2>
        <p className="mt-1 text-sm text-lab-text-dim">Defina a peça e abra um Flow principal. Nenhuma mídia é gerada nesta etapa.</p>
      </div>
      <label className="block text-sm text-lab-text-dim">
        Nome
        <input required name="name" className="mt-1 h-10 w-full rounded-control border border-lab-border bg-lab-surface-2 px-3 text-lab-text outline-none focus:border-lab-reagent" />
      </label>
      <label className="block text-sm text-lab-text-dim">
        Tipo
        <select name="type" value={type} onChange={(event) => setType(event.target.value as "IMAGE" | "VIDEO")} className="mt-1 h-10 w-full rounded-control border border-lab-border bg-lab-surface-2 px-3 text-lab-text">
          <option value="VIDEO">Vídeo</option>
          <option value="IMAGE">Imagem</option>
        </select>
      </label>
      <label className="block text-sm text-lab-text-dim">
        Objetivo
        <textarea required name="objective" rows={3} className="mt-1 w-full rounded-control border border-lab-border bg-lab-surface-2 px-3 py-2 text-lab-text outline-none focus:border-lab-reagent" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-lab-text-dim">
          Proporção
          <select name="aspectRatio" defaultValue="9:16" className="mt-1 h-10 w-full rounded-control border border-lab-border bg-lab-surface-2 px-3 text-lab-text">
            <option value="9:16">9:16 vertical</option>
            <option value="1:1">1:1 quadrado</option>
            <option value="16:9">16:9 horizontal</option>
          </select>
        </label>
        {type === "VIDEO" ? (
          <label className="block text-sm text-lab-text-dim">
            Duração (segundos)
            <input required min={1} max={3600} type="number" name="durationSeconds" defaultValue={5} className="mt-1 h-10 w-full rounded-control border border-lab-border bg-lab-surface-2 px-3 text-lab-text" />
          </label>
        ) : null}
      </div>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      <button type="submit" disabled={saving} className="h-10 rounded-control bg-lab-reagent px-4 text-sm font-semibold text-lab-bg disabled:opacity-60">
        {saving ? "Criando…" : "Criar Projeto e abrir Flow"}
      </button>
    </form>
  );
}
