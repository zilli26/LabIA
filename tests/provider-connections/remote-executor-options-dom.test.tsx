// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RemoteExecutorImageOptions, RemoteStagingReadiness } from "@/components/providers/provider-connections-panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function renderRemote(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(payload)));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<RemoteExecutorImageOptions />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

async function renderReadiness(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(payload)));
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<RemoteStagingReadiness />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

describe("remote executor options DOM", () => {
  it("shows safe staging readiness and no execution action", async () => {
    const { container, root } = await renderReadiness({
      overall: "not_ready",
      database: { status: "migration_missing", message: "A tabela ExecutorPairing não está disponível; confira a migration no staging." },
      executor: { status: "unavailable", message: "A tabela de pareamento não está disponível no staging." },
      worker: { status: "not_proven", message: "Worker não comprovado por esta leitura segura; valide o processo de staging separadamente antes do teste controlado." },
      executionAllowed: false,
    });

    expect(container.textContent).toContain("Prontidão da preview");
    expect(container.textContent).toContain("migration_missing");
    expect(container.textContent).toContain("Worker não comprovado");
    expect(container.textContent).not.toMatch(/Gerar|Executar|Conectar ChatGPT/);
    await act(async () => root.unmount());
  });

  it("shows online snapshot models without an OAuth reconnect CTA", async () => {
    const { container, root } = await renderRemote({
      executor: { status: "online", lastSeenAt: "2026-09-13T10:01:00.000Z" },
      connections: [{ id: "owned", label: "ChatGPT", planType: "plus", models: [{ id: "image-1", name: "Imagem aprovada" }] }],
    });

    expect(container.textContent).toContain("Imagem aprovada");
    expect(container.querySelector("[data-id='provider-connections-connect']")).toBeNull();
    expect(container.textContent).not.toContain("Conectar ChatGPT");
    await act(async () => root.unmount());
  });

  it("shows executor pareado offline without suggesting remote OAuth", async () => {
    const { container, root } = await renderRemote({
      executor: { status: "offline", message: "executor pareado offline: snapshot indisponível." },
      connections: [],
    });

    expect(container.textContent).toContain("executor pareado offline");
    expect(container.textContent).toContain("Nenhum login remoto é iniciado aqui");
    expect(container.textContent).not.toContain("Conectar ChatGPT");
    await act(async () => root.unmount());
  });
});
