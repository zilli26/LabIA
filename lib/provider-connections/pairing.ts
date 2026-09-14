import { createHash, timingSafeEqual } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  isExecutorHeartbeatFresh,
  parseExecutorHeartbeat,
  sanitizeExecutorHeartbeat,
  EXECUTOR_HEARTBEAT_STATES,
  type ExecutorHeartbeat,
  type ExecutorHeartbeatSnapshot,
} from "./heartbeat";
import { sanitizePublicText } from "./security";

export type { ExecutorHeartbeat } from "./heartbeat";

const MIN_SECRET_LENGTH = 32;

export class ExecutorPairingError extends Error {
  constructor(
    public readonly code: "unauthorized" | "heartbeat_scope_mismatch" | "heartbeat_replay" | "pairing_revoked" | "pairing_not_found" | "heartbeat_too_large",
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ExecutorPairingError";
  }
}

type PairingRow = {
  id: string;
  workspaceId: string;
  ownerId: string;
  label: string;
  secretHash: string;
  status: string;
  executorVersion: string | null;
  state: string;
  lastSeenAt: Date | null;
  lastSequence: bigint;
  snapshot: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type ExecutorPairingStatus = {
  pairingId: string;
  label: string;
  status: "online" | "starting" | "offline" | "error" | "revoked";
  executorVersion: string | null;
  lastSeenAt: string | null;
  snapshot: ExecutorHeartbeatSnapshot | null;
};

export function sanitizeExecutorPairingStatus(status: ExecutorPairingStatus, secrets: readonly string[] = []): ExecutorPairingStatus {
  const publicStatuses = ["online", "starting", "offline", "error", "revoked"] as const;
  return {
    pairingId: sanitizePublicText(status.pairingId, secrets).slice(0, 128),
    label: sanitizePublicText(status.label, secrets).slice(0, 128),
    status: publicStatuses.includes(status.status) ? status.status : "error",
    executorVersion: status.executorVersion === null
      ? null
      : sanitizePublicText(status.executorVersion, secrets).slice(0, 64),
    lastSeenAt: typeof status.lastSeenAt === "string" && Number.isFinite(Date.parse(status.lastSeenAt))
      ? status.lastSeenAt
      : null,
    snapshot: publicSnapshot(status.snapshot, secrets),
  };
}

export function hashExecutorPairingSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function assertSecret(secret: string) {
  if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) {
    throw new ExecutorPairingError("unauthorized", "Não autorizado.", 401);
  }
}

function safeHashEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function publicStatus(row: PairingRow, now: Date) {
  if (row.status !== "active") return "revoked" as const;
  if (!isExecutorHeartbeatFresh(row.lastSeenAt, now)) return "offline" as const;
  return EXECUTOR_HEARTBEAT_STATES.includes(row.state as (typeof EXECUTOR_HEARTBEAT_STATES)[number])
    ? row.state as ExecutorPairingStatus["status"]
    : "error";
}

function publicSnapshot(snapshot: unknown, secrets: readonly string[]) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = snapshot as Record<string, unknown>;
  try {
    const heartbeatValue = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "receivedAt"));
    const heartbeat = sanitizeExecutorHeartbeat(heartbeatValue, secrets);
    const receivedAt = typeof value.receivedAt === "string" && Number.isFinite(Date.parse(value.receivedAt))
      ? value.receivedAt
      : null;
    return receivedAt ? { ...heartbeat, receivedAt } : null;
  } catch {
    return null;
  }
}

function toStatus(row: PairingRow, now = new Date(), secrets: readonly string[] = []): ExecutorPairingStatus {
  return {
    pairingId: sanitizePublicText(row.id, secrets).slice(0, 128),
    label: sanitizePublicText(row.label, secrets).slice(0, 128),
    status: publicStatus(row, now),
    executorVersion: row.executorVersion === null ? null : sanitizePublicText(row.executorVersion, secrets).slice(0, 64),
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    snapshot: publicSnapshot(row.snapshot, secrets),
  };
}

async function authenticate(pairingId: string, secret: string) {
  assertSecret(secret);
  const row = await prisma.executorPairing.findUnique({ where: { id: pairingId } });
  if (!row || row.status !== "active" || !safeHashEqual(row.secretHash, hashExecutorPairingSecret(secret))) {
    throw new ExecutorPairingError("unauthorized", "Não autorizado.", 401);
  }
  return row;
}

export async function authenticateExecutorPairing(pairingId: string, secret: string) {
  await authenticate(pairingId, secret);
}

export async function createExecutorPairing(input: {
  workspaceId: string;
  ownerId: string;
  label: string;
  secret: string;
}) {
  return createExecutorPairingWithClient(prisma, input);
}

export async function createExecutorPairingWithClient(
  client: Pick<Prisma.TransactionClient, "executorPairing">,
  input: {
    workspaceId: string;
    ownerId: string;
    label: string;
    secret: string;
  },
) {
  assertSecret(input.secret);
  const row = await client.executorPairing.create({
    data: {
      workspaceId: input.workspaceId,
      ownerId: input.ownerId,
      label: input.label,
      secretHash: hashExecutorPairingSecret(input.secret),
      status: "active",
      state: "offline",
    },
  }) as PairingRow;
  return toStatus(row, new Date(), [input.secret]);
}

export async function recordExecutorHeartbeat(input: {
  pairingId: string;
  secret: string;
  heartbeat: ExecutorHeartbeat;
  now?: Date;
}) {
  const pairing = await authenticate(input.pairingId, input.secret);
  const heartbeat = parseExecutorHeartbeat(input.heartbeat);
  const safeHeartbeat = sanitizeExecutorHeartbeat(heartbeat, [input.secret]);
  const connectionIds = heartbeat.connections.map((connection) => connection.connectionId);
  const connections = connectionIds.length === 0
    ? []
    : await prisma.providerConnection.findMany({
        where: {
          id: { in: connectionIds },
          workspaceId: pairing.workspaceId,
          ownerId: pairing.ownerId,
        },
        select: { id: true, provider: true },
      });
  const knownConnections = new Map(connections.map((connection) => [connection.id, connection.provider]));
  if (
    knownConnections.size !== connectionIds.length ||
    heartbeat.connections.some((connection) => knownConnections.get(connection.connectionId) !== connection.provider)
  ) {
    throw new ExecutorPairingError("heartbeat_scope_mismatch", "Heartbeat fora do escopo do pareamento.", 403);
  }

  const now = input.now ?? new Date();
  const snapshot: ExecutorHeartbeatSnapshot = { ...safeHeartbeat, receivedAt: now.toISOString() };
  const update = {
    executorVersion: safeHeartbeat.executorVersion,
    state: safeHeartbeat.state,
    lastSeenAt: now,
    lastSequence: BigInt(heartbeat.sequence),
    snapshot: snapshot as unknown as Prisma.InputJsonValue,
  };
  const result = await prisma.executorPairing.updateMany({
    where: {
      id: pairing.id,
      status: "active",
      lastSequence: { lt: BigInt(heartbeat.sequence) },
    },
    data: update,
  });
  if (result.count !== 1) {
    throw new ExecutorPairingError("heartbeat_replay", "Heartbeat fora de ordem.", 409);
  }
  const row = {
    ...pairing,
    ...update,
  } as PairingRow;
  return toStatus(row, now, [input.secret]);
}

export async function getExecutorPairingStatus(input: {
  pairingId: string;
  secret: string;
  now?: Date;
}) {
  const row = await authenticate(input.pairingId, input.secret);
  return toStatus(row, input.now ?? new Date(), [input.secret]);
}
