import { ExternalLink, Link2, RefreshCw, Unplug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ProviderConnectionView,
  ProviderLoginPrompt,
} from "@/lib/providers/provider-connection-types";

const accountLabels: Record<ProviderConnectionView["connectionState"], string> = {
  disconnected: "Não conectada",
  connecting: "Conectando",
  connected: "Conectada",
  expired: "Expirada",
  error: "Erro",
};

const capabilityLabels: Record<ProviderConnectionView["capabilityState"], string> = {
  unverified: "Não verificada",
  verified: "Verificada",
  unavailable: "Indisponível",
  error: "Erro",
};

type OpenAIConnectionCardProps = {
  connection: ProviderConnectionView | null;
  loginPrompt: ProviderLoginPrompt | null;
  busy?: boolean;
  errorMessage?: string | null;
  onStartDeviceLogin?: () => void;
  onStartBrowserLogin?: () => void;
  onCancel?: () => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
};

export function OpenAIConnectionCard({
  connection,
  loginPrompt,
  busy = false,
  errorMessage,
  onStartDeviceLogin,
  onStartBrowserLogin,
  onCancel,
  onDisconnect,
  onReconnect,
}: OpenAIConnectionCardProps) {
  const state = connection?.connectionState ?? "disconnected";
  const capability = connection?.capabilityState ?? "unverified";

  return (
    <section
      className="rounded-node border border-lab-border bg-lab-surface-1 p-5"
      data-testid="openai-connection-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold text-lab-text">
              OpenAI / ChatGPT
            </h2>
            <Badge>local</Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-lab-text-dim">
            OAuth gerenciado pelo Codex App Server em uma sessão dedicada do
            LabIA. Não usa chave da API pública OpenAI.
          </p>
        </div>
        <div className="font-mono text-xs text-lab-text-muted">
          executor: {connection?.executorState ?? "stopped"}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <StatusBlock
          label="Conta ChatGPT"
          value={accountLabels[state]}
          detail={connection?.accountLabel ?? "Login separado do Codex atual"}
          testId="account-status"
        />
        <StatusBlock
          label="Capacidade de imagem"
          value={capabilityLabels[capability]}
          detail="Login não comprova acesso de imagem"
          testId="image-capability-status"
        />
        <StatusBlock
          label="Geração real"
          value={connection?.generationValidated ? "Validada" : "Não validada"}
          detail="O1 não executa geração"
          testId="generation-validation-status"
        />
      </div>

      {loginPrompt ? (
        <div className="mt-4 rounded-control border border-lab-border bg-lab-surface-2 p-4">
          {loginPrompt.type === "chatgptDeviceCode" ? (
            <>
              <p className="text-sm text-lab-text-dim">
                Abra o endereço e informe o código abaixo.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <a
                  className="inline-flex items-center gap-2 text-sm text-lab-info hover:underline"
                  href={loginPrompt.verificationUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir login <ExternalLink className="size-3.5" />
                </a>
                <code
                  className="rounded-control border border-lab-border px-3 py-2 font-mono text-base text-lab-text"
                  data-testid="device-code"
                >
                  {loginPrompt.userCode}
                </code>
              </div>
            </>
          ) : (
            <a
              className="inline-flex items-center gap-2 text-sm text-lab-info hover:underline"
              href={loginPrompt.authUrl}
              rel="noreferrer"
              target="_blank"
            >
              Continuar login no navegador <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 text-sm text-lab-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {state === "connecting" ? (
          <Button disabled={busy} onClick={onCancel} variant="secondary">
            Cancelar login
          </Button>
        ) : null}

        {state === "connected" ? (
          <Button disabled={busy} onClick={onDisconnect} variant="danger">
            <Unplug /> Desconectar
          </Button>
        ) : null}

        {state === "expired" || state === "error" ? (
          <Button disabled={busy} onClick={onReconnect} variant="secondary">
            <RefreshCw /> Reconectar
          </Button>
        ) : null}

        {state === "disconnected" ? (
          <>
            <Button disabled={busy} onClick={onStartDeviceLogin}>
              <Link2 /> Conectar ChatGPT
            </Button>
            <Button
              disabled={busy}
              onClick={onStartBrowserLogin}
              variant="secondary"
            >
              Login no navegador
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}

function StatusBlock({
  label,
  value,
  detail,
  testId,
}: {
  label: string;
  value: string;
  detail: string;
  testId: string;
}) {
  return (
    <div className="rounded-control border border-lab-border bg-lab-surface-2 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-lab-text-muted">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-lab-text" data-testid={testId}>
        {value}
      </div>
      <div className="mt-1 text-xs text-lab-text-dim">{detail}</div>
    </div>
  );
}
