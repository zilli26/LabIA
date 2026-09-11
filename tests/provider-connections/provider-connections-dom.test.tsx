import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConnectionStateSummary } from "@/components/providers/provider-connections-panel";
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
    const html = renderToStaticMarkup(<ConnectionStateSummary connection={connection} />);
    expect(html).toContain('data-id="account-connection-state"');
    expect(html).toContain("Conectada");
    expect(html).toContain('data-id="image-capability-state"');
    expect(html).toContain("Não verificada");
    expect(html).toContain('data-id="real-generation-state"');
    expect(html).toContain("Não validada");
    expect(html).not.toContain("Disponível e verificada");
  });
});
