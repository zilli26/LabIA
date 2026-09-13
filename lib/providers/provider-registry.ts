import { FalProvider } from "./fal";
import { prisma } from "@/lib/db/prisma";
import { OpenAiCodexImageProvider } from "./openai-codex-image";
import type { ModelProvider } from "./model-provider";
import type { FlowGraph } from "@/lib/flows/graph";

type ScopedProviderRegistration = {
  providerId: string;
  connectionId: string;
  provider: ModelProvider;
};

export type ServerProviderResolver = (input: {
  providerId: string;
  connectionId?: string;
}) => Promise<ModelProvider>;

export class ModelProviderRegistry {
  private readonly scoped = new Map<string, ModelProvider>();
  private readonly legacy = new Map<string, ModelProvider>();

  register(registration: ScopedProviderRegistration) {
    const key = `${registration.providerId}:${registration.connectionId}`;
    if (this.scoped.has(key)) {
      throw new Error(`Provider já registrado para a conexão: ${key}`);
    }
    if (registration.provider.id !== registration.providerId) {
      throw new Error("Provider registrado com id incompatível.");
    }
    this.scoped.set(key, registration.provider);
  }

  registerLegacy(providerId: string, provider: ModelProvider) {
    if (provider.id !== providerId) {
      throw new Error("Provider legado registrado com id incompatível.");
    }
    this.legacy.set(providerId, provider);
  }

  resolve(providerId: string, connectionId?: string) {
    if (connectionId) {
      const provider = this.scoped.get(`${providerId}:${connectionId}`);
      if (!provider) {
        throw new Error(`Conexão não registrada para o provider ${providerId}.`);
      }
      return provider;
    }

    const provider = this.legacy.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} não registrado sem conexão.`);
    }
    return provider;
  }
}

export const modelProviderRegistry = new ModelProviderRegistry();
modelProviderRegistry.registerLegacy("fal", new FalProvider());

export function resolveModelProvider({
  registry = modelProviderRegistry,
  providerId,
  connectionId,
  legacyProvider,
}: {
  registry?: ModelProviderRegistry;
  providerId?: string;
  connectionId?: string;
  legacyProvider?: string;
}) {
  const selectedProvider = providerId?.trim() || legacyProvider?.trim();
  if (!selectedProvider) {
    throw new Error("Provider não selecionado para o nó.");
  }

  return registry.resolve(selectedProvider, connectionId);
}

export async function resolveServerModelProvider({
  ownerId,
  workspaceId,
  providerId,
  connectionId,
}: {
  ownerId: string;
  workspaceId: string;
  providerId: string;
  connectionId?: string;
}): Promise<ModelProvider> {
  if (!connectionId && providerId === "fal") {
    return modelProviderRegistry.resolve("fal");
  }

  if (!connectionId) {
    throw new Error(`Conexão obrigatória para o provider ${providerId}.`);
  }

  const connection = await prisma.providerConnection.findFirst({
    where: { id: connectionId, ownerId, workspaceId, provider: providerId },
  });
  if (!connection || connection.ownerId !== ownerId || connection.workspaceId !== workspaceId || connection.provider !== providerId) {
    throw new Error("Conexão não pertence ao owner/workspace ou provider selecionado.");
  }
  if (connection.authStatus !== "connected" || connection.executorStatus !== "online") {
    throw new Error("Conexão ou executor indisponível para execução.");
  }

  if (providerId === "openai") return new OpenAiCodexImageProvider({ sessionRef: connection.sessionRef });
  if (providerId === "fal") return modelProviderRegistry.resolve("fal");
  throw new Error(`Provider operacional não registrado: ${providerId}.`);
}

export function createServerProviderResolver({ ownerId, workspaceId }: { ownerId: string; workspaceId: string }): ServerProviderResolver {
  return ({ providerId, connectionId }) => resolveServerModelProvider({ ownerId, workspaceId, providerId, connectionId });
}

export async function assertOperationalGraphProviders({
  graph,
  ownerId,
  workspaceId,
}: { graph: FlowGraph; ownerId: string; workspaceId: string }) {
  for (const node of graph.nodes) {
    if (!["image-generation", "video-generation", "video-extend", "text2video"].includes(node.data.kind)) continue;
    const params = node.data.params ?? {};
    const providerId = typeof params.providerId === "string" ? params.providerId : "fal";
    const connectionId = typeof params.connectionId === "string" ? params.connectionId : undefined;
    const provider = connectionId
      ? await resolveServerModelProvider({ ownerId, workspaceId, providerId, connectionId })
      : providerId === "openai"
        ? await resolveServerModelProvider({ ownerId, workspaceId, providerId, connectionId })
        : null;
    if (provider) {
      provider.estimateCost(typeof params.model === "string" ? params.model : "", { ...params, prompt: typeof params.prompt === "string" ? params.prompt : "placeholder" });
    }
  }
}
