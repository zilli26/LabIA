import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import type { FlowGraph } from "@/lib/flows/graph";
import type { FlowCostEstimate } from "@/lib/flows/costs";
import { billingModeFromProvider } from "@/lib/providers/model-provider";
import { getLocalConnectionsToken } from "@/lib/provider-connections/security";

export type BillingMode = "api" | "subscription" | "local";

export type ExecutionSelectionSnapshot = {
  nodeId: string;
  providerId: string;
  connectionId: string | null;
  modelId: string;
  params: Record<string, unknown>;
  billingMode: BillingMode;
};

export type ExecutionSnapshot = {
  ownerId: string;
  workspaceId: string;
  flowId: string;
  targetNodeId: string | null;
  graphHash: string;
  selections: ExecutionSelectionSnapshot[];
  estimatedCost: { usd: number; brl: number };
  currency: "BRL";
  billingMode: BillingMode;
};

export type ExecutionConfirmationStore = {
  issue(input: {
    jti: string;
    ownerId: string;
    workspaceId: string;
    flowId: string;
    snapshotHash: string;
    expiresAt: number;
  }): Promise<void>;
  consume(input: {
    jti: string;
    ownerId: string;
    workspaceId: string;
    flowId: string;
    snapshotHash: string;
    now: number;
  }): Promise<boolean>;
};

type ConfirmationPayload = {
  v: 1;
  jti: string;
  ownerId: string;
  workspaceId: string;
  flowId: string;
  snapshotHash: string;
  exp: number;
};

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashExecutionSnapshot(snapshot: ExecutionSnapshot) {
  return createHash("sha256").update(canonicalize(snapshot)).digest("hex");
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodeToken(payload: ConfirmationPayload, secret: string) {
  const encoded = Buffer.from(canonicalize(payload)).toString("base64url");
  return `${encoded}.${signPayload(encoded, secret)}`;
}

function decodeToken(token: string, secret: string): ConfirmationPayload | null {
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = signPayload(encoded, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ConfirmationPayload;
    return payload.v === 1 && typeof payload.jti === "string" ? payload : null;
  } catch {
    return null;
  }
}

export class ExecutionConfirmationService {
  constructor(private readonly dependencies: { store: ExecutionConfirmationStore; secret?: string }) {}

  async issue(snapshot: ExecutionSnapshot, now = Math.floor(Date.now() / 1000)) {
    const expiresAt = now + 5 * 60;
    const payload: ConfirmationPayload = {
      v: 1,
      jti: randomUUID(),
      ownerId: snapshot.ownerId,
      workspaceId: snapshot.workspaceId,
      flowId: snapshot.flowId,
      snapshotHash: hashExecutionSnapshot(snapshot),
      exp: expiresAt,
    };
    await this.dependencies.store.issue({ ...payload, expiresAt });
    return { token: encodeToken(payload, this.secret()), expiresAt, snapshotHash: payload.snapshotHash };
  }

  async consume(token: string, snapshot: ExecutionSnapshot, now = Math.floor(Date.now() / 1000)) {
    const payload = decodeToken(token, this.secret());
    if (!payload || payload.exp <= now || payload.ownerId !== snapshot.ownerId || payload.workspaceId !== snapshot.workspaceId || payload.flowId !== snapshot.flowId || payload.snapshotHash !== hashExecutionSnapshot(snapshot)) return false;
    return this.dependencies.store.consume({
      jti: payload.jti,
      ownerId: payload.ownerId,
      workspaceId: payload.workspaceId,
      flowId: payload.flowId,
      snapshotHash: payload.snapshotHash,
      now,
    });
  }

  private secret() {
    return this.dependencies.secret ?? getLocalConnectionsToken();
  }
}

export class PrismaExecutionConfirmationStore implements ExecutionConfirmationStore {
  async issue(input: Parameters<ExecutionConfirmationStore["issue"]>[0]) {
    await prisma.executionConfirmation.create({
      data: {
        id: input.jti,
        ownerId: input.ownerId,
        workspaceId: input.workspaceId,
        flowId: input.flowId,
        snapshotHash: input.snapshotHash,
        expiresAt: new Date(input.expiresAt * 1000),
      },
    });
  }

  async consume(input: Parameters<ExecutionConfirmationStore["consume"]>[0]) {
    const result = await prisma.executionConfirmation.updateMany({
      where: {
        id: input.jti,
        ownerId: input.ownerId,
        workspaceId: input.workspaceId,
        flowId: input.flowId,
        snapshotHash: input.snapshotHash,
        consumedAt: null,
        expiresAt: { gt: new Date(input.now * 1000) },
      },
      data: { consumedAt: new Date(input.now * 1000) },
    });
    return result.count === 1;
  }
}

export function buildExecutionSnapshot({
  ownerId,
  workspaceId,
  flowId,
  targetNodeId,
  graph,
  cost,
}: {
  ownerId: string;
  workspaceId: string;
  flowId: string;
  targetNodeId?: string | null;
  graph: FlowGraph;
  cost: FlowCostEstimate;
}): ExecutionSnapshot {
  const selections = graph.nodes
    .filter((node) => node.data.kind === "image-generation" || node.data.kind === "video-generation" || node.data.kind === "video-extend" || node.data.kind === "text2video")
    .map((node) => {
      const params = node.data.params ?? {};
      const providerId = typeof params.providerId === "string" ? params.providerId : "fal";
      const billingMode = billingModeFromProvider(providerId);
      return {
        nodeId: node.id,
        providerId,
        connectionId: typeof params.connectionId === "string" ? params.connectionId : null,
        modelId: typeof params.model === "string" ? params.model : "",
        params: JSON.parse(JSON.stringify(params)) as Record<string, unknown>,
        billingMode,
      };
    });
  const modes = new Set(selections.map((selection) => selection.billingMode));
  if (modes.size > 1) throw new Error("Execução com billingMode misto exige confirmação por operação.");
  return {
    ownerId,
    workspaceId,
    flowId,
    targetNodeId: targetNodeId ?? null,
    graphHash: createHash("sha256").update(canonicalize(graph)).digest("hex"),
    selections,
    estimatedCost: { usd: cost.total.usd, brl: cost.total.brl },
    currency: "BRL",
    billingMode: [...modes][0] ?? "local",
  };
}
