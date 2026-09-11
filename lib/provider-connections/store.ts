import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { ensureDefaultWorkspace } from "@/lib/db/flows";
import { getLocalOwnerId } from "./security";
import {
  PROVIDER_CAPABILITY_KEYS,
  type ExecutorAccountStatus,
  type GenerationValidationStatus,
  type ProviderCapabilityKey,
  type ProviderCapabilityStatus,
  type ProviderConnectionDto,
  type ProviderConnectionStatus,
  type ProviderExecutorStatus,
} from "./types";

const OPENAI_PROVIDER = "openai";
const DEFAULT_LABEL = "ChatGPT pessoal";

type OwnedScope = { workspaceId: string; ownerId: string };

async function getOwnedScope(): Promise<OwnedScope> {
  const workspace = await ensureDefaultWorkspace();
  return { workspaceId: workspace.id, ownerId: getLocalOwnerId() };
}

function ownedWhere(connectionId: string, scope: OwnedScope) {
  return { id: connectionId, workspaceId: scope.workspaceId, ownerId: scope.ownerId };
}

async function findOwnedRow(connectionId: string, scope: OwnedScope) {
  return prisma.providerConnection.findFirst({
    where: ownedWhere(connectionId, scope),
    include: { capabilities: true },
  });
}

async function updateOwnedRow(
  connectionId: string,
  scope: OwnedScope,
  data: Prisma.ProviderConnectionUpdateManyMutationInput,
) {
  const result = await prisma.providerConnection.updateMany({
    where: ownedWhere(connectionId, scope),
    data,
  });
  if (result.count !== 1) return null;
  return findOwnedRow(connectionId, scope);
}

export async function listOwnedProviderConnections(): Promise<ProviderConnectionDto[]> {
  const scope = await getOwnedScope();
  const rows = await prisma.providerConnection.findMany({
    where: scope,
    include: { capabilities: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDto);
}

export async function getOwnedProviderConnection(connectionId: string) {
  const scope = await getOwnedScope();
  return findOwnedRow(connectionId, scope);
}

export async function createOrGetOpenAiConnection() {
  const scope = await getOwnedScope();
  const existing = await prisma.providerConnection.findFirst({
    where: { ...scope, provider: OPENAI_PROVIDER },
    include: { capabilities: true },
  });
  if (existing) return toDto(existing);

  const row = await prisma.providerConnection.create({
    data: {
      ...scope,
      provider: OPENAI_PROVIDER,
      label: DEFAULT_LABEL,
      authMethod: "chatgptDeviceCode",
      sessionRef: `labia-codex:${randomUUID()}`,
      authStatus: "disconnected",
      executorStatus: "offline",
      generationValidationStatus: "unvalidated",
      capabilities: {
        create: PROVIDER_CAPABILITY_KEYS.map((key) => ({
          key,
          status: "unverified",
          evidence: "O1: login não prova capacidade de geração.",
        })),
      },
    },
    include: { capabilities: true },
  });
  return toDto(row);
}

export async function updateProviderConnectionFromExecutor(
  connectionId: string,
  status: ExecutorAccountStatus,
  extra?: { authMethod?: string; loginId?: string | null },
) {
  const scope = await getOwnedScope();
  const owned = await findOwnedRow(connectionId, scope);
  if (!owned) return null;

  const row = await updateOwnedRow(connectionId, scope, {
    authStatus: status.authStatus,
    executorStatus: status.executorStatus,
    accountLabel: status.accountLabel,
    planType: status.planType,
    loginExpiresAt: status.loginExpiresAt ? new Date(status.loginExpiresAt) : null,
    lastCheckedAt: new Date(),
    lastErrorCode: status.errorCode,
    lastErrorMessage: status.errorMessage,
    authMethod: extra?.authMethod ?? owned.authMethod,
    loginId: extra?.loginId === undefined ? owned.loginId : extra.loginId,
    connectedAt: status.authStatus === "connected" ? owned.connectedAt ?? new Date() : owned.connectedAt,
    disconnectedAt: status.authStatus === "disconnected" ? new Date() : owned.disconnectedAt,
  });
  return row ? toDto(row) : null;
}

export async function markProviderConnectionAction(
  connectionId: string,
  data: {
    authStatus: ProviderConnectionStatus;
    executorStatus: ProviderExecutorStatus;
    authMethod?: string;
    loginId?: string | null;
    loginExpiresAt?: Date | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  },
) {
  const scope = await getOwnedScope();
  const owned = await findOwnedRow(connectionId, scope);
  if (!owned) return null;

  const row = await updateOwnedRow(connectionId, scope, {
    authStatus: data.authStatus,
    executorStatus: data.executorStatus,
    authMethod: data.authMethod ?? owned.authMethod,
    loginId: data.loginId === undefined ? owned.loginId : data.loginId,
    loginExpiresAt: data.loginExpiresAt === undefined ? owned.loginExpiresAt : data.loginExpiresAt,
    lastErrorCode: data.errorCode === undefined ? owned.lastErrorCode : data.errorCode,
    lastErrorMessage: data.errorMessage === undefined ? owned.lastErrorMessage : data.errorMessage,
    lastCheckedAt: new Date(),
  });
  return row ? toDto(row) : null;
}

export async function markExecutorOffline(connectionId: string, message: string) {
  return markProviderConnectionAction(connectionId, {
    authStatus: "error",
    executorStatus: "offline",
    errorCode: "executor_offline",
    errorMessage: message,
  });
}

type ConnectionRow = {
  id: string;
  provider: string;
  label: string;
  authMethod: string;
  authStatus: string;
  executorStatus: string;
  accountLabel: string | null;
  planType: string | null;
  loginExpiresAt: Date | null;
  connectedAt: Date | null;
  lastCheckedAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  generationValidationStatus: string;
  capabilities: Array<{
    key: string;
    status: string;
    evidence: string | null;
    verifiedAt: Date | null;
  }>;
};

function toDto(row: ConnectionRow): ProviderConnectionDto {
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    authMethod: row.authMethod,
    authStatus: row.authStatus as ProviderConnectionStatus,
    executorStatus: row.executorStatus as ProviderExecutorStatus,
    accountLabel: row.accountLabel,
    planType: row.planType,
    loginExpiresAt: row.loginExpiresAt?.toISOString() ?? null,
    connectedAt: row.connectedAt?.toISOString() ?? null,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    generationValidationStatus: row.generationValidationStatus as GenerationValidationStatus,
    capabilities: row.capabilities.map((capability) => ({
      key: capability.key as ProviderCapabilityKey,
      status: capability.status as ProviderCapabilityStatus,
      evidence: capability.evidence,
      verifiedAt: capability.verifiedAt?.toISOString() ?? null,
    })),
  };
}
