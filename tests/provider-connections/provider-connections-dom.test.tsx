// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderConnectionsPanel, type ProviderConnectionsApi } from "@/components/providers/provider-connections-panel";
import type { ProviderConnectionDto } from "@/lib/provider-connections/types";

const connected: ProviderConnectionDto = {
  id: "pc_1",
  provider: "openai",
  label: "ChatGPT pessoal",
  authMethod: "chatgptDeviceCode",
  authStatus: "connected",
  executorStatus: "online",
  accountLabel: "felipe@example.test",
  planType: "plus",
  loginExpiresAt: null,
  connectedAt: "2026-09-11T12:00:00.000Z",
  lastCheckedAt: "2026-09-11T12:00:00.000Z",
  lastErrorCode: null,
  lastErrorMessage: null,
  generationValidationStatus: "unvalidated",
  capabilities: [{ key: "image_generation", status: "unverified", evidence: "O1", verifiedAt: null }],
};
const disconnected = { ...connected, authStatus: "disconnected" as const, executorStatus: "offline" as const, accountLabel: null, planType: null, connectedAt: null };
const expired = { ...disconnected, authStatus: "expired" as const };
const connecting = { ...disconnected, authStatus: "connecting" as const, executorStatus: "online" as const };
const instruction = { type: "chatgptDeviceCode" as const, verificationUrl: "https://auth.openai.com/codex/device", userCode: "ABCD-1234", expiresAt: "2026-09-12T15:00:00.000Z" };

beforeEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  document.body.replaceChildren();
});

async function renderPanel(request: ProviderConnectionsApi, hostname?: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<ProviderConnectionsPanel request={request} hostname={hostname} />);
  });
  return { container, root };
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function click(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLElement>(selector);
  expect(element).not.toBeNull();
  await act(async () => {
    element!.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickByText(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find((candidate) => candidate.textContent?.includes(text));
  expect(button).toBeDefined();
  await act(async () => {
    button!.click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

function localSessionExpiredError() {
  return Object.assign(new Error("Sessão local expirada"), { status: 401, code: "local_session_invalid" });
}

describe("ProviderConnectionsPanel DOM real", () => {
  it.each(["localhost", "[::1]"])("seleciona o painel local para loopback %s", async (hostname) => {
    const request = (async (url: string) => url.endsWith("/session") ? {} : { connections: [disconnected] }) as ProviderConnectionsApi;
    const { container, root } = await renderPanel(request, hostname);
    await settle();

    expect(container.querySelector('[data-id="provider-connections-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-id="remote-staging-readiness"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("seleciona o painel remoto no preview e exibe os estados seguros", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => Response.json(String(input).endsWith("/readiness") ? {
      overall: "not_ready",
      environment: {
        databaseUrl: { configured: true }, directUrl: { configured: false }, ownerId: { configured: true },
        storage: { supabaseUrl: { configured: true }, serviceRoleKey: { configured: false }, assetsBucket: { configured: true } },
      },
      database: { status: "migration_missing", executorPairingTable: "missing", message: "A tabela ExecutorPairing não está disponível." },
      executor: { status: "offline", ttlMs: 90000, lastSeenAt: "2026-09-13T11:57:00.000Z", message: "Executor pareado offline." },
      worker: { status: "not_proven", message: "Worker não comprovado." }, executionAllowed: false,
    } : { executor: { status: "offline", message: "executor pareado offline: snapshot indisponível." }, connections: [] })));
    const request = vi.fn() as unknown as ProviderConnectionsApi;
    const { container, root } = await renderPanel(request, "preview.example");
    await settle();

    expect(container.querySelector('[data-id="remote-staging-readiness"]')).not.toBeNull();
    expect(container.textContent).toContain("migration_missing");
    expect(container.textContent).toContain("TTL: 90000 ms");
    expect(container.textContent).toContain("2026-09-13T11:57:00.000Z");
    expect(container.textContent).toContain("Worker não comprovado");
    expect(container.textContent).not.toMatch(/secret|token|postgresql|https:\/\/db/i);
    expect(request).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("inicia sessão, abre o device login no gesto, faz polling e desconecta", async () => {
    vi.useFakeTimers();
    const calls: Array<{ url: string; method: string; body?: string; headers?: string }> = [];
    const events: string[] = [];
    let statusCalls = 0;
    const request = (async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body?.toString(), headers: JSON.stringify(init?.headers ?? {}) });
      events.push(`${init?.method ?? "GET"} ${url}`);
      if (url.endsWith("/session")) return {};
      if (url.endsWith("/login")) return { connection: connecting, instruction };
      if (url.endsWith("/status")) return { connection: ++statusCalls > 0 ? connected : connecting };
      if (url.endsWith("/disconnect")) return { connection: disconnected };
      if (init?.method === "POST") return { connection: disconnected };
      return { connections: [disconnected] };
    }) as ProviderConnectionsApi;
    const popup = { location: { href: "" }, close: vi.fn() } as unknown as Window;
    const open = vi.spyOn(window, "open").mockImplementation(() => {
      events.push("window.open");
      return popup;
    });
    const { container, root } = await renderPanel(request);
    await settle();

    expect(container.querySelector('[data-id="local-connections-token"]')).toBeNull();
    expect(container.textContent).not.toContain("LABIA_LOCAL_CONNECTIONS_TOKEN");
    expect(calls.some((call) => call.url.endsWith("/session"))).toBe(true);
    expect(container.querySelectorAll('[data-id="provider-connections-connect"]')).toHaveLength(1);

    events.length = 0;
    await click(container, '[data-id="provider-connections-connect"]');
    await settle();
    expect(events.slice(0, 3)).toEqual(["window.open", "POST /api/provider-connections", "POST /api/provider-connections/pc_1/login"]);
    expect(open).toHaveBeenCalledWith("", "labia-openai-auth");
    expect(popup.location.href).toBe(instruction.verificationUrl);
    expect(container.querySelector('[data-id="device-user-code"]')?.textContent).toContain("ABCD-1234");
    expect(container.querySelector('[data-id="openai-auth-fallback"]')).toBeNull();
    expect(calls.filter((call) => call.url.endsWith("/login"))[0]?.body).toContain("chatgptDeviceCode");
    expect(calls.every((call) => !call.headers?.toLowerCase().includes("x-labia-local-token"))).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await settle();
    expect(container.textContent).toContain("Desconectar");
    expect(calls.some((call) => call.url === "/api/provider-connections/pc_1/status")).toBe(true);

    await clickByText(container, "Desconectar");
    expect(container.textContent).toContain("Conectar ChatGPT");
    expect(calls.some((call) => call.url.endsWith("/disconnect"))).toBe(true);
    await act(async () => root.unmount());
  });

  it("ignora status atrasado depois de cancelar e desconectar", async () => {
    vi.useFakeTimers();
    const statusResponses = [deferred<{ connection: ProviderConnectionDto }>(), deferred<{ connection: ProviderConnectionDto }>()];
    let statusIndex = 0;
    const request = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/session")) return {};
      if (url === "/api/provider-connections" && init?.method === "POST") return { connection: disconnected };
      if (url.endsWith("/login")) return { connection: connecting, instruction };
      if (url.endsWith("/status")) return statusResponses[statusIndex++].promise;
      if (url.endsWith("/cancel") || url.endsWith("/disconnect")) return { connection: disconnected };
      return { connections: [disconnected] };
    }) as ProviderConnectionsApi;
    vi.spyOn(window, "open").mockReturnValue({ location: { href: "" }, close: vi.fn() } as unknown as Window);
    const { container, root } = await renderPanel(request);
    await settle();

    await click(container, '[data-id="provider-connections-connect"]');
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await clickByText(container, "Cancelar login");
    statusResponses[0].resolve({ connection: connected });
    await settle();
    expect(container.textContent).toContain("Desconectada");
    expect(container.textContent).not.toContain("Desconectar");

    await click(container, '[data-id="provider-connections-connect"]');
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    statusResponses[1].resolve({ connection: connected });
    await settle();
    expect(container.textContent).toContain("Desconectar");

    const delayedDisconnectStatus = deferred<{ connection: ProviderConnectionDto }>();
    statusResponses.push(delayedDisconnectStatus);
    await clickByText(container, "Atualizar estado");
    await clickByText(container, "Desconectar");
    delayedDisconnectStatus.resolve({ connection: connected });
    await settle();
    expect(container.textContent).toContain("Desconectada");
    expect(container.textContent).not.toContain("Desconectar");
    await act(async () => root.unmount());
  });

  it("renova sessão uma vez no 401 do polling e repete o status", async () => {
    vi.useFakeTimers();
    let sessionCalls = 0;
    let statusCalls = 0;
    let listCalls = 0;
    const request = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/session")) { sessionCalls += 1; return {}; }
      if (url === "/api/provider-connections" && init?.method === "POST") return { connection: disconnected };
      if (url.endsWith("/login")) return { connection: connecting, instruction };
      if (url.endsWith("/status")) {
        statusCalls += 1;
        if (statusCalls === 1) throw localSessionExpiredError();
        return { connection: connected };
      }
      if (url.endsWith("/cancel")) return { connection: disconnected };
      return { connections: [listCalls++ === 0 ? disconnected : connecting] };
    }) as ProviderConnectionsApi;
    vi.spyOn(window, "open").mockReturnValue({ location: { href: "" }, close: vi.fn() } as unknown as Window);
    const { container, root } = await renderPanel(request);
    await settle();
    await click(container, '[data-id="provider-connections-connect"]');
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await settle();
    expect(sessionCalls).toBe(2);
    expect(statusCalls).toBe(2);
    expect(container.textContent).toContain("Conectada");
    expect(container.textContent).not.toContain("Aguardando autorização");
    await act(async () => root.unmount());
  });

  it("não entra em loop quando a renovação da sessão falha", async () => {
    vi.useFakeTimers();
    let sessionCalls = 0;
    let statusCalls = 0;
    let listCalls = 0;
    const request = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/session")) {
        sessionCalls += 1;
        if (sessionCalls === 2) throw localSessionExpiredError();
        return {};
      }
      if (url === "/api/provider-connections" && init?.method === "POST") return { connection: disconnected };
      if (url.endsWith("/login")) return { connection: connecting, instruction };
      if (url.endsWith("/status")) { statusCalls += 1; throw localSessionExpiredError(); }
      return { connections: [listCalls++ === 0 ? disconnected : connecting] };
    }) as ProviderConnectionsApi;
    vi.spyOn(window, "open").mockReturnValue({ location: { href: "" }, close: vi.fn() } as unknown as Window);
    const { container, root } = await renderPanel(request);
    await settle();
    await click(container, '[data-id="provider-connections-connect"]');
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await settle();
    expect(sessionCalls).toBe(2);
    expect(statusCalls).toBe(1);
    expect(container.textContent).toContain("Sessão local expirada");
    await act(async () => root.unmount());
  });

  it.each([
    ["connected", connected, "Desconectar"],
    ["expired", expired, "Tentar novamente"],
    ["error", { ...disconnected, authStatus: "error" as const, lastErrorMessage: "executor offline" }, "Tentar novamente"],
  ])("limpa instrução e popup quando polling termina em %s", async (_label, terminal, expectedText) => {
    vi.useFakeTimers();
    const close = vi.fn();
    const request = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/session")) return {};
      if (url === "/api/provider-connections" && init?.method === "POST") return { connection: disconnected };
      if (url.endsWith("/login")) return { connection: connecting, instruction };
      if (url.endsWith("/status")) return { connection: terminal };
      return { connections: [disconnected] };
    }) as ProviderConnectionsApi;
    vi.spyOn(window, "open").mockReturnValue({ location: { href: "" }, close } as unknown as Window);
    const { container, root } = await renderPanel(request);
    await settle();
    await click(container, '[data-id="provider-connections-connect"]');
    expect(container.querySelector('[data-id="login-instruction"]')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await settle();
    expect(container.textContent).toContain(expectedText);
    expect(container.querySelector('[data-id="login-instruction"]')).toBeNull();
    expect(close).toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("mostra fallback de popup, erro, reconexão, cancelamento e erro de polling", async () => {
    vi.useFakeTimers();
    let rejectCreate = true;
    let pollingError = false;
    const request = (async (url: string, init?: RequestInit) => {
      if (url.endsWith("/session")) return {};
      if (init?.method === "POST" && url === "/api/provider-connections") {
        if (rejectCreate) throw new Error("criação recusada");
        return { connection: disconnected };
      }
      if (url.endsWith("/login")) return { connection: connecting, instruction };
      if (url.endsWith("/status") && pollingError) throw new Error("executor morto");
      if (url.endsWith("/cancel")) return { connection: disconnected };
      if (url === "/api/provider-connections") return { connections: [expired] };
      return { connection: disconnected };
    }) as ProviderConnectionsApi;
    vi.spyOn(window, "open").mockReturnValue(null);
    const { container, root } = await renderPanel(request);
    await settle();

    await click(container, '[data-id="provider-connections-connect"]');
    expect(container.textContent).toContain("criação recusada");
    rejectCreate = false;
    await click(container, '[data-id="provider-connections-connect"]');
    await settle();
    expect(container.querySelector('[data-id="openai-auth-fallback"]')).not.toBeNull();
    expect(container.querySelector('[data-id="login-instruction"]')).not.toBeNull();
    await clickByText(container, "Cancelar login");

    await click(container, '[data-id="provider-connections-connect"]');
    await settle();
    pollingError = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await settle();
    expect(container.textContent).toContain("executor offline");
    await act(async () => root.unmount());
  });
});
