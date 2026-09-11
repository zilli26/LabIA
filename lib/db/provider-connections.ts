import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { ensureDefaultWorkspace } from "@/lib/db/flows";
import { prisma } from "@/lib/db/prisma";

export const OPENAI_CODEX_PROVIDER = "openai-codex";
export const DEFAULT_OPENAI_AUTH_METHOD = "chatgptDeviceCode";

const DEFAULT_OWNER_KEY =
  process.env.DEFAULT_PROVIDER_OWNER_KEY?.trim() || "local-user";

export const UNVERIFIED_CAPABILITIES = {
  image: {
    state: "unverified",
    reason: "Login is not proof that image generation is available.",
  },
} satisfies Prisma.InputJsonObject;

export async function listProviderConnections() {
  const workspace = await ensureDefaultWorkspace();

  return prisma.providerConnection.findMany({
    where: {
      workspaceId: workspace.id,
      ownerKey: DEFAULT_OWNER_KEY,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

export async function createOpenAICodexConnection() {
  const workspace = await ensureDefaultWorkspace();

  return prisma.providerConnection.create({
    data: {
      workspaceId: workspace.id,
      ownerKey: DEFAULT_OWNER_KEY,
      provider: OPENAI_CODEX_PROVIDER,
      authMethod: DEFAULT_OPENAI_AUTH_METHOD,
      credentialRef: `codex-${randomUUID()}`,
      connectionState: "disconnected",
      executorState: "stopped",
      capabilityState: "unverified",
      capabilities: UNVERIFIED_CAPABILITIES,
    },
  });
}

export function getProviderConnection(connectionId: string) {
  return prisma.providerConnection.findUnique({
    where: {
      id: connectionId,
    },
  });
}

export function updateProviderConnection(
  connectionId: string,
  data: Prisma.ProviderConnectionUpdateInput,
) {
  return prisma.providerConnection.update({
    where: {
      id: connectionId,
    },
    data,
  });
}
