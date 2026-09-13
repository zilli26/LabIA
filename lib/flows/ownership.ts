import { prisma } from "@/lib/db/prisma";
import { getLocalOwnerId } from "@/lib/provider-connections/security";

const DEFAULT_WORKSPACE_SLUG = process.env.DEFAULT_WORKSPACE_SLUG ?? "felipe-labia";

async function ensureOwnedWorkspace() {
  return prisma.workspace.upsert({
    where: { slug: DEFAULT_WORKSPACE_SLUG },
    update: {},
    create: { name: "Felipe Zilli", slug: DEFAULT_WORKSPACE_SLUG },
  });
}

export async function getOwnedExecutionScope() {
  const [workspace, ownerId] = await Promise.all([ensureOwnedWorkspace(), Promise.resolve(getLocalOwnerId())]);
  return { workspaceId: workspace.id, ownerId };
}

export async function getOwnedFlow(flowId: string) {
  const { workspaceId } = await getOwnedExecutionScope();
  return prisma.flow.findFirst({ where: { id: flowId, workspaceId } });
}

export async function getOwnedBrand(brandId: string) {
  const { workspaceId } = await getOwnedExecutionScope();
  return prisma.brand.findFirst({ where: { id: brandId, workspaceId } });
}

export async function getOwnedFlowRun(flowRunId: string) {
  const { workspaceId } = await getOwnedExecutionScope();
  return prisma.flowRun.findFirst({ where: { id: flowRunId, workspaceId } });
}

export async function getOwnedGeneration(generationId: string) {
  const { workspaceId } = await getOwnedExecutionScope();
  return prisma.generation.findFirst({ where: { id: generationId, workspaceId }, include: { assets: true } });
}

export async function getOwnedConnection(connectionId: string) {
  const { workspaceId, ownerId } = await getOwnedExecutionScope();
  return prisma.providerConnection.findFirst({ where: { id: connectionId, workspaceId, ownerId }, include: { capabilities: true } });
}

export async function assertOwnedFlowBrand(brandId: string | null | undefined, workspaceId: string) {
  if (!brandId) return;
  const brand = await prisma.brand.findFirst({ where: { id: brandId, workspaceId }, select: { id: true } });
  if (!brand) throw new Error("Brand do Flow não pertence ao workspace autorizado.");
}

type OwnershipRepository = {
  flow(id: string): Promise<{ id: string; workspaceId: string } | null>;
  brand(id: string): Promise<{ id: string; workspaceId: string } | null>;
  flowRun(id: string): Promise<{ id: string; workspaceId: string; flowId?: string } | null>;
  connection(id: string): Promise<{ id: string; workspaceId: string; ownerId?: string; provider?: string } | null>;
  flowRunNode?(flowRunId: string, nodeId: string): Promise<{ nodeId: string } | null>;
};

export async function assertOwnedExecutionReferences(input: {
  ownerId: string;
  workspaceId: string;
  flowId?: string;
  brandId?: string;
  flowRunId?: string;
  flowNodeId?: string;
  connectionId?: string;
  providerId?: string;
  repository: OwnershipRepository;
}) {
  if (input.flowId) {
    const flow = await input.repository.flow(input.flowId);
    if (!flow || flow.workspaceId !== input.workspaceId) throw new Error("Flow não pertence ao workspace autorizado.");
  }
  if (input.brandId) {
    const brand = await input.repository.brand(input.brandId);
    if (!brand || brand.workspaceId !== input.workspaceId) throw new Error("Brand não pertence ao workspace autorizado.");
  }
  if (input.flowRunId) {
    const flowRun = await input.repository.flowRun(input.flowRunId);
    if (!flowRun || flowRun.workspaceId !== input.workspaceId || (input.flowId && flowRun.flowId !== input.flowId)) throw new Error("FlowRun não pertence ao Flow/workspace autorizado.");
    if (flowRun?.flowId) {
      const flow = await input.repository.flow(flowRun.flowId);
      if (!flow || flow.workspaceId !== input.workspaceId) throw new Error("Flow do FlowRun não pertence ao workspace autorizado.");
    }
  }
  if (input.flowRunId && input.flowNodeId && input.repository.flowRunNode) {
    const node = await input.repository.flowRunNode(input.flowRunId, input.flowNodeId);
    if (!node) throw new Error("Nó não pertence ao FlowRun autorizado.");
  }
  if (input.connectionId) {
    const connection = await input.repository.connection(input.connectionId);
    if (!connection || connection.workspaceId !== input.workspaceId || connection.ownerId !== input.ownerId || (input.providerId && connection.provider !== input.providerId)) throw new Error("Conexão não pertence ao owner/workspace/provider autorizado.");
  }
}
