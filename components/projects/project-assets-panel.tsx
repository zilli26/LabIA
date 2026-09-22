"use client";

import Image from "next/image";
import { FileImage, FileVideo, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export type ProjectAsset = {
  assetId: string;
  type: "IMAGE" | "VIDEO" | "AUDIO" | string;
  origin?: "GENERATED" | "UPLOADED" | string;
  url?: string | null;
  contentType?: string | null;
  width?: number | null;
  height?: number | null;
  projectRole?: "source" | "reference" | "audio" | string | null;
  metadata?: {
    originalFileName?: string | null;
    projectRole?: "source" | "reference" | "audio" | string | null;
  } | null;
};

type ProjectAssetsPanelProps = {
  projectId: string;
  assets: ProjectAsset[];
  loading: boolean;
  error: string | null;
  onUploaded: (asset: ProjectAsset) => void;
};

type ImportIntentId = "image-base" | "reference" | "video-source";

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm";

const IMPORT_INTENTS: Array<{
  id: ImportIntentId;
  label: string;
  description: string;
  formatLabel: string;
  role: "source" | "reference";
  accept: string;
  uploadingLabel: string;
  successMessage: string;
  errorMessage: string;
}> = [
  {
    id: "image-base",
    label: "Imagem do produto / imagem-base",
    description: "Foto, criativo ou imagem do produto que será o primeiro frame do vídeo.",
    formatLabel: "JPG, PNG ou WebP",
    role: "source",
    accept: IMAGE_ACCEPT,
    uploadingLabel: "Enviando imagem-base…",
    successMessage: "Imagem do produto importada.",
    errorMessage: "Não foi possível importar a imagem do produto. Tente novamente.",
  },
  {
    id: "reference",
    label: "Character sheet / referência",
    description: "Character sheet, pessoa, estilo, produto ou imagem para orientar direção.",
    formatLabel: "JPG, PNG, WebP, MP4, MOV ou WebM",
    role: "reference",
    accept: `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`,
    uploadingLabel: "Enviando referência visual…",
    successMessage: "Character sheet / referência importada.",
    errorMessage: "Não foi possível importar a character sheet / referência. Tente novamente.",
  },
  {
    id: "video-source",
    label: "Vídeo de referência / produto",
    description: "Vídeo existente do produto, TikTok ou exemplo de movimento.",
    formatLabel: "MP4, MOV ou WebM",
    role: "source",
    accept: VIDEO_ACCEPT,
    uploadingLabel: "Enviando vídeo…",
    successMessage: "Vídeo de referência importado.",
    errorMessage: "Não foi possível importar o vídeo de referência. Tente novamente.",
  },
];

export function isProjectAsset(value: unknown): value is ProjectAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<ProjectAsset>;
  return typeof asset.assetId === "string" && typeof asset.type === "string" && typeof asset.url === "string";
}

function getAssetName(asset: ProjectAsset) {
  return asset.metadata?.originalFileName ?? `Asset ${asset.assetId}`;
}

function getAssetRole(asset: ProjectAsset) {
  const role = asset.projectRole ?? asset.metadata?.projectRole;
  if (role === "reference") return "Referência visual";
  if (role === "audio") return "Trilha ou voz";
  if (role === "source" && asset.type === "IMAGE") return "Imagem-base";
  return asset.type === "IMAGE" ? "Imagem" : asset.type === "VIDEO" ? "Vídeo" : "Áudio";
}

function getOriginLabel(origin: ProjectAsset["origin"]) {
  return origin === "GENERATED" ? "Gerado" : origin === "UPLOADED" ? "Importado" : "Origem não informada";
}

function AssetPreview({ asset }: { asset: ProjectAsset }) {
  if (!asset.url) {
    return <div className="flex h-36 items-center justify-center rounded-control border border-dashed border-lab-border bg-lab-surface-2 text-xs text-lab-text-muted">Preview indisponível</div>;
  }

  if (asset.type === "IMAGE") {
    return <Image src={asset.url} alt={getAssetName(asset)} width={320} height={180} unoptimized className="h-36 w-full rounded-control object-cover" />;
  }

  if (asset.type === "VIDEO") {
    return <video src={asset.url} controls preload="metadata" className="h-36 w-full rounded-control bg-lab-bg object-cover" aria-label={getAssetName(asset)} />;
  }

  return <div className="flex h-36 items-center justify-center rounded-control border border-dashed border-lab-border bg-lab-surface-2 text-xs text-lab-text-muted">Preview de áudio no Flow</div>;
}

export function ProjectAssetsPanel({ projectId, assets, loading, error, onUploaded }: ProjectAssetsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [intentId, setIntentId] = useState<ImportIntentId | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputId = `project-media-${projectId}`;
  const intent = IMPORT_INTENTS.find((candidate) => candidate.id === intentId) ?? null;

  function selectIntent(nextIntent: ImportIntentId) {
    if (uploading) return;
    setIntentId(nextIntent);
    setUploadSuccess(null);
    setUploadError(null);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || !intent) return;

    setUploading(true);
    setUploadSuccess(null);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("role", intent.role);

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/assets`, {
        method: "POST",
        body: formData,
      });
      const body: unknown = await response.json().catch(() => null);
      const asset = body && typeof body === "object" ? (body as { asset?: unknown }).asset : null;
      if (!response.ok || !isProjectAsset(asset)) throw new Error("upload_failed");

      onUploaded(asset);
      setUploadSuccess(intent.successMessage);
    } catch {
      setUploadError(intent.errorMessage);
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  return (
    <section aria-labelledby="project-assets-title" data-project-assets-panel className="rounded-lab border border-lab-border bg-lab-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-sky-300">Projeto · fontes</p>
          <h2 id="project-assets-title" className="mt-1 font-display text-xl font-semibold">Fontes e referências</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-lab-text-dim">É aqui que você coloca o material que já tem: character sheet, foto do produto, criativo ou vídeo do TikTok. Depois ele aparece no Flow. Importar não gera mídia.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3" role="group" aria-label="Intenção da mídia">
        {IMPORT_INTENTS.map((candidate) => {
      const selected = candidate.id === intentId;
          return (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={selected}
              disabled={uploading}
              onClick={() => selectIntent(candidate.id)}
              className={`min-h-11 rounded-control border p-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-lab-focus ${selected ? "border-lab-reagent/50 bg-lab-reagent-dim" : "border-lab-border bg-lab-surface-2 hover:border-lab-border-strong"}`}
            >
              <span className="block text-sm font-medium text-lab-text">{candidate.label}</span>
              <span className="mt-1 block text-xs leading-5 text-lab-text-muted">{candidate.description}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button className="min-h-11" type="button" onClick={() => inputRef.current?.click()} disabled={uploading || !intent} aria-controls={inputId} aria-describedby="project-assets-import-note">
          <Upload />
          {uploading ? intent?.uploadingLabel : "Importar mídia"}
        </Button>
        <p id="project-assets-import-note" className="text-xs text-lab-text-muted">
          {intent ? `${intent.label}: ${intent.formatLabel}.` : "Escolha primeiro o tipo de material que você vai importar."} Nenhuma geração é iniciada aqui.
        </p>
        <input ref={inputRef} id={inputId} type="file" accept={intent?.accept ?? ""} aria-label={intent ? `Selecionar ${intent.label.toLowerCase()}` : "Selecionar arquivo após escolher uma intenção"} className="sr-only" onChange={handleFileChange} />
      </div>
      {uploadSuccess ? <p role="status" className="mt-3 text-sm text-lab-success">{uploadSuccess}</p> : null}
      {uploadError ? <p role="alert" className="mt-3 text-sm text-red-200">{uploadError}</p> : null}

      <div className="mt-5" aria-live="polite" aria-busy={loading}>
        {loading ? <p className="rounded-control border border-dashed border-lab-border p-6 text-sm text-lab-text-dim">Carregando fontes e referências…</p> : null}
        {error ? <p role="alert" className="rounded-control border border-lab-danger/40 bg-lab-danger/10 p-4 text-sm text-red-200">{error}</p> : null}
        {!loading && !error && assets.length === 0 ? <p className="rounded-control border border-dashed border-lab-border p-6 text-sm text-lab-text-dim">Nenhuma fonte ou referência neste Projeto.</p> : null}
        {!loading && !error && assets.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assets.map((asset) => (
              <article key={asset.assetId} className="overflow-hidden rounded-control border border-lab-border bg-lab-surface-2">
                <AssetPreview asset={asset} />
                <div className="space-y-2 p-3">
                  <div className="flex items-start gap-2">
                    {asset.type === "VIDEO" ? <FileVideo className="mt-0.5 size-4 shrink-0 text-sky-300" /> : <FileImage className="mt-0.5 size-4 shrink-0 text-sky-300" />}
                    <p className="min-w-0 truncate text-sm font-medium" title={getAssetName(asset)}>{getAssetName(asset)}</p>
                  </div>
                  <p className="text-xs text-lab-text-muted">{getAssetRole(asset)} · {getOriginLabel(asset.origin)}</p>
                  {asset.width && asset.height ? <p className="font-mono text-[11px] text-lab-text-muted">{asset.width} × {asset.height}px</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
