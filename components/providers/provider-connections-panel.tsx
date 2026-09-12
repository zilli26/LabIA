"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleOff, ExternalLink, LoaderCircle, LockKeyhole, Plug, RefreshCw, Unplug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LoginInstruction, ProviderConnectionDto, ProviderConnectionStatus } from "@/lib/provider-connections/types";

type ApiError = { error?: { code?: string; message?: string } };
type LoginState = Record<string, LoginInstruction | undefined>;

const accountLabels: Record<ProviderConnectionStatus, string> = {
  disconnected: "Desconectada",
  connecting: "Aguardando login",
  connected: "Conectada",
  expired: "Login expirado",
  error: "Erro de conexão",
};

async function api<T>(url: string, localToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      "content-type": "application/json",
      "x-labia-local-token": localToken,
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);
  return payload;
}

export type ProviderConnectionsPanelState = {
  connections: ProviderConnectionDto[];
  loginState: LoginState;
  accessToken: string;
  tokenInput: string;
  loading: boolean;
  busyId: string | null;
  error: string | null;
};

export type ProviderConnectionsApi = <T>(url: string, localToken: string, init?: RequestInit) => Promise<T>;

export function createProviderConnectionsController(request: ProviderConnectionsApi = api) {
  let state: ProviderConnectionsPanelState = {
    connections: [],
    loginState: {},
    accessToken: "",
    tokenInput: "",
    loading: false,
    busyId: null,
    error: null,
  };
  const listeners = new Set<(next: ProviderConnectionsPanelState) => void>();
  const emit = (patch: Partial<ProviderConnectionsPanelState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  };
  const controller = {
    getState: () => state,
    subscribe(listener: (next: ProviderConnectionsPanelState) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async load(token = state.accessToken) {
      if (!token) return;
      emit({ loading: true });
      try {
        const result = await request<{ connections: ProviderConnectionDto[] }>("/api/provider-connections", token);
        emit({ connections: result.connections, error: null });
      } catch (err) {
        emit({ error: err instanceof Error ? err.message : "Falha ao carregar conexões." });
      } finally {
        emit({ loading: false });
      }
    },
    async unlock(tokenInput: string) {
      const token = tokenInput.trim();
      if (!token) {
        emit({ error: "Informe LABIA_LOCAL_CONNECTIONS_TOKEN." });
        return;
      }
      emit({ accessToken: token, tokenInput: "", error: null });
      await controller.load(token);
    },
    lock() {
      emit({ accessToken: "", tokenInput: "", connections: [], loginState: {}, error: null });
    },
    async refreshStatuses() {
      const token = state.accessToken;
      if (!token || state.connections.length === 0) return;
      const snapshot = state.connections;
      const refreshed = await Promise.all(snapshot.map(async (connection) => {
        try {
          const result = await request<{ connection: ProviderConnectionDto }>(`/api/provider-connections/${connection.id}/status`, token);
          return result.connection;
        } catch {
          return null;
        }
      }));
      const successful = refreshed.filter((item): item is ProviderConnectionDto => item !== null);
      if (successful.length > 0) {
        const byId = new Map(successful.map((item) => [item.id, item]));
        emit({ connections: state.connections.map((item) => byId.get(item.id) ?? item) });
      }
      if (successful.length !== snapshot.length) await controller.load(token);
    },
    async createConnection() {
      emit({ busyId: "create" });
      try {
        const result = await request<{ connection: ProviderConnectionDto }>("/api/provider-connections", state.accessToken, { method: "POST", body: "{}" });
        emit({ connections: state.connections.some((item) => item.id === result.connection.id)
          ? state.connections.map((item) => item.id === result.connection.id ? result.connection : item)
          : [...state.connections, result.connection], error: null });
      } catch (err) {
        emit({ error: err instanceof Error ? err.message : "Falha ao criar conexão." });
      } finally {
        emit({ busyId: null });
      }
    },
    async startLogin(connection: ProviderConnectionDto, method: "chatgpt" | "chatgptDeviceCode") {
      emit({ busyId: connection.id });
      try {
        const result = await request<{ connection: ProviderConnectionDto; instruction: LoginInstruction }>(`/api/provider-connections/${connection.id}/login`, state.accessToken, { method: "POST", body: JSON.stringify({ method }) });
        emit({ connections: state.connections.map((item) => item.id === connection.id ? result.connection : item), loginState: { ...state.loginState, [connection.id]: result.instruction }, error: null });
      } catch (err) {
        emit({ error: err instanceof Error ? err.message : "Não foi possível iniciar o login." });
      } finally {
        emit({ busyId: null });
      }
    },
    async connectionAction(connection: ProviderConnectionDto, action: "cancel" | "disconnect") {
      emit({ busyId: connection.id });
      try {
        const result = await request<{ connection: ProviderConnectionDto }>(`/api/provider-connections/${connection.id}/${action}`, state.accessToken, { method: "POST", body: "{}" });
        emit({ connections: state.connections.map((item) => item.id === connection.id ? result.connection : item), loginState: { ...state.loginState, [connection.id]: undefined }, error: null });
      } catch (err) {
        emit({ error: err instanceof Error ? err.message : "Operação não concluída." });
      } finally {
        emit({ busyId: null });
      }
    },
  };
  return controller;
}

export function ConnectionStateSummary({ connection }: { connection: ProviderConnectionDto }) {
  const imageCapability = connection.capabilities.find((item) => item.key === "image_generation");
  const connected = connection.authStatus === "connected";
  return (
    <div className="grid gap-2 text-sm" data-id="connection-state-summary">
      <StateRow dataId="account-connection-state" label="Conta ChatGPT" value={accountLabels[connection.authStatus]} state={connected ? "ok" : connection.authStatus === "error" ? "error" : "neutral"} />
      <StateRow dataId="image-capability-state" label="Capacidade de imagem" value={imageCapability?.status === "available" ? "Disponível e verificada" : "Não verificada"} state={imageCapability?.status === "available" ? "ok" : "neutral"} />
      <StateRow dataId="real-generation-state" label="Geração real" value={connection.generationValidationStatus === "validated" ? "Validada" : "Não validada"} state={connection.generationValidationStatus === "validated" ? "ok" : "neutral"} />
    </div>
  );
}

function StateRow({ dataId, label, value, state }: { dataId: string; label: string; value: string; state: "ok" | "error" | "neutral" }) {
  return (
    <div data-id={dataId} data-state={state} className="flex items-center justify-between gap-4 rounded-control border border-lab-border bg-lab-bg/40 px-3 py-2">
      <span className="text-lab-text-dim">{label}</span>
      <span className="flex items-center gap-1.5 font-medium text-lab-text">
        {state === "ok" ? <CheckCircle2 className="size-3.5 text-lab-success" /> : null}{value}
      </span>
    </div>
  );
}

export function ProviderConnectionsPanel({ request = api }: { request?: ProviderConnectionsApi } = {}) {
  const controller = useMemo(() => createProviderConnectionsController(request), [request]);
  const [state, setState] = useState(controller.getState());
  const { connections, loginState, accessToken, tokenInput, loading, busyId, error } = state;

  useEffect(() => controller.subscribe(setState), [controller]);
  useEffect(() => {
    if (!accessToken || connections.length === 0) return;
    const timer = window.setInterval(() => { void controller.refreshStatuses(); }, 2_000);
    return () => window.clearInterval(timer);
  }, [accessToken, connections.length, controller]);

  function setTokenInput(value: string) {
    setState((current) => ({ ...current, tokenInput: value }));
  }

  function unlockLocalConnections() { void controller.unlock(tokenInput); }
  function lockLocalConnections() { controller.lock(); }
  function createConnection() { void controller.createConnection(); }
  function startLogin(connection: ProviderConnectionDto, method: "chatgpt" | "chatgptDeviceCode") { void controller.startLogin(connection, method); }
  function connectionAction(connection: ProviderConnectionDto, action: "cancel" | "disconnect") { void controller.connectionAction(connection, action); }

  if (!accessToken) {
    return (
      <section className="max-w-xl rounded-node border border-lab-border bg-lab-surface-1 p-5" data-id="provider-connections-lock">
        <div className="flex items-center gap-2"><LockKeyhole className="size-4 text-lab-text-dim" /><h2 className="font-display text-lg font-semibold">Acesso local protegido</h2></div>
        <p className="mt-2 text-sm text-lab-text-dim">Informe o token local configurado em <span className="font-mono text-lab-text">LABIA_LOCAL_CONNECTIONS_TOKEN</span>. Ele fica apenas na memória desta página e não é salvo pelo navegador.</p>
        <div className="mt-4 flex gap-2">
          <Input data-id="local-connections-token" type="password" autoComplete="off" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") unlockLocalConnections(); }} placeholder="Token local" />
          <Button data-id="local-connections-unlock" onClick={unlockLocalConnections}>Desbloquear</Button>
        </div>
        {error ? <div className="mt-3 text-sm text-lab-danger" role="alert">{error}</div> : null}
      </section>
    );
  }

  if (loading) return <div className="flex items-center gap-2 text-sm text-lab-text-dim" data-id="connections-loading"><LoaderCircle className="size-4 animate-spin" /> Carregando conexões locais…</div>;

  return (
    <section className="space-y-4" data-id="provider-connections-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-semibold">Conexões de provider</h2><p className="mt-1 max-w-2xl text-sm text-lab-text-dim">Autenticação é separada de capacidade e de geração real. Conectar uma conta não libera nenhum nó gerativo.</p></div>
        <div className="flex gap-2"><Button variant="ghost" onClick={lockLocalConnections}><LockKeyhole /> Bloquear</Button><Button variant="ghost" onClick={() => void controller.refreshStatuses()} disabled={busyId !== null}><RefreshCw /> Atualizar estado</Button><Button onClick={createConnection} disabled={busyId !== null}><Plug /> Adicionar ChatGPT</Button></div>
      </div>
      {error ? <div className="rounded-node border border-lab-danger/50 bg-lab-surface-1 p-3 text-sm text-lab-danger" role="alert">{error}</div> : null}
      {connections.length === 0 ? <div className="rounded-node border border-dashed border-lab-border bg-lab-surface-1 p-6 text-sm text-lab-text-dim">Nenhuma conexão criada neste workspace local.</div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {connections.map((connection) => {
          const instruction = loginState[connection.id];
          const busy = busyId === connection.id;
          return (
            <article key={connection.id} data-id="provider-connection-card" data-provider={connection.provider} className="rounded-node border border-lab-border bg-lab-surface-1 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><h3 className="font-display font-semibold">{connection.label}</h3><Badge>{connection.provider}</Badge></div><p className="mt-1 text-xs text-lab-text-muted">{connection.accountLabel ?? "Conta ainda não identificada"}{connection.planType ? ` · plano ${connection.planType}` : ""}</p></div>
                <Badge className={connection.executorStatus === "online" ? "border-lab-reagent/30 text-lab-reagent-bright" : ""}>executor {connection.executorStatus}</Badge>
              </div>
              <ConnectionStateSummary connection={connection} />
              {connection.lastErrorMessage ? <p className="mt-3 rounded-control border border-lab-danger/30 px-3 py-2 text-xs text-lab-danger">{connection.lastErrorMessage}</p> : null}
              {instruction ? <div className="mt-4 rounded-control border border-lab-border-strong bg-lab-surface-2 p-3" data-id="login-instruction">
                <p className="text-xs font-medium uppercase tracking-wide text-lab-text-muted">Complete no navegador</p>
                {instruction.type === "chatgptDeviceCode" ? <><p className="mt-2 font-mono text-xl font-semibold text-lab-reagent-bright" data-id="device-user-code">{instruction.userCode}</p><a className="mt-2 inline-flex items-center gap-1 text-sm text-lab-text hover:text-lab-reagent-bright" href={instruction.verificationUrl} target="_blank" rel="noreferrer">Abrir página de autorização <ExternalLink className="size-3.5" /></a></> : <a className="mt-2 inline-flex items-center gap-1 text-sm text-lab-text hover:text-lab-reagent-bright" href={instruction.authUrl} target="_blank" rel="noreferrer">Abrir login ChatGPT <ExternalLink className="size-3.5" /></a>}
                <p className="mt-2 text-xs text-lab-text-muted">Expira em {new Date(instruction.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</p>
              </div> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {connection.authStatus === "connected" ? <Button variant="secondary" onClick={() => connectionAction(connection, "disconnect")} disabled={busy}><Unplug /> Desconectar</Button> : connection.authStatus === "connecting" ? <Button variant="secondary" onClick={() => connectionAction(connection, "cancel")} disabled={busy}><CircleOff /> Cancelar login</Button> : <><Button onClick={() => startLogin(connection, "chatgptDeviceCode")} disabled={busy}>{connection.authStatus === "expired" || connection.authStatus === "error" ? <RefreshCw /> : <Plug />}{connection.authStatus === "expired" || connection.authStatus === "error" ? "Reconectar" : "Conectar ChatGPT"}</Button><Button variant="ghost" onClick={() => startLogin(connection, "chatgpt")} disabled={busy}>Login no navegador</Button></>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
