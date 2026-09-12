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
  vi.useRealTimers();
  document.body.replaceChildren();
});

async function renderPanel(request: ProviderConnectionsApi) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<ProviderConnectionsPanel request={request} />);
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

async function setInput(container: HTMLElement, value: string) {
  const input = container.querySelector<HTMLInputElement>('[data-id="local-connections-token"]');
  expect(input).not.toBeNull();
  await act(async () => {
    input!.focus();
    const setNativeValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setNativeValue?.call(input, value);
    input!.dispatchEvent(new window.Event("input", { bubbles: true }));
    input!.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await settle();
}

describe("ProviderConnectionsPanel DOM real", () => {
  it("renderiza desbloqueio, login, polling e logout no componente real", async () => {
    vi.useFakeTimers();
    const calls: Array<{ url: string; token: string; method: string }> = [];
    const request = (async (url: string, token: string, init?: RequestInit) => {
      calls.push({ url, token, method: init?.method ?? "GET" });
      if (url.endsWith("/login")) return { connection: connecting, instruction };
      if (url.endsWith("/status")) return { connection: connected };
      if (url.endsWith("/disconnect")) return { connection: disconnected };
      if (init?.method === "POST") return { connection: disconnected };
      return { connections: [disconnected] };
    }) as ProviderConnectionsApi;
    const { container, root } = await renderPanel(request);

    expect(container.querySelector('[data-id="provider-connections-lock"]')).not.toBeNull();
    await setInput(container, "local-token");
    await click(container, '[data-id="local-connections-unlock"]');
    expect(container.querySelector('[data-id="provider-connection-card"]')).not.toBeNull();
    await clickByText(container, "Adicionar ChatGPT");
    await clickByText(container, "Conectar ChatGPT");
    expect(container.querySelector('[data-id="login-instruction"]')?.textContent).toContain("ABCD-1234");

    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await settle();
    expect(container.textContent).toContain("Desconectar");
    expect(calls.some((call) => call.url === "/api/provider-connections/pc_1/status")).toBe(true);
    await clickByText(container, "Desconectar");
    expect(container.textContent).toContain("Conectar ChatGPT");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((call) => call.token === "local-token")).toBe(true);

    await act(async () => root.unmount());
  });

  it("exercita erro, reconexão, cancelamento, polling com executor morto e bloqueio", async () => {
    vi.useFakeTimers();
    let pollingError = false;
    const request = (async (url: string, _token: string, init?: RequestInit) => {
      if (init?.method === "POST" && url === "/api/provider-connections") throw new Error("criação recusada");
      if (url.endsWith("/status") && pollingError) throw new Error("executor morto");
      if (url.endsWith("/login")) return { connection: connecting, instruction };
      if (url.endsWith("/cancel")) return { connection: disconnected };
      if (url === "/api/provider-connections") return { connections: [pollingError ? { ...expired, executorStatus: "offline" as const, lastErrorMessage: "executor morto" } : expired] };
      return { connection: disconnected };
    }) as ProviderConnectionsApi;
    const { container, root } = await renderPanel(request);

    await setInput(container, "local-token");
    await click(container, '[data-id="local-connections-unlock"]');
    await clickByText(container, "Adicionar ChatGPT");
    expect(container.textContent).toContain("criação recusada");
    await clickByText(container, "Reconectar");
    expect(container.querySelector('[data-id="login-instruction"]')).not.toBeNull();
    await clickByText(container, "Cancelar login");
    pollingError = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await settle();
    expect(container.textContent).toContain("executor offline");
    await clickByText(container, "Bloquear");
    expect(container.querySelector('[data-id="provider-connections-lock"]')).not.toBeNull();

    await act(async () => root.unmount());
  });
});
