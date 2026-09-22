import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { listProjectAssets } from "@/lib/assets/project-assets";
import { hasDatabaseEnv } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { getOwnedExecutionScope, getOwnedFlow } from "@/lib/flows/ownership";
import { parseStoredFlowGraph } from "@/lib/flows/parse";
import { estimateFlowCost } from "@/lib/flows/costs";
import { buildExecutionSnapshot, hashExecutionSnapshot } from "@/lib/flows/execution-confirmation";
import type { FlowGraph } from "@/lib/flows/graph";
import { validateFlowGraph } from "@/lib/flows/validation";
import { listSerializableNodeDefinitions } from "@/lib/flows/registry";
import {
  createProject,
  getProject,
  listProjects,
  type ProjectScope,
} from "@/lib/projects";
import { assertOperationalGraphProviders, createServerProviderResolver } from "@/lib/providers/provider-registry";
import { sanitizePublicText } from "@/lib/provider-connections/security";
import { getStagingReadiness } from "@/lib/provider-connections/staging-readiness";

import type {
  CreateFlowDraftInput,
  EstimateFlowInput,
  GetFlowInput,
  GetProjectInput,
  ListAssetsInput,
  ListProjectsInput,
  SaveFlowDraftInput,
} from "./schemas";

export const MCP_SCHEMA_VERSION = "labia.mcp.v1" as const;
export const MCP_EXPOSED_TOOLS = [
  "get_capabilities",
  "list_projects",
  "get_project",
  "list_assets",
  "get_flow",
  "create_flow_draft",
  "save_flow_draft",
  "estimate_flow",
] as const;
export const MCP_BLOCKED_TOOLS = ["start_run"] as const;

export class McpToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "McpToolError";
  }
}

type Scope = ProjectScope;
type StoredFlow = {
  id: string;
  projectId: string | null;
  brandId?: string | null;
  name: string;
  isTemplate?: boolean;
  graph: unknown;
  createdAt?: Date;
  updatedAt?: Date;
};

type DraftResult = {
  draftStatus: "draft";
  generationStarted: false;
  project: ReturnType<typeof publicProject>;
  flow: ReturnType<typeof publicFlow>;
};

const localDraftIdempotency = new Map<string, DraftResult>();
const localSaveIdempotency = new Map<string, ReturnType<typeof publicFlow> & { generationStarted: false; graphHash: string }>();

function scopeKey(scope: Scope, idempotencyKey: string) {
  return `${scope.ownerId}:${scope.workspaceId}:${idempotencyKey}`;
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashFlowGraph(graph: FlowGraph) {
  return createHash("sha256").update(canonicalize(graph)).digest("hex");
}

function publicProject(project: {
  id: string;
  name: string;
  type: string;
  status: string;
  objective?: string;
  aspectRatio?: string;
  durationSeconds?: number | null;
  primaryFlow?: { id: string; name: string } | null;
  primaryFlowId?: string | null;
  _count?: { flows: number; assets: number };
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: project.id,
    name: project.name,
    type: project.type,
    status: project.status,
    ...(project.objective === undefined ? {} : { objective: project.objective }),
    ...(project.aspectRatio === undefined ? {} : { aspectRatio: project.aspectRatio }),
    ...(project.durationSeconds === undefined ? {} : { durationSeconds: project.durationSeconds }),
    primaryFlow: project.primaryFlow ?? (project.primaryFlowId ? { id: project.primaryFlowId } : null),
    ...(project._count ? { counts: project._count } : {}),
    ...(project.createdAt ? { createdAt: project.createdAt.toISOString() } : {}),
    ...(project.updatedAt ? { updatedAt: project.updatedAt.toISOString() } : {}),
  };
}

function publicFlow(flow: StoredFlow) {
  const graph = parseStoredFlowGraph(flow.graph as Prisma.JsonValue);
  return {
    id: flow.id,
    projectId: flow.projectId,
    name: flow.name,
    isTemplate: flow.isTemplate ?? false,
    graph,
    graphHash: hashFlowGraph(graph),
    ...(flow.createdAt ? { createdAt: flow.createdAt.toISOString() } : {}),
    ...(flow.updatedAt ? { updatedAt: flow.updatedAt.toISOString() } : {}),
  };
}

async function database<T>(operation: string, callback: () => Promise<T>) {
  try {
    return await callback();
  } catch (error) {
    if (error instanceof McpToolError) throw error;
    throw new McpToolError("database_unavailable", `Não foi possível ${operation}.`, 503);
  }
}

async function localScope(): Promise<Scope> {
  return database("resolver o workspace local autorizado", async () => {
    if (!hasDatabaseEnv()) {
      throw new McpToolError("database_not_configured", "DATABASE_URL e DIRECT_URL não estão configuradas.", 503);
    }
    return getOwnedExecutionScope();
  });
}

function ensureFlowGraph(graph: FlowGraph) {
  const validation = validateFlowGraph(graph);
  if (!validation.valid) {
    throw new McpToolError("invalid_graph", "Grafo do fluxo inválido.", 400);
  }
}

function applyDraftIntent(graph: FlowGraph, intent: CreateFlowDraftInput["intent"]): FlowGraph {
  const next = JSON.parse(JSON.stringify(graph)) as FlowGraph;
  const briefingNode = next.nodes.find((node) => node.data.kind === "text-input")
    ?? next.nodes.find((node) => node.data.kind === "note" && node.data.params?.stage === "briefing")
    ?? next.nodes.find((node) => ["image-generation", "video-generation", "video-extend", "text2video"].includes(node.data.kind));

  if (!briefingNode) return next;
  briefingNode.data.params = {
    ...(briefingNode.data.params ?? {}),
    briefing: intent.briefing,
    objective: intent.objective,
    aspectRatio: intent.aspectRatio,
    durationSeconds: intent.durationSeconds,
  };
  if (briefingNode.data.kind === "text-input") {
    briefingNode.data.params.text = intent.briefing;
  }
  return next;
}

async function saveOwnedGraph(flowId: string, scope: Scope, name: string, graph: FlowGraph) {
  const updated = await prisma.flow.updateMany({
    where: { id: flowId, workspaceId: scope.workspaceId },
    data: { name: name.trim(), graph: graph as unknown as Prisma.InputJsonValue },
  });
  if (updated.count !== 1) throw new McpToolError("flow_not_found", "Flow não encontrado.", 404);
  const saved = await getOwnedFlow(flowId);
  if (!saved) throw new McpToolError("flow_not_found", "Flow não encontrado.", 404);
  return saved as StoredFlow;
}

async function assertGraphAssetsBelongToProject(flow: StoredFlow, scope: Scope, graph: FlowGraph) {
  const assetIds = Array.from(new Set(graph.nodes
    .filter((node) => node.data.kind === "asset-input")
    .map((node) => node.data.params?.assetId)
    .filter((assetId): assetId is string => typeof assetId === "string" && assetId.trim().length > 0)));
  if (assetIds.length === 0) return;
  if (!flow.projectId) throw new McpToolError("asset_project_required", "O Flow precisa pertencer a um Projeto para usar Asset importado.");

  const assets = await prisma.asset.findMany({
    where: {
      id: { in: assetIds },
      workspaceId: scope.workspaceId,
      projectId: flow.projectId,
      origin: "UPLOADED",
      type: { in: ["IMAGE", "VIDEO"] },
    },
    select: { id: true },
  });
  if (assets.length !== assetIds.length) {
    throw new McpToolError("asset_not_owned", "Asset não pertence ao Projeto/workspace autorizado do Flow.");
  }
}

async function listScopedProviderConnections(scope: Scope) {
  return prisma.providerConnection.findMany({
    where: { ownerId: scope.ownerId, workspaceId: scope.workspaceId },
    include: { capabilities: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getCapabilities() {
  const scope = await localScope();
  return database("carregar as capabilities locais", async () => {
    const [connections, readiness] = await Promise.all([
      listScopedProviderConnections(scope),
      getStagingReadiness().catch(() => null),
    ]);
    return {
      schemaVersion: MCP_SCHEMA_VERSION,
      scope: {
        mode: "local_default" as const,
        workspaceId: scope.workspaceId,
        ownerSource: "getOwnedExecutionScope",
      },
      drafts: { create: true, save: true },
      execution: {
        estimate: true,
        run: false,
        reason: "start_run não é exposto no MCP local; execução permanece bloqueada.",
      },
      readiness: readiness ? {
        executionAllowed: false,
        executor: readiness.executor.status,
        worker: readiness.worker.status,
      } : { executionAllowed: false },
      providers: connections.map((connection) => ({
        id: connection.id,
        provider: connection.provider,
        label: connection.label,
        authStatus: connection.authStatus,
        executorStatus: connection.executorStatus,
        generationValidationStatus: connection.generationValidationStatus,
        capabilities: connection.capabilities.map((capability) => ({
          key: capability.key,
          status: capability.status,
          evidence: capability.evidence ? sanitizePublicText(capability.evidence) : null,
        })),
      })),
      nodeTypes: listSerializableNodeDefinitions(),
    };
  });
}

export async function listProjectsTool(input: ListProjectsInput) {
  const scope = await localScope();
  return database("listar os Projetos do workspace local", async () => {
    const projects = await listProjects(scope);
    return {
      projects: projects
        .filter((project) => !input.status || project.status === input.status)
        .slice(0, input.limit)
        .map(publicProject),
      scope: "local_default" as const,
    };
  });
}

export async function getProjectTool(input: GetProjectInput) {
  const scope = await localScope();
  return database("carregar o Projeto solicitado", async () => {
    const project = await getProject(input.projectId, scope);
    if (!project) throw new McpToolError("project_not_found", "Projeto não encontrado.", 404);
    return { project: publicProject(project), scope: "local_default" as const };
  });
}

export async function listAssetsTool(input: ListAssetsInput) {
  const scope = await localScope();
  return database("listar os Assets do Projeto", async () => {
    const assets = await listProjectAssets(input.projectId, scope);
    if (!assets) throw new McpToolError("project_not_found", "Projeto não encontrado.", 404);
    return {
      projectId: input.projectId,
      assets: assets
        .filter((asset) => !input.role || asset.projectRole === input.role)
        .map((asset) => ({
          assetId: asset.assetId,
          type: asset.type,
          origin: asset.origin,
          projectRole: asset.projectRole ?? null,
          contentType: asset.contentType,
          sizeBytes: asset.sizeBytes,
          width: asset.width,
          height: asset.height,
          // URLs de storage não são expostas pelo transporte MCP local.
          url: null,
        })),
    };
  });
}

export async function getFlowTool(input: GetFlowInput) {
  await localScope();
  return database("carregar o Flow solicitado", async () => {
    const flow = await getOwnedFlow(input.flowId);
    if (!flow) throw new McpToolError("flow_not_found", "Flow não encontrado.", 404);
    return { flow: publicFlow(flow as StoredFlow), scope: "local_default" as const };
  });
}

export async function createFlowDraftTool(input: CreateFlowDraftInput): Promise<DraftResult> {
  const scope = await localScope();
  const key = scopeKey(scope, input.idempotencyKey);
  const previous = localDraftIdempotency.get(key);
  if (previous) return previous;

  const result = await database("criar o Flow draft", async () => {
    const project = await createProject({
      ...scope,
      name: input.intent.name,
      type: "VIDEO",
      objective: input.intent.objective,
      aspectRatio: input.intent.aspectRatio,
      durationSeconds: input.intent.durationSeconds,
      status: "DRAFT",
      flowTemplate: input.template,
    });
    const primaryFlow = project.primaryFlow;
    if (!primaryFlow?.id || !primaryFlow.projectId) {
      throw new McpToolError("draft_incomplete", "O Projeto foi criado sem Flow principal vinculado.", 503);
    }
    const graph = applyDraftIntent(parseStoredFlowGraph(primaryFlow.graph as Prisma.JsonValue), input.intent);
    ensureFlowGraph(graph);
    const savedFlow = await saveOwnedGraph(primaryFlow.id, scope, primaryFlow.name, graph);
    const savedProject = await getProject(project.id, scope);
    if (!savedProject) throw new McpToolError("draft_incomplete", "O Projeto draft não pôde ser recarregado.", 503);
    return {
      draftStatus: "draft" as const,
      generationStarted: false as const,
      project: publicProject(savedProject),
      flow: publicFlow(savedFlow),
    };
  });
  localDraftIdempotency.set(key, result);
  return result;
}

export async function saveFlowDraftTool(input: SaveFlowDraftInput) {
  const scope = await localScope();
  const key = scopeKey(scope, input.idempotencyKey);
  const previous = localSaveIdempotency.get(key);
  if (previous) return previous;

  const result = await database("salvar o Flow draft", async () => {
    const flow = await getOwnedFlow(input.flowId);
    if (!flow) throw new McpToolError("flow_not_found", "Flow não encontrado.", 404);
    const current = publicFlow(flow as StoredFlow);
    if (input.expectedGraphHash && current.graphHash !== input.expectedGraphHash) {
      throw new McpToolError("graph_conflict", "O Flow foi alterado; expectedGraphHash não corresponde à revisão atual.", 409);
    }
    const graph = input.graph as unknown as FlowGraph;
    await assertGraphAssetsBelongToProject(flow as StoredFlow, scope, graph);
    ensureFlowGraph(graph);
    const saved = await saveOwnedGraph(input.flowId, scope, input.name, graph);
    return { ...publicFlow(saved), generationStarted: false as const };
  });
  const saved = { ...result, graphHash: result.graphHash };
  localSaveIdempotency.set(key, saved);
  return saved;
}

export async function estimateFlowTool(input: EstimateFlowInput) {
  const scope = await localScope();
  return database("estimar o Flow", async () => {
    const flow = await getOwnedFlow(input.flowId);
    if (!flow) throw new McpToolError("flow_not_found", "Flow não encontrado.", 404);
    const typedFlow = flow as StoredFlow;
    const graph = parseStoredFlowGraph(typedFlow.graph as Prisma.JsonValue);
    await assertOperationalGraphProviders({ graph, ownerId: scope.ownerId, workspaceId: scope.workspaceId });
    const cost = await estimateFlowCost(graph, {
      targetNodeId: input.targetNodeId ?? null,
      resolveProvider: createServerProviderResolver(scope),
    });
    const snapshot = buildExecutionSnapshot({
      ownerId: scope.ownerId,
      workspaceId: scope.workspaceId,
      flowId: input.flowId,
      targetNodeId: input.targetNodeId ?? null,
      graph,
      cost,
    });
    const snapshotHash = hashExecutionSnapshot(snapshot);
    const approvalRequired = cost.total.usd !== 0 || cost.total.brl !== 0;
    return {
      flowId: input.flowId,
      cost,
      approval: {
        required: approvalRequired,
        status: approvalRequired ? "pending" as const : "not_required" as const,
        expiresAt: null,
        snapshotHash,
      },
      execution: { generationStarted: false as const, runAllowed: false as const },
    };
  });
}

export function clearLocalMcpIdempotencyForTests() {
  localDraftIdempotency.clear();
  localSaveIdempotency.clear();
}
