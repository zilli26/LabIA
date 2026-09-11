import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConnectionStateSummary, ProviderConnectionsPanel } from "@/components/providers/provider-connections-panel";
import type { ProviderConnectionDto } from "@/lib/provider-connections/types";

const connection: ProviderConnectionDto = {
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
  capabilities: [{
    key: "image_generation",
    status: "unverified",
    evidence: "O1: login não prova capacidade de geração.",
    verifiedAt: null,
  }],
};

describe("ProviderConnection DOM contract", () => {
  it("não transforma login conectado em capacidade ou geração validada", () => {
    const html = renderToStaticMarkup(createElement(ConnectionStateSummary, { connection }));
    expect(html).toContain('data-id="account-connection-state"');
    expect(html).toContain("Conectada");
    expect(html).toContain('data-id="image-capability-state"');
    expect(html).toContain("Não verificada");
    expect(html).toContain('data-id="real-generation-state"');
    expect(html).toContain("Não validada");
    expect(html).not.toContain("Disponível e verificada");
  });

  it("não consulta nem mostra ações de conexão antes do token local", () => {
    const html = renderToStaticMarkup(createElement(ProviderConnectionsPanel));
    expect(html).toContain('data-id="provider-connections-lock"');
    expect(html).toContain('data-id="local-connections-token"');
    expect(html).toContain('type="password"');
    expect(html).toContain("LABIA_LOCAL_CONNECTIONS_TOKEN");
    expect(html).not.toContain("Adicionar ChatGPT");
  });
});
