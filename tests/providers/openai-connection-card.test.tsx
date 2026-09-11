import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OpenAIConnectionCard } from "../../components/providers/openai-connection-card";
import type { ProviderConnectionView } from "../../lib/providers/provider-connection-types";

const connection: ProviderConnectionView = {
  id: "connection-1",
  workspaceId: "workspace-1",
  ownerKey: "local-user",
  provider: "openai-codex",
  authMethod: "chatgptDeviceCode",
  connectionState: "connected",
  executorState: "ready",
  capabilityState: "unverified",
  accountLabel: "fe***@example.com",
  connectedAt: "2026-09-11T12:00:00.000Z",
  expiresAt: null,
  lastCheckedAt: "2026-09-11T12:00:00.000Z",
  lastErrorCode: null,
  generationValidated: false,
};

describe("OpenAIConnectionCard DOM", () => {
  it("keeps account, image capability and real generation as separate evidence", () => {
    const html = renderToStaticMarkup(
      <OpenAIConnectionCard
        connection={connection}
        loginPrompt={null}
      />,
    );

    expect(html).toContain("Conta ChatGPT");
    expect(html).toContain("Conectada");
    expect(html).toContain("Capacidade de imagem");
    expect(html).toContain("Não verificada");
    expect(html).toContain("Geração real");
    expect(html).toContain("Não validada");
    expect(html).toContain("Desconectar");
    expect(html).not.toContain("sk-");
  });

  it("renders device-code instructions without treating the code as a credential", () => {
    const html = renderToStaticMarkup(
      <OpenAIConnectionCard
        connection={{ ...connection, connectionState: "connecting" }}
        loginPrompt={{
          type: "chatgptDeviceCode",
          verificationUrl: "https://auth.openai.com/codex/device",
          userCode: "ABCD-1234",
        }}
      />,
    );

    expect(html).toContain("https://auth.openai.com/codex/device");
    expect(html).toContain("ABCD-1234");
    expect(html).toContain("Cancelar login");
  });
});
