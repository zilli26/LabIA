import "server-only";

import { prisma } from "@/lib/db/prisma";
import { ensureDefaultWorkspace } from "@/lib/db/flows";
import { getLocalOwnerId, sanitizePublicText } from "./security";
import { isExecutorHeartbeatFresh, parseExecutorHeartbeat } from "./heartbeat";

const OFFLINE_MESSAGE = "executor pareado offline: snapshot indisponível.";

export type RemoteImageOptionsResult = {
  executor:
    | { status: "online"; lastSeenAt: string }
    | { status: "offline"; message: string };
  connections: Array<{
    id: string;
    label: string;
    planType: string | null;
    models: Array<{ id: string; name: string }>;
  }>;
};

type SnapshotConnection = ReturnType<typeof parseExecutorHeartbeat>["connections"][number];

function offline(): RemoteImageOptionsResult {
  return {
    executor: { status: "offline", message: OFFLINE_MESSAGE },
    connections: [],
  };
}

export async function readRemoteExecutorImageOptions(now = new Date()): Promise<RemoteImageOptionsResult> {
  const workspace = await ensureDefaultWorkspace();
  const ownerId = getLocalOwnerId();
  const pairing = await prisma.executorPairing.findFirst({
    where: { ownerId, workspaceId: workspace.id, status: "active" },
    orderBy: { lastSeenAt: "desc" },
    select: { lastSeenAt: true, snapshot: true, state: true },
  });

  if (!pairing || pairing.state !== "online" || !isExecutorHeartbeatFresh(pairing.lastSeenAt, now)) {
    return offline();
  }

  const rawSnapshot = pairing.snapshot;
  if (!rawSnapshot || typeof rawSnapshot !== "object" || Array.isArray(rawSnapshot)) {
    return offline();
  }

  let snapshot: ReturnType<typeof parseExecutorHeartbeat>;
  try {
    const candidate = rawSnapshot as Record<string, unknown>;
    snapshot = parseExecutorHeartbeat({
      sequence: candidate.sequence ?? 1,
      executorVersion: candidate.executorVersion,
      state: candidate.state,
      connections: candidate.connections,
    });
  } catch {
    return offline();
  }

  const snapshotConnections = new Map(snapshot.connections.map((connection) => [connection.connectionId, connection]));
  const openAiConnectionIds = snapshot.connections
    .filter((connection) => connection.provider === "openai")
    .map((connection) => connection.connectionId);
  if (openAiConnectionIds.length === 0) {
    return {
      executor: { status: "online", lastSeenAt: pairing.lastSeenAt!.toISOString() },
      connections: [],
    };
  }

  const ownedConnections = await prisma.providerConnection.findMany({
    where: {
      id: { in: openAiConnectionIds },
      ownerId,
      workspaceId: workspace.id,
      provider: "openai",
    },
    select: { id: true, label: true, planType: true },
  });

  return {
    executor: { status: "online", lastSeenAt: pairing.lastSeenAt!.toISOString() },
    connections: ownedConnections.flatMap((connection) => {
      const snapshotConnection = snapshotConnections.get(connection.id);
      if (!isEligibleSnapshotConnection(snapshotConnection)) return [];
      return [{
        id: sanitizePublicText(connection.id).slice(0, 128),
        label: sanitizePublicText(connection.label).slice(0, 128),
        planType: connection.planType === null ? null : sanitizePublicText(connection.planType).slice(0, 64),
        models: snapshotConnection.models
          .filter((model) => model.kind === "image")
          .map(({ id, name }) => ({ id: sanitizePublicText(id).slice(0, 128), name: sanitizePublicText(name).slice(0, 256) })),
      }];
    }),
  };
}

function isEligibleSnapshotConnection(connection: SnapshotConnection | undefined): connection is SnapshotConnection {
  return Boolean(
    connection &&
      connection.provider === "openai" &&
      connection.authStatus === "connected" &&
      connection.executorStatus === "online" &&
      connection.capabilities.some((capability) => capability.key === "image_generation" && capability.status === "available"),
  );
}
