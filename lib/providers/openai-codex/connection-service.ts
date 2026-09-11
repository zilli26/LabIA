import "server-only";

import type { ProviderConnection } from "@prisma/client";

import {
  createOpenAICodexConnection,
  getProviderConnection,
  listProviderConnections,
  OPENAI_CODEX_PROVIDER,
  UNVERIFIED_CAPABILITIES,
  updateProviderConnection,
} from "@/lib/db/provider-connections";
import type {
  ProviderConnectionView,
  ProviderLoginPrompt,
} from "@/lib/providers/provider-connection-types";
import { getCodexErrorCode } from "@/lib/providers/openai-codex/app-server-client";
import {
  getCodexRuntime,
  hasCodexRuntime,
  startCodexRuntime,
  stopCodexRuntime,
} from "@/lib/providers/openai-codex/runtime";

const LOGIN_TTL_MS = 10 * 60_000;

export async function listOpenAIConnections() {
  const connections = await listProviderConnections();
  return connections.map(toPublicConnection);
}

export async function createOpenAIConnection() {
  const connection = await createOpenAICodexConnection();
  return toPublicConnection(connection);
}

export async function getOpenAIConnection(connectionId: string) {
  const connection = await requireOpenAIConnection(connectionId);
  return toPublicConnection(connection);
}

export async function startOpenAILogin(
  connectionId: string,
  type: "chatgpt" | "chatgptDeviceCode",
) {
  const connection = await requireOpenAIConnection(connectionId);

  await updateProviderConnection(connection.id, {
    connectionState: "connecting",
    executorState: "starting",
    lastErrorCode: null,
    lastErrorAt: null,
  });

  try {
    const client = await startCodexRuntime(
      connection.id,
      connection.credentialRef,
    );

    await updateProviderConnection(connection.id, {
      executorState: "ready",
    });

    const login = await client.startLogin(type);
    const pendingLoginExpiresAt = new Date(Date.now() + LOGIN_TTL_MS);
    const updated = await updateProviderConnection(connection.id, {
      authMethod: type,
      pendingLoginId: login.loginId,
      pendingLoginType: type,
      pendingLoginExpiresAt,
      connectionState: "connecting",
      executorState: "ready",
      lastCheckedAt: new Date(),
    });

    const prompt: ProviderLoginPrompt =
      login.type === "chatgpt"
        ? { type: "chatgpt", authUrl: login.authUrl }
        : {
            type: "chatgptDeviceCode",
            verificationUrl: login.verificationUrl,
            userCode: login.userCode,
          };

    return {
      connection: toPublicConnection(updated),
      login: prompt,
    };
  } catch (error) {
    stopCodexRuntime(connection.id);
    const failed = await updateProviderConnection(connection.id, {
      connectionState: "error",
      executorState: "error",
      lastErrorCode: getCodexErrorCode(error),
      lastErrorAt: new Date(),
    });

    return {
      connection: toPublicConnection(failed),
      login: null,
    };
  }
}

export async function refreshOpenAIConnection(connectionId: string) {
  const connection = await requireOpenAIConnection(connectionId);
  const runtime = getCodexRuntime(connection.id);

  if (!runtime) {
    return toPublicConnection(
      await updateProviderConnection(connection.id, {
        executorState: "stopped",
      }),
    );
  }

  if (
    connection.connectionState === "connecting" &&
    connection.pendingLoginExpiresAt &&
    connection.pendingLoginExpiresAt.getTime() <= Date.now()
  ) {
    if (connection.pendingLoginId) {
      try {
        await runtime.cancelLogin(connection.pendingLoginId);
      } catch {
        // Expiration is local state. A failed cancel must not leak protocol details.
      }
    }

    return toPublicConnection(
      await updateProviderConnection(connection.id, {
        connectionState: "expired",
        pendingLoginId: null,
        pendingLoginType: null,
        pendingLoginExpiresAt: null,
        lastCheckedAt: new Date(),
      }),
    );
  }

  try {
    const account = await runtime.readAccount(false);

    if (account.account?.type === "chatgpt") {
      return toPublicConnection(
        await updateProviderConnection(connection.id, {
          connectionState: "connected",
          executorState: "ready",
          accountLabel: maskEmail(account.account.email),
          connectedAt: connection.connectedAt ?? new Date(),
          expiresAt: null,
          pendingLoginId: null,
          pendingLoginType: null,
          pendingLoginExpiresAt: null,
          lastCheckedAt: new Date(),
          lastErrorCode: null,
          lastErrorAt: null,
        }),
      );
    }

    if (connection.connectionState === "connected") {
      return toPublicConnection(
        await updateProviderConnection(connection.id, {
          connectionState: "expired",
          lastCheckedAt: new Date(),
        }),
      );
    }

    return toPublicConnection(
      await updateProviderConnection(connection.id, {
        executorState: "ready",
        lastCheckedAt: new Date(),
      }),
    );
  } catch (error) {
    stopCodexRuntime(connection.id);
    return toPublicConnection(
      await updateProviderConnection(connection.id, {
        executorState: "error",
        connectionState: "error",
        lastErrorCode: getCodexErrorCode(error),
        lastErrorAt: new Date(),
      }),
    );
  }
}

export async function cancelOpenAILogin(connectionId: string) {
  const connection = await requireOpenAIConnection(connectionId);
  const runtime = getCodexRuntime(connection.id);

  if (runtime && connection.pendingLoginId) {
    try {
      await runtime.cancelLogin(connection.pendingLoginId);
    } catch {
      // State is still reset locally; no provider diagnostics are exposed.
    }
  }

  const updated = await updateProviderConnection(connection.id, {
    connectionState: "disconnected",
    pendingLoginId: null,
    pendingLoginType: null,
    pendingLoginExpiresAt: null,
    lastCheckedAt: new Date(),
  });

  return toPublicConnection(updated);
}

export async function disconnectOpenAIConnection(connectionId: string) {
  const connection = await requireOpenAIConnection(connectionId);
  const runtime = getCodexRuntime(connection.id);

  if (runtime) {
    try {
      await runtime.logout();
    } catch {
      // Logout errors are intentionally not surfaced with provider details.
    }
  }

  stopCodexRuntime(connection.id);
  const updated = await updateProviderConnection(connection.id, {
    connectionState: "disconnected",
    executorState: "stopped",
    capabilityState: "unverified",
    capabilities: UNVERIFIED_CAPABILITIES,
    accountLabel: null,
    disconnectedAt: new Date(),
    expiresAt: null,
    pendingLoginId: null,
    pendingLoginType: null,
    pendingLoginExpiresAt: null,
    generationValidatedAt: null,
    lastCheckedAt: new Date(),
    lastErrorCode: null,
    lastErrorAt: null,
  });

  return toPublicConnection(updated);
}

export async function reconnectOpenAIConnection(connectionId: string) {
  const connection = await requireOpenAIConnection(connectionId);

  await updateProviderConnection(connection.id, {
    executorState: "starting",
    lastErrorCode: null,
    lastErrorAt: null,
  });

  try {
    const runtime = await startCodexRuntime(
      connection.id,
      connection.credentialRef,
    );
    const account = await runtime.readAccount(false);

    if (account.account?.type === "chatgpt") {
      return toPublicConnection(
        await updateProviderConnection(connection.id, {
          connectionState: "connected",
          executorState: "ready",
          accountLabel: maskEmail(account.account.email),
          connectedAt: connection.connectedAt ?? new Date(),
          lastCheckedAt: new Date(),
        }),
      );
    }

    return toPublicConnection(
      await updateProviderConnection(connection.id, {
        connectionState: "disconnected",
        executorState: "ready",
        accountLabel: null,
        lastCheckedAt: new Date(),
      }),
    );
  } catch (error) {
    stopCodexRuntime(connection.id);
    return toPublicConnection(
      await updateProviderConnection(connection.id, {
        connectionState: "error",
        executorState: "error",
        lastErrorCode: getCodexErrorCode(error),
        lastErrorAt: new Date(),
      }),
    );
  }
}

async function requireOpenAIConnection(connectionId: string) {
  const connection = await getProviderConnection(connectionId);

  if (!connection || connection.provider !== OPENAI_CODEX_PROVIDER) {
    throw new Error("Provider connection not found.");
  }

  return connection;
}

function toPublicConnection(
  connection: ProviderConnection,
): ProviderConnectionView {
  const runtimeIsLive = hasCodexRuntime(connection.id);

  return {
    id: connection.id,
    workspaceId: connection.workspaceId,
    ownerKey: connection.ownerKey,
    provider: connection.provider,
    authMethod: connection.authMethod,
    connectionState: connection.connectionState as ProviderConnectionView["connectionState"],
    executorState: runtimeIsLive
      ? (connection.executorState as ProviderConnectionView["executorState"])
      : "stopped",
    capabilityState: connection.capabilityState as ProviderConnectionView["capabilityState"],
    accountLabel: connection.accountLabel,
    connectedAt: connection.connectedAt?.toISOString() ?? null,
    expiresAt: connection.expiresAt?.toISOString() ?? null,
    lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null,
    lastErrorCode: connection.lastErrorCode,
    generationValidated: connection.generationValidatedAt !== null,
  };
}

function maskEmail(email: string | null | undefined) {
  if (!email) {
    return null;
  }

  const [local, domain] = email.split("@");
  if (!domain) {
    return "Conta ChatGPT";
  }

  const visibleLocal = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visibleLocal}***@${domain}`;
}
