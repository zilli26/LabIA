import { sanitizePublicText } from "./security";

export const EXECUTOR_HEARTBEAT_TTL_MS = 90_000;

export const EXECUTOR_HEARTBEAT_STATES = ["online", "starting", "offline", "error"] as const;
export type ExecutorHeartbeatState = (typeof EXECUTOR_HEARTBEAT_STATES)[number];

const AUTH_STATUSES = ["disconnected", "connecting", "connected", "expired", "error"] as const;
const EXECUTOR_STATUSES = ["offline", "starting", "online", "error"] as const;
const CAPABILITY_STATUSES = ["unverified", "available", "unavailable", "error"] as const;
const MODEL_KINDS = ["text", "image", "video", "audio"] as const;

export type ExecutorHeartbeatCapability = {
  key: string;
  status: (typeof CAPABILITY_STATUSES)[number];
  evidence?: string;
};

export type ExecutorHeartbeatModel = {
  id: string;
  name: string;
  kind: (typeof MODEL_KINDS)[number];
};

export type ExecutorHeartbeatConnection = {
  connectionId: string;
  provider: string;
  authStatus: (typeof AUTH_STATUSES)[number];
  executorStatus: (typeof EXECUTOR_STATUSES)[number];
  capabilities: ExecutorHeartbeatCapability[];
  models: ExecutorHeartbeatModel[];
};

export type ExecutorHeartbeat = {
  sequence: number;
  executorVersion: string;
  state: ExecutorHeartbeatState;
  connections: ExecutorHeartbeatConnection[];
};

export type ExecutorHeartbeatSnapshot = ExecutorHeartbeat & { receivedAt: string };

export class ExecutorHeartbeatValidationError extends Error {
  readonly code = "invalid_heartbeat";
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = "ExecutorHeartbeatValidationError";
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function assertKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new ExecutorHeartbeatValidationError("Heartbeat contém campos não suportados.");
  }
}

function requiredString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new ExecutorHeartbeatValidationError(`${label} inválido.`);
  }
  return value.trim();
}

function enumValue<T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new ExecutorHeartbeatValidationError(`${label} inválido.`);
  }
  return value as T[number];
}

export function parseExecutorHeartbeat(value: unknown): ExecutorHeartbeat {
  const input = objectValue(value);
  assertKeys(input, ["sequence", "executorVersion", "state", "connections"]);
  if (typeof input.sequence !== "number" || !Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new ExecutorHeartbeatValidationError("sequence invÃ¡lida.");
  }
  const executorVersion = requiredString(input.executorVersion, "executorVersion", 64);
  const state = enumValue(input.state, EXECUTOR_HEARTBEAT_STATES, "state");
  if (!Array.isArray(input.connections) || input.connections.length > 64) {
    throw new ExecutorHeartbeatValidationError("connections inválido.");
  }

  const seenConnectionIds = new Set<string>();
  const connections = input.connections.map((candidate) => {
    const connection = objectValue(candidate);
    assertKeys(connection, ["connectionId", "provider", "authStatus", "executorStatus", "capabilities", "models"]);
    const connectionId = requiredString(connection.connectionId, "connectionId", 128);
    if (seenConnectionIds.has(connectionId)) {
      throw new ExecutorHeartbeatValidationError("connectionId duplicado.");
    }
    seenConnectionIds.add(connectionId);
    const provider = requiredString(connection.provider, "provider", 64);
    const authStatus = enumValue(connection.authStatus, AUTH_STATUSES, "authStatus");
    const executorStatus = enumValue(connection.executorStatus, EXECUTOR_STATUSES, "executorStatus");

    if (!Array.isArray(connection.capabilities) || connection.capabilities.length > 64) {
      throw new ExecutorHeartbeatValidationError("capabilities inválido.");
    }
    const capabilities = connection.capabilities.map((candidateCapability) => {
      const capability = objectValue(candidateCapability);
      assertKeys(capability, ["key", "status", "evidence"]);
      const result: ExecutorHeartbeatCapability = {
        key: requiredString(capability.key, "capability.key", 128),
        status: enumValue(capability.status, CAPABILITY_STATUSES, "capability.status"),
      };
      if (capability.evidence !== undefined) result.evidence = requiredString(capability.evidence, "capability.evidence", 256);
      return result;
    });

    if (!Array.isArray(connection.models) || connection.models.length > 256) {
      throw new ExecutorHeartbeatValidationError("models inválido.");
    }
    const models = connection.models.map((candidateModel) => {
      const model = objectValue(candidateModel);
      assertKeys(model, ["id", "name", "kind"]);
      return {
        id: requiredString(model.id, "model.id", 128),
        name: requiredString(model.name, "model.name", 256),
        kind: enumValue(model.kind, MODEL_KINDS, "model.kind"),
      } satisfies ExecutorHeartbeatModel;
    });

    return { connectionId, provider, authStatus, executorStatus, capabilities, models };
  });

  return { sequence: input.sequence, executorVersion, state, connections };
}

export function sanitizeExecutorHeartbeat(value: unknown, secrets: readonly string[] = []): ExecutorHeartbeat {
  const heartbeat = parseExecutorHeartbeat(value);
  return {
    sequence: heartbeat.sequence,
    executorVersion: sanitizePublicText(heartbeat.executorVersion, secrets).slice(0, 64),
    state: heartbeat.state,
    connections: heartbeat.connections.map((connection) => ({
      connectionId: sanitizePublicText(connection.connectionId, secrets).slice(0, 128),
      provider: sanitizePublicText(connection.provider, secrets).slice(0, 64),
      authStatus: connection.authStatus,
      executorStatus: connection.executorStatus,
      capabilities: connection.capabilities.map((capability) => ({
        key: sanitizePublicText(capability.key, secrets).slice(0, 128),
        status: capability.status,
        ...(capability.evidence === undefined
          ? {}
          : { evidence: sanitizePublicText(capability.evidence, secrets).slice(0, 256) }),
      })),
      models: connection.models.map((model) => ({
        id: sanitizePublicText(model.id, secrets).slice(0, 128),
        name: sanitizePublicText(model.name, secrets).slice(0, 256),
        kind: model.kind,
      })),
    })),
  };
}

export function deriveExecutorHeartbeatState(connections: readonly Pick<ExecutorHeartbeatConnection, "executorStatus">[]): ExecutorHeartbeatState {
  if (connections.length === 0) return "offline";
  if (connections.every((connection) => connection.executorStatus === "error")) return "error";
  if (connections.every((connection) => connection.executorStatus === "offline")) return "offline";
  return "online";
}

export function executorHeartbeatTtlMs(env: NodeJS.ProcessEnv = process.env) {
  const configured = Number(env.LABIA_EXECUTOR_HEARTBEAT_TTL_MS ?? EXECUTOR_HEARTBEAT_TTL_MS);
  return Number.isInteger(configured) && configured >= 15_000 && configured <= 86_400_000
    ? configured
    : EXECUTOR_HEARTBEAT_TTL_MS;
}

export function isExecutorHeartbeatFresh(lastSeenAt: Date | null, now = new Date(), ttlMs = executorHeartbeatTtlMs()) {
  return Boolean(lastSeenAt && Number.isFinite(lastSeenAt.getTime()) && now.getTime() - lastSeenAt.getTime() <= ttlMs);
}
