"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clapperboard,
  FileImage,
  ImagePlus,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FAL_IMAGE_MODELS } from "@/lib/providers/fal-models";
import type { FlowGraph } from "@/lib/flows/graph";

type Mode = "Rascunho barato" | "Equilibrado" | "Melhor qualidade" | "Avançado";
type ImageOption = { id: string; name: string };
type ConnectionImageOptions = { id: string; label: string; planType: string | null; models: ImageOption[] };
type CostPayload = { total: { usd: number; brl: number; billingMode: "api" | "subscription" | "local" } };

const modes: Array<{ name: Mode; description: string }> = [
  { name: "Rascunho barato", description: "Teste a direção antes de expandir." },
  { name: "Equilibrado", description: "Qualidade e custo previsíveis." },
  { name: "Melhor qualidade", description: "Para a peça que será aprovada." },
  { name: "Avançado", description: "Escolhas detalhadas quando disponíveis." },
];
const steps = ["TESTAR", "APROVAR", "TRAVAR REFERÊNCIAS", "EXPANDIR", "FINALIZAR"];
const videoOptions = [["Vídeo curto", "Clipes e montagem guiada."], ["Vídeo 30s+", "Cenas aprovadas e montagem."]];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload && typeof payload === "object" ? (payload as { error?: unknown }).error : undefined;
    const message = error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : typeof error === "string" ? error : `Falha HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

function guidedGraph({ intent, format, mode, providerId, connectionId, modelId }: {
  intent: string; format: string; mode: Mode; providerId: string; connectionId: string; modelId: string;
}): FlowGraph {
  const imageParams = { prompt: intent, format, mode, providerId, model: modelId, ...(connectionId ? { connectionId } : {}) };
  return {
    nodes: [
      { id: "guided-prompt", type: "labNode", position: { x: 96, y: 120 }, data: { kind: "prompt", title: "Prompt", description: "Direção da peça.", status: "idle", params: { prompt: intent } } },
      { id: "guided-image", type: "labNode", position: { x: 448, y: 120 }, data: { kind: "image-generation", title: "Gerar Imagem", description: "Geração de imagem com provider selecionado.", status: "idle", params: imageParams } },
    ],
    edges: [{ id: "guided-prompt-to-image", source: "guided-prompt", target: "guided-image", type: "smoothstep" }],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function CreateWorkspace() {
  const [intent, setIntent] = useState("");
  const [format, setFormat] = useState("Post quadrado");
  const [mode, setMode] = useState<Mode>("Equilibrado");
  const [providerId, setProviderId] = useState("fal");
  const [connectionId, setConnectionId] = useState("");
  const [modelId, setModelId] = useState("fal-ai/flux/dev");
  const [openAiConnections, setOpenAiConnections] = useState<ConnectionImageOptions[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isReviewed, setIsReviewed] = useState(false);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [confirmationToken, setConfirmationToken] = useState<string | null>(null);
  const [cost, setCost] = useState<CostPayload | null>(null);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enqueueInFlight = useRef(false);

  async function loadOpenAiOptions() {
    setOptionsLoading(true);
    setError(null);
    try {
      await requestJson<unknown>("/api/provider-connections/session", { method: "POST", body: "{}" });
      const payload = await requestJson<{ connections: ConnectionImageOptions[] }>("/api/provider-connections/image-options");
      setOpenAiConnections(payload.connections);
      setConnectionId((current) => payload.connections.some((connection) => connection.id === current) ? current : "");
      setModelId((current) => payload.connections.flatMap((connection) => connection.models).some((model) => model.id === current) ? current : "");
    } catch (loadError) {
      setOpenAiConnections([]);
      setConnectionId("");
      setModelId("");
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as conexões OpenAI.");
    } finally {
      setOptionsLoading(false);
    }
  }

  useEffect(() => {
    if (providerId === "openai") void loadOpenAiOptions();
  }, [providerId]);

  const selectedConnection = openAiConnections.find((connection) => connection.id === connectionId);
  const availableModels = providerId === "openai" ? selectedConnection?.models ?? [] : FAL_IMAGE_MODELS;

  function resetReview() {
    setIsReviewed(false);
    setFlowId(null);
    setConfirmationToken(null);
    setCost(null);
    setRunStatus(null);
  }

  async function reviewRecipe() {
    setError(null);
    resetReview();
    if (!intent.trim()) return setError("Descreva a intenção antes de revisar a receita.");
    if (providerId === "openai" && (!connectionId || !modelId)) return setError("Selecione uma conexão OpenAI e um modelo de imagem aprovado.");
    setIsReviewing(true);
    try {
      const created = await requestJson<{ flow: { id: string } }>("/api/flows", { method: "POST", body: "{}" });
      const nextFlowId = created.flow.id;
      await requestJson(`/api/flows/${encodeURIComponent(nextFlowId)}`, {
        method: "PUT",
        body: JSON.stringify({ name: "Receita guiada", graph: guidedGraph({ intent, format, mode, providerId, connectionId, modelId }) }),
      });
      const quoted = await requestJson<{ cost: CostPayload; confirmation: { token: string } }>(`/api/flows/${encodeURIComponent(nextFlowId)}/cost`, {
        method: "POST",
        body: JSON.stringify({ targetNodeId: "guided-image" }),
      });
      setFlowId(nextFlowId);
      setConfirmationToken(quoted.confirmation.token);
      setCost(quoted.cost);
      setIsReviewed(true);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Não foi possível confirmar esta receita.");
    } finally {
      setIsReviewing(false);
    }
  }

  async function startGeneration() {
    if (!flowId || !confirmationToken || enqueueInFlight.current || isEnqueuing || runStatus !== null) return;
    setError(null);
    enqueueInFlight.current = true;
    setIsEnqueuing(true);
    try {
      const result = await requestJson<{ flowRun: { status: string } }>(`/api/flows/${encodeURIComponent(flowId)}/runs`, {
        method: "POST",
        body: JSON.stringify({ targetNodeId: "guided-image", confirmationToken }),
      });
      setRunStatus(result.flowRun.status);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Não foi possível enfileirar a execução.");
    } finally {
      enqueueInFlight.current = false;
      setIsEnqueuing(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 py-5 lg:px-6 lg:py-7">
      <header className="border-b border-lab-border pb-5"><p className="font-mono text-xs uppercase tracking-wide text-lab-text-muted">Nova receita</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">O que você quer criar?</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-lab-text-dim">Comece pela direção. O LabIA organiza o experimento antes de qualquer custo ou execução.</p></header>
      <div className="grid min-h-[560px] gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className="rounded-lab border border-lab-border bg-lab-surface-1 p-3 lg:sticky lg:top-20 lg:h-fit"><div className="border-b border-lab-border px-2 pb-3"><p className="font-mono text-[11px] uppercase text-lab-text-muted">1. Tipo de criação</p></div><div className="mt-3 space-y-2" role="radiogroup" aria-label="Tipo de criação"><button type="button" role="radio" aria-checked="true" className="flex w-full items-center gap-3 rounded-control border border-lab-reagent/50 bg-lab-reagent-dim p-3 text-left"><span className="flex size-9 items-center justify-center rounded-control border border-lab-border bg-lab-surface-1 text-[var(--lab-node-image)]"><FileImage className="size-4" /></span><span><span className="block text-sm font-medium text-lab-text">Imagem</span><span className="mt-0.5 block text-xs text-lab-text-dim">Direção e candidatos visuais.</span></span></button>{videoOptions.map(([label, description]) => <button key={label} type="button" role="radio" aria-checked="false" disabled aria-disabled="true" className="flex w-full items-center gap-3 rounded-control border border-lab-border bg-lab-surface-2 p-3 text-left opacity-65"><span className="flex size-9 items-center justify-center rounded-control border border-lab-border bg-lab-surface-1 text-[var(--lab-node-video)]"><Clapperboard className="size-4" /></span><span className="min-w-0"><span className="flex items-center gap-2 text-sm font-medium text-lab-text">{label}<Badge className="px-1.5 py-0 text-[10px]">Em preparação</Badge></span><span className="mt-0.5 block text-xs text-lab-text-dim">{description}</span></span></button>)}</div><div className="mt-4 rounded-control border border-lab-border bg-lab-surface-2 p-3"><p className="font-mono text-[10px] uppercase text-lab-text-muted">Custo da receita</p><p className="mt-1 font-mono text-lg font-semibold text-lab-reagent-bright" data-id="create-cost">{cost?.total.billingMode === "subscription" ? "Cota indisponível" : cost ? `R$ ${cost.total.brl.toFixed(2)}` : "A calcular"}</p><p className="mt-1 text-xs leading-5 text-lab-text-dim">A cotação será exibida antes de liberar a execução.</p></div></aside>
        <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]"><div className="space-y-5"><section className="rounded-lab border border-lab-border bg-lab-surface-1 p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[11px] uppercase text-lab-text-muted">2. Direção</p><h2 className="mt-1 font-display text-xl font-semibold">Comece pela intenção</h2></div><Sparkles className="size-5 text-lab-reagent-bright" /></div><label className="mt-5 block"><span className="mb-2 block text-sm font-medium">O que esta peça precisa comunicar?</span><textarea aria-label="Intenção da criação" value={intent} onChange={(event) => { setIntent(event.target.value); resetReview(); }} placeholder="Ex.: apresentar o produto em uma cena editorial, com foco no detalhe principal." className="min-h-28 w-full resize-y rounded-control border border-lab-border bg-lab-surface-2 px-3 py-2 text-sm leading-6 text-lab-text outline-none" /></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-medium">Formato</span><select aria-label="Formato" value={format} onChange={(event) => { setFormat(event.target.value); resetReview(); }} className="h-10 w-full rounded-control border border-lab-border bg-lab-surface-2 px-3 text-sm"><option>Post quadrado</option><option>Story vertical</option><option>Paisagem</option></select></label><div><span className="mb-2 block text-sm font-medium">Referências</span><div className="flex h-10 items-center gap-2 rounded-control border border-dashed border-lab-border bg-lab-surface-2 px-3 text-xs text-lab-text-muted"><ImagePlus className="size-4" />Disponível no próximo incremento</div></div></div></section>
          <section className="rounded-lab border border-lab-border bg-lab-surface-1 p-5"><p className="font-mono text-[11px] uppercase text-lab-text-muted">3. Caminho de produção</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{modes.map((item) => <button key={item.name} type="button" aria-pressed={mode === item.name} onClick={() => { setMode(item.name); resetReview(); }} className={cn("rounded-control border p-3 text-left", mode === item.name ? "border-lab-reagent/50 bg-lab-reagent-dim" : "border-lab-border bg-lab-surface-2")}><span className="block text-sm font-medium">{item.name}</span><span className="mt-1 block text-xs leading-5 text-lab-text-dim">{item.description}</span></button>)}</div></section>
          <section className="rounded-lab border border-lab-border bg-lab-surface-1 p-5"><p className="font-mono text-[11px] uppercase text-lab-text-muted">3. Provider, conexão e modelo</p><div className="mt-4 grid gap-4 sm:grid-cols-3"><label><span className="mb-2 block text-sm font-medium">Provider</span><select aria-label="Provider da receita" value={providerId} onChange={(event) => { const next = event.target.value; setProviderId(next); setConnectionId(""); setModelId(next === "fal" ? "fal-ai/flux/dev" : ""); resetReview(); }} className="h-10 w-full rounded-control border border-lab-border bg-lab-surface-2 px-3 text-sm"><option value="fal">fal.ai</option><option value="openai">OpenAI / ChatGPT</option></select></label><label><span className="mb-2 block text-sm font-medium">Conexão</span><select aria-label="Conexão da receita" value={connectionId} disabled={providerId === "openai" && optionsLoading} onChange={(event) => { const next = event.target.value; setConnectionId(next); const selected = openAiConnections.find((connection) => connection.id === next); setModelId(providerId === "openai" ? selected?.models[0]?.id ?? "" : "fal-ai/flux/dev"); resetReview(); }} className="h-10 w-full rounded-control border border-lab-border bg-lab-surface-2 px-3 font-mono text-xs"><option value="">{providerId === "fal" ? "Compatibilidade fal.ai (legada)" : optionsLoading ? "Carregando conexões..." : "Selecione uma conexão"}</option>{providerId === "openai" ? openAiConnections.map((connection) => <option key={connection.id} value={connection.id}>{connection.label}</option>) : null}</select></label><label><span className="mb-2 block text-sm font-medium">Modelo</span><select aria-label="Modelo da receita" value={modelId} disabled={providerId === "openai" && (!connectionId || optionsLoading)} onChange={(event) => { setModelId(event.target.value); resetReview(); }} className="h-10 w-full rounded-control border border-lab-border bg-lab-surface-2 px-3 font-mono text-xs"><option value="">{providerId === "openai" ? "Selecione um modelo aprovado" : "Selecione um modelo"}</option>{availableModels.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label></div>{providerId === "openai" && !optionsLoading && openAiConnections.length === 0 ? <p className="mt-3 rounded-control border border-lab-warning/40 bg-lab-surface-2 px-3 py-2 text-xs text-lab-warning">Nenhuma conexão OpenAI conectada e disponível neste owner/workspace.</p> : null}{providerId === "openai" && selectedConnection && availableModels.length === 0 ? <p className="mt-3 rounded-control border border-lab-warning/40 bg-lab-surface-2 px-3 py-2 text-xs text-lab-warning">Nenhum modelo de imagem aprovado pelo executor e pelos gates O3.</p> : null}</section>
          {!isReviewed ? <div className="flex flex-wrap items-center gap-3"><Button type="button" onClick={() => void reviewRecipe()} disabled={isReviewing} data-id="review-recipe">{isReviewing ? "Revisando..." : "Revisar receita"}<ChevronRight /></Button><Button type="button" variant="secondary" disabled title="Um Flow será criado após a confirmação."><LockKeyhole />Editar no canvas</Button></div> : null}
          {isReviewed ? <p className="flex items-center gap-1.5 text-sm text-lab-success"><CheckCircle2 className="size-4" />Receita confirmada pelo servidor.</p> : null}{error ? <p role="alert" className="rounded-control border border-lab-danger/40 bg-lab-surface-2 px-3 py-2 text-sm text-lab-danger">{error}</p> : null}
        </div><aside className="rounded-lab border border-lab-border bg-lab-surface-1 p-5 xl:sticky xl:top-20 xl:h-fit"><p className="font-mono text-[11px] uppercase tracking-wide text-lab-text-muted">Receita guiada</p><h2 className="mt-1 font-display text-xl font-semibold">Imagem · {format}</h2><div className="mt-5 space-y-3">{steps.map((step, index) => <div key={step} className="flex gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-lab-border bg-lab-surface-2 font-mono text-[11px] text-lab-reagent-bright">{index + 1}</span><div className="min-w-0 pb-3"><p className="text-sm font-medium">{step}</p><p className="mt-1 text-xs leading-5 text-lab-text-dim">{index === 0 ? `${mode}: gerar poucos candidatos para validar a direção.` : index === 1 ? "Escolher com critério humano antes de avançar." : index === 2 ? "Referências serão travadas quando esse recurso existir." : index === 3 ? "Criar variações apenas depois da aprovação." : "Preservar o resultado e a evidência da decisão."}</p></div></div>)}</div><div className="mt-2 overflow-hidden rounded-control border border-dashed border-lab-border bg-lab-surface-2"><div className="flex aspect-[4/3] items-center justify-center"><CircleDashed className="size-8 text-lab-text-muted" /></div><div className="border-t border-lab-border px-3 py-2 text-xs text-lab-text-dim">Preview aparecerá após uma geração aprovada.</div></div>{isReviewed ? <><Button className="mt-4 w-full" onClick={() => void startGeneration()} disabled={!confirmationToken || isEnqueuing || runStatus !== null} data-id="generate-one-image">{isEnqueuing ? "Enfileirando..." : "Gerar 1 imagem"}</Button>{cost?.total.billingMode === "subscription" ? <p className="mt-2 text-xs text-lab-text-dim">Assinatura ChatGPT selecionada; cota indisponível para estimativa.</p> : null}{runStatus ? <p className="mt-3 text-sm" role="status">Execução: {runStatus}. O resultado será exibido na <a className="underline" href="/biblioteca">Biblioteca</a>.</p> : null}</> : <Button className="mt-4 w-full" disabled data-id="generate-disabled">Gerar bloqueado · revise a receita</Button>}</aside></section>
      </div>
    </main>
  );
}
