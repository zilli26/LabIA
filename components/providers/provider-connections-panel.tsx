"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleOff, ExternalLink, LoaderCircle, Plug, RefreshCw, Unplug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LoginInstruction, ProviderConnectionDto, ProviderConnectionStatus } from "@/lib/provider-connections/types";

type ApiError = { error?: { code?: string; message?: string } };
type LoginState = Record<string, LoginInstruction | undefined>;
type PopupState = Record<string, boolean | undefined>;

class ProviderConnectionsRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "ProviderConnectionsRequestError";
  }
}

const accountLabels: Record<ProviderConnectionStatus, string> = {
  disconnected: "Desconectada",
  connecting: "Aguardando login",
  connected: "Conectada",
  expired: "Login expirado",
  error: "Erro de conexão",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiError;
  if (!response.ok) throw new ProviderConnectionsRequestError(payload.error?.message || `HTTP ${response.status}`, response.status, payload.error?.code);
  return payload;
}

export type ProviderConnectionsPanelState = {
  connections: ProviderConnectionDto[];
  loginState: LoginState;
  popupBlocked: PopupState;
  sessionReady: boolean;
  sessionLoading: boolean;
  loading: boolean;
  busyId: string | null;
  error: string | null;
};

export type ProviderConnectionsApi = <T>(url: string, init?: RequestInit) => Promise<T>;

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function upsertConnection(connections: ProviderConnectionDto[], connection: ProviderConnectionDto) {
  return connections.some((item) => item.id === connection.id)
    ? connections.map((item) => item.id === connection.id ? connection : item)
    : [...connections, connection];
}

function openAuthorizationWindow(instruction: LoginInstruction, authWindow: Window | null) {
  if (!authWindow) return false;
  try {
    authWindow.location.href = instruction.type === "chatgptDeviceCode" ? instruction.verificationUrl : instruction.authUrl;
    return true;
  } catch {
    try { authWindow.close(); } catch { /* popup may have been closed by the browser */ }
    return false;
  }
}

function isLocalSessionExpired(error: unknown) {
  return error instanceof Error && (("status" in error && error.status === 401) || ("code" in error && error.code === "local_session_invalid"));
}

function isTerminalConnection(connection: ProviderConnectionDto) {
  return connection.authStatus === "connected" || connection.authStatus === "expired" || connection.authStatus === "error";
}

export function createProviderConnectionsController(request: ProviderConnectionsApi = api) {
  let state: ProviderConnectionsPanelState = {
    connections: [],
    loginState: {},
    popupBlocked: {},
    sessionReady: false,
    sessionLoading: false,
    loading: false,
    busyId: null,
    error: null,
  };
  const listeners = new Set<(next: ProviderConnectionsPanelState) => void>();
  const connectionGenerations = new Map<string, number>();
  const authWindows = new Map<string, Window | null>();
  let sessionRenewal: Promise<boolean> | null = null;
  const emit = (patch: Partial<ProviderConnectionsPanelState>) => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  };
  const getConnectionGeneration = (connectionId: string) => connectionGenerations.get(connectionId) ?? 0;
  const bumpConnectionGeneration = (connectionId: string) => {
    const next = getConnectionGeneration(connectionId) + 1;
    connectionGenerations.set(connectionId, next);
    return next;
  };
  const closeAuthorizationWindow = (connectionId: string) => {
    const authWindow = authWindows.get(connectionId);
    authWindows.delete(connectionId);
    if (!authWindow) return;
    try { authWindow.close(); } catch { /* popup cleanup is best effort */ }
  };
  const clearTerminalLoginState = (connections: ProviderConnectionDto[]) => {
    const loginState = { ...state.loginState };
    const popupBlocked = { ...state.popupBlocked };
    for (const connection of connections) {
      if (!isTerminalConnection(connection)) continue;
      loginState[connection.id] = undefined;
      popupBlocked[connection.id] = false;
      closeAuthorizationWindow(connection.id);
    }
    return { loginState, popupBlocked };
  };
  const renewLocalSession = async () => {
    if (sessionRenewal) return sessionRenewal;
    sessionRenewal = (async () => {
      emit({ sessionLoading: true });
      try {
        await request("/api/provider-connections/session", { method: "POST", body: "{}" });
        emit({ sessionReady: true, error: null });
        return true;
      } catch (error) {
        emit({ sessionReady: false, error: messageFromError(error, "NÃ£o foi possÃ­vel renovar a sessÃ£o local.") });
        return false;
      } finally {
        emit({ sessionLoading: false });
        sessionRenewal = null;
      }
    })();
    return sessionRenewal;
  };
  const requestWithSessionRetry = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    try {
      return await request<T>(url, init);
    } catch (error) {
      if (url.endsWith("/session") || !isLocalSessionExpired(error)) throw error;
      if (!await renewLocalSession()) throw error;
      try {
        return await request<T>(url, init);
      } catch (retryError) {
        if (isLocalSessionExpired(retryError)) {
          emit({ sessionReady: false, error: messageFromError(retryError, "SessÃ£o local expirada.") });
        }
        throw retryError;
      }
    }
  };
  const controller = {
    getState: () => state,
    subscribe(listener: (next: ProviderConnectionsPanelState) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async ensureLocalSession() {
      if (state.sessionReady || state.sessionLoading) return state.sessionReady;
      emit({ sessionLoading: true });
      try {
        await request("/api/provider-connections/session", { method: "POST", body: "{}" });
        emit({ sessionReady: true, error: null });
        return true;
      } catch (error) {
        emit({ sessionReady: false, error: messageFromError(error, "Não foi possível iniciar a sessão local.") });
        return false;
      } finally {
        emit({ sessionLoading: false });
      }
    },
    async initialize() {
      if (!await controller.ensureLocalSession()) return;
      await controller.load();
    },
    async load() {
      if (!state.sessionReady) return;
      emit({ loading: true });
      try {
        const result = await requestWithSessionRetry<{ connections: ProviderConnectionDto[] }>("/api/provider-connections");
        emit({ connections: result.connections, ...clearTerminalLoginState(result.connections), error: null });
      } catch (error) {
        emit({ error: messageFromError(error, "Falha ao carregar conexões.") });
      } finally {
        emit({ loading: false });
      }
    },
    async connectChatGPT() {
      const authWindow = typeof window === "undefined" ? null : window.open("", "labia-openai-auth");
      let initiatedConnectionId: string | null = null;
      emit({ busyId: "connect", error: null });
      try {
        if (!await controller.ensureLocalSession()) throw new Error("Não foi possível iniciar a sessão local.");
        const created = await requestWithSessionRetry<{ connection: ProviderConnectionDto }>("/api/provider-connections", { method: "POST", body: "{}" });
        initiatedConnectionId = created.connection.id;
        bumpConnectionGeneration(created.connection.id);
        authWindows.set(created.connection.id, authWindow);
        emit({ connections: upsertConnection(state.connections, created.connection) });
        const result = await requestWithSessionRetry<{ connection: ProviderConnectionDto; instruction: LoginInstruction }>(`/api/provider-connections/${created.connection.id}/login`, { method: "POST", body: JSON.stringify({ method: "chatgptDeviceCode" }) });
        const opened = openAuthorizationWindow(result.instruction, authWindow);
        if (isTerminalConnection(result.connection)) {
          emit({ connections: upsertConnection(state.connections, result.connection), ...clearTerminalLoginState([result.connection]), error: null });
        } else {
          emit({
            connections: upsertConnection(state.connections, result.connection),
            loginState: { ...state.loginState, [result.connection.id]: result.instruction },
            popupBlocked: { ...state.popupBlocked, [result.connection.id]: !opened },
            error: null,
          });
        }
      } catch (error) {
        if (authWindow) {
          try { authWindow.close(); } catch { /* popup cleanup is best effort */ }
        }
        if (initiatedConnectionId) authWindows.delete(initiatedConnectionId);
        emit({ error: messageFromError(error, "Não foi possível iniciar o login.") });
      } finally {
        emit({ busyId: null });
      }
    },
    async refreshStatuses() {
      if (!state.sessionReady || state.connections.length === 0) return;
      const snapshot = state.connections;
      const snapshotGenerations = new Map(snapshot.map((connection) => [connection.id, getConnectionGeneration(connection.id)]));
      const refreshed = await Promise.all(snapshot.map(async (connection) => {
        const generation = snapshotGenerations.get(connection.id) ?? 0;
        try {
          const result = await requestWithSessionRetry<{ connection: ProviderConnectionDto }>(`/api/provider-connections/${connection.id}/status`);
          return { connection: result.connection, generation };
        } catch {
          return null;
        }
      }));
      const successful = refreshed.filter((item): item is { connection: ProviderConnectionDto; generation: number } => item !== null && getConnectionGeneration(item.connection.id) === item.generation);
      if (successful.length > 0) {
        const terminalConnections = successful.map((item) => item.connection).filter(isTerminalConnection);
        const byId = new Map(successful.map((item) => [item.connection.id, item.connection]));
        emit({ connections: state.connections.map((item) => byId.get(item.id) ?? item), ...clearTerminalLoginState(terminalConnections) });
      }
      if (refreshed.some((item) => item === null) && [...snapshotGenerations].some(([id, generation]) => getConnectionGeneration(id) === generation)) await controller.load();
    },
    async connectionAction(connection: ProviderConnectionDto, action: "cancel" | "disconnect") {
      const generation = bumpConnectionGeneration(connection.id);
      emit({ busyId: connection.id });
      try {
        const result = await requestWithSessionRetry<{ connection: ProviderConnectionDto }>(`/api/provider-connections/${connection.id}/${action}`, { method: "POST", body: "{}" });
        if (getConnectionGeneration(connection.id) === generation) {
          closeAuthorizationWindow(connection.id);
          emit({
            connections: upsertConnection(state.connections, result.connection),
            loginState: { ...state.loginState, [connection.id]: undefined },
            popupBlocked: { ...state.popupBlocked, [connection.id]: false },
            error: null,
          });
        }
      } catch (error) {
        if (getConnectionGeneration(connection.id) === generation) emit({ error: messageFromError(error, "Operação não concluída.") });
      } finally {
        if (getConnectionGeneration(connection.id) === generation) emit({ busyId: null });
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

function LoginInstruction({ instruction, popupBlocked }: { instruction: LoginInstruction; popupBlocked: boolean }) {
  const url = instruction.type === "chatgptDeviceCode" ? instruction.verificationUrl : instruction.authUrl;
  return (
    <div className="mt-4 rounded-control border border-lab-border-strong bg-lab-surface-2 p-3" data-id="login-instruction">
      <p className="text-sm font-medium text-lab-text">Aguardando autorização</p>
      <p className="mt-2 text-xs text-lab-text-muted">1. Abra a OpenAI · 2. Digite o código · 3. Volte para cá — estamos acompanhando</p>
      {instruction.type === "chatgptDeviceCode" ? <p className="mt-2 font-mono text-xl font-semibold text-lab-reagent-bright" data-id="device-user-code">{instruction.userCode}</p> : null}
      {popupBlocked ? <div className="mt-2" data-id="openai-auth-fallback"><a className="inline-flex items-center gap-1 text-sm text-lab-text hover:text-lab-reagent-bright" href={url} target="_blank" rel="noreferrer">Abrir OpenAI <ExternalLink className="size-3.5" /></a><p className="mt-1 text-xs text-lab-text-muted">O pop-up foi bloqueado; abra este link para continuar.</p></div> : null}
      <p className="mt-2 text-xs text-lab-text-muted">Expira em {new Date(instruction.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.</p>
    </div>
  );
}

export function ProviderConnectionsPanel({ request = api }: { request?: ProviderConnectionsApi } = {}) {
  const controller = useMemo(() => createProviderConnectionsController(request), [request]);
  const [state, setState] = useState(controller.getState());
  const { connections, loginState, popupBlocked, sessionReady, sessionLoading, loading, busyId, error } = state;

  useEffect(() => controller.subscribe(setState), [controller]);
  useEffect(() => { void controller.initialize(); }, [controller]);
  const polling = connections.some((connection) => connection.authStatus === "connecting");
  useEffect(() => {
    if (!sessionReady || !polling) return;
    const timer = window.setInterval(() => { void controller.refreshStatuses(); }, 2_000);
    return () => window.clearInterval(timer);
  }, [sessionReady, polling, controller]);

  const primaryConnection = connections[0];
  const primaryInstruction = primaryConnection ? loginState[primaryConnection.id] : undefined;
  const primaryPopupBlocked = primaryConnection ? Boolean(popupBlocked[primaryConnection.id]) : false;
  const canConnect = !primaryConnection || primaryConnection.authStatus !== "connected" && primaryConnection.authStatus !== "connecting";
  const retryLabel = primaryConnection?.authStatus === "expired" || primaryConnection?.authStatus === "error" || Boolean(error) ? "Tentar novamente" : "Conectar ChatGPT";

  return (
    <section className="space-y-4" data-id="provider-connections-panel" data-session-ready={sessionReady ? "true" : "false"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-semibold">Conexões de provider</h2><p className="mt-1 max-w-2xl text-sm text-lab-text-dim">Autenticação é separada de capacidade e de geração real. Conectar uma conta não libera nenhum nó gerativo.</p></div>
        <div className="flex gap-2"><Button variant="ghost" onClick={() => void controller.refreshStatuses()} disabled={busyId !== null || !sessionReady}><RefreshCw /> Atualizar estado</Button>{canConnect ? <Button data-id="provider-connections-connect" onClick={() => void controller.connectChatGPT()} disabled={busyId !== null || sessionLoading}><Plug /> {busyId === "connect" ? "Preparando conexão…" : retryLabel}</Button> : null}</div>
      </div>
      {sessionLoading || loading ? <div className="flex items-center gap-2 text-sm text-lab-text-dim" data-id="connections-loading"><LoaderCircle className="size-4 animate-spin" /> Carregando conexões locais…</div> : null}
      {error ? <div className="rounded-node border border-lab-danger/50 bg-lab-surface-1 p-3 text-sm text-lab-danger" role="alert">{error}</div> : null}
      {!sessionReady && !sessionLoading && !error ? <p className="rounded-node border border-dashed border-lab-border bg-lab-surface-1 p-6 text-sm text-lab-text-dim">A sessão local ainda não está disponível.</p> : null}
      {sessionReady && connections.length === 0 && !loading ? <div className="rounded-node border border-dashed border-lab-border bg-lab-surface-1 p-6 text-sm text-lab-text-dim">Nenhuma conexão criada neste workspace local.</div> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {connections.map((connection) => {
          const instruction = loginState[connection.id];
          const busy = busyId === connection.id || busyId === "connect";
          return (
            <article key={connection.id} data-id="provider-connection-card" data-provider={connection.provider} className="rounded-node border border-lab-border bg-lab-surface-1 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><h3 className="font-display font-semibold">{connection.label}</h3><Badge>{connection.provider}</Badge></div><p className="mt-1 text-xs text-lab-text-muted">{connection.accountLabel ?? "Conta ainda não identificada"}{connection.planType ? ` · plano ${connection.planType}` : ""}</p></div>
                <Badge className={connection.executorStatus === "online" ? "border-lab-reagent/30 text-lab-reagent-bright" : ""}>executor {connection.executorStatus}</Badge>
              </div>
              <ConnectionStateSummary connection={connection} />
              {connection.lastErrorMessage ? <p className="mt-3 rounded-control border border-lab-danger/30 px-3 py-2 text-xs text-lab-danger">{connection.lastErrorMessage}</p> : null}
              {instruction ? <LoginInstruction instruction={instruction} popupBlocked={Boolean(popupBlocked[connection.id])} /> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {connection.authStatus === "connected" ? <Button variant="secondary" onClick={() => void controller.connectionAction(connection, "disconnect")} disabled={busy}><Unplug /> Desconectar</Button> : connection.authStatus === "connecting" ? <Button variant="secondary" onClick={() => void controller.connectionAction(connection, "cancel")} disabled={busy}><CircleOff /> Cancelar login</Button> : null}
              </div>
            </article>
          );
        })}
      </div>
      {primaryInstruction && primaryPopupBlocked ? <span className="sr-only">Fallback de autorização disponível</span> : null}
    </section>
  );
}
