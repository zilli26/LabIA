import { loadEnvConfig } from "@next/env";

import {
  createProviderExecutorServer,
  ProviderExecutorManager,
  type ExecutorHeartbeatConnectionConfig,
} from "../lib/provider-connections/executor-service";
import { deriveExecutorHeartbeatState, parseExecutorHeartbeat } from "../lib/provider-connections/heartbeat";
import { sendExecutorHeartbeat } from "../lib/provider-connections/heartbeat-client";
import { resolveCodexHomeRoot } from "../lib/provider-connections/codex-app-server";
import { isValidSessionRef } from "../lib/provider-connections/security";

loadEnvConfig(process.cwd());

const port = Number(process.env.LABIA_PROVIDER_EXECUTOR_PORT || 4317);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("LABIA_PROVIDER_EXECUTOR_PORT invalida");
}

const manager = new ProviderExecutorManager({
  codexHomeRoot: resolveCodexHomeRoot(process.env.LABIA_CODEX_HOME_ROOT),
  codexBin: process.env.LABIA_CODEX_BIN?.trim() || "codex",
  loginTtlMs: Number(process.env.LABIA_OPENAI_LOGIN_TTL_MS || 600_000),
});
const server = createProviderExecutorServer({ manager });
let heartbeatTimer: NodeJS.Timeout | undefined;

function readConnectionConfigurations(): ExecutorHeartbeatConnectionConfig[] {
  const raw = process.env.LABIA_EXECUTOR_CONNECTIONS_JSON?.trim() || "[]";
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("LABIA_EXECUTOR_CONNECTIONS_JSON invalido.");
  }
  if (!Array.isArray(value) || value.length > 64) throw new Error("LABIA_EXECUTOR_CONNECTIONS_JSON invalido.");
  return value.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("LABIA_EXECUTOR_CONNECTIONS_JSON invalido.");
    }
    const entry = candidate as Record<string, unknown>;
    if (Object.keys(entry).some((key) => !["connectionId", "provider", "sessionRef"].includes(key))) {
      throw new Error("LABIA_EXECUTOR_CONNECTIONS_JSON so pode declarar identidade.");
    }
    if (
      typeof entry.connectionId !== "string" || entry.connectionId.trim().length === 0 || entry.connectionId.length > 128 ||
      typeof entry.provider !== "string" || entry.provider.trim().length === 0 || entry.provider.length > 64 ||
      typeof entry.sessionRef !== "string" || !isValidSessionRef(entry.sessionRef)
    ) {
      throw new Error("LABIA_EXECUTOR_CONNECTIONS_JSON invalido.");
    }
    return {
      connectionId: entry.connectionId.trim(),
      provider: entry.provider.trim(),
      sessionRef: entry.sessionRef,
    } satisfies ExecutorHeartbeatConnectionConfig;
  });
}

async function startControlPlaneHeartbeat() {
  if (!process.env.LABIA_CONTROL_PLANE_URL?.trim()) return;
  const configurations = readConnectionConfigurations();
  let sequence = Date.now();
  const send = async () => {
    sequence = Math.max(sequence + 1, Date.now());
    try {
      const connections = await manager.readHeartbeatConnections(configurations);
      const heartbeat = parseExecutorHeartbeat({
        sequence,
        executorVersion: process.env.LABIA_EXECUTOR_VERSION?.trim() || process.env.LABIA_CODEX_VERSION?.trim() || "unknown",
        state: deriveExecutorHeartbeatState(connections),
        connections,
      });
      await sendExecutorHeartbeat(heartbeat);
    } catch {
      // O control-plane deriva offline pelo TTL; nunca registrar segredos localmente.
    }
  };
  void send();
  const intervalMs = Number(process.env.LABIA_EXECUTOR_HEARTBEAT_INTERVAL_MS || 30_000);
  if (Number.isInteger(intervalMs) && intervalMs >= 15_000 && intervalMs <= 86_400_000) {
    heartbeatTimer = setInterval(() => void send(), intervalMs);
    heartbeatTimer.unref?.();
  }
}

server.listen(port, "127.0.0.1", () => {
  console.log(`Provider executor do LabIA ativo em http://127.0.0.1:${port}`);
  console.log("Este processo gerencia autenticacao local; nao consome filas de geracao.");
  void startControlPlaneHeartbeat();
});

function shutdown() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  manager.closeAll();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
