"use client";

import { useCallback, useEffect, useState } from "react";

import { OpenAIConnectionCard } from "@/components/providers/openai-connection-card";
import type {
  ProviderConnectionView,
  ProviderLoginPrompt,
} from "@/lib/providers/provider-connection-types";

type ConnectionResponse = {
  connection?: ProviderConnectionView;
  connections?: ProviderConnectionView[];
  login?: ProviderLoginPrompt | null;
  error?: string;
};

const friendlyErrors: Record<string, string> = {
  local_oauth_disabled:
    "A conexão local está desabilitada. Ative LABIA_LOCAL_OPENAI_OAUTH_ENABLED no .env.local.",
  local_only: "A conexão OpenAI só pode ser controlada pelo LabIA local.",
  database_not_configured:
    "Configure DATABASE_URL/DIRECT_URL e aplique a migration O1 antes de conectar.",
  provider_connection_action_failed:
    "Não foi possível executar a ação no Codex App Server.",
  provider_connections_unavailable:
    "Não foi possível carregar as conexões do workspace.",
};

export function ConnectionManager() {
  const [connection, setConnection] = useState<ProviderConnectionView | null>(null);
  const [loginPrompt, setLoginPrompt] = useState<ProviderLoginPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/provider-connections", {
        cache: "no-store",
      });
      const body = (await response.json()) as ConnectionResponse;
      if (!response.ok) {
        setErrorMessage(friendlyErrors[body.error ?? ""] ?? "Conexões indisponíveis.");
        return;
      }

      setConnection(body.connections?.[0] ?? null);
      setErrorMessage(null);
    } catch {
      setErrorMessage("Não foi possível acessar o componente local de conexões.");
    }
  }, []);

  useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (!connection || connection.connectionState !== "connecting") {
      return;
    }

    const timer = window.setInterval(() => {
      void runAction("status", undefined, false);
    }, 2_000);

    return () => window.clearInterval(timer);
    // runAction is stable enough for the polling lifecycle because the connection id
    // is read at call time; including it would recreate the timer every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection?.id, connection?.connectionState]);

  async function ensureConnection() {
    if (connection) {
      return connection;
    }

    const response = await fetch("/api/provider-connections", { method: "POST" });
    const body = (await response.json()) as ConnectionResponse;
    if (!response.ok || !body.connection) {
      throw new Error(body.error ?? "provider_connection_create_failed");
    }

    setConnection(body.connection);
    return body.connection;
  }

  async function runAction(
    action: "login" | "status" | "cancel" | "disconnect" | "reconnect",
    loginType?: "chatgpt" | "chatgptDeviceCode",
    showBusy = true,
  ) {
    if (showBusy) setBusy(true);
    setErrorMessage(null);

    try {
      const current = await ensureConnection();
      const response = await fetch(
        `/api/provider-connections/${current.id}/actions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, loginType }),
        },
      );
      const body = (await response.json()) as ConnectionResponse;

      if (!response.ok || !body.connection) {
        throw new Error(body.error ?? "provider_connection_action_failed");
      }

      setConnection(body.connection);
      if (action === "login") {
        setLoginPrompt(body.login ?? null);
      } else if (
        body.connection.connectionState !== "connecting" ||
        action === "cancel"
      ) {
        setLoginPrompt(null);
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setErrorMessage(
        friendlyErrors[code] ?? "Não foi possível concluir a ação local.",
      );
    } finally {
      if (showBusy) setBusy(false);
    }
  }

  return (
    <OpenAIConnectionCard
      busy={busy}
      connection={connection}
      errorMessage={errorMessage}
      loginPrompt={loginPrompt}
      onCancel={() => void runAction("cancel")}
      onDisconnect={() => void runAction("disconnect")}
      onReconnect={() => void runAction("reconnect")}
      onStartBrowserLogin={() => void runAction("login", "chatgpt")}
      onStartDeviceLogin={() => void runAction("login", "chatgptDeviceCode")}
    />
  );
}
