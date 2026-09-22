import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  createFlowDraftInputSchema,
  estimateFlowInputSchema,
  getCapabilitiesInputSchema,
  getFlowInputSchema,
  getProjectInputSchema,
  listAssetsInputSchema,
  listProjectsInputSchema,
  saveFlowDraftInputSchema,
  type CreateFlowDraftInput,
  type EstimateFlowInput,
  type GetFlowInput,
  type GetProjectInput,
  type ListAssetsInput,
  type ListProjectsInput,
  type SaveFlowDraftInput,
} from "./schemas";
import {
  createFlowDraftTool,
  estimateFlowTool,
  getCapabilities,
  getFlowTool,
  getProjectTool,
  listAssetsTool,
  listProjectsTool,
  McpToolError,
  saveFlowDraftTool,
} from "./service";

export const LABIA_MCP_SERVER_INFO = {
  name: "labia-local",
  version: "0.1.0",
} as const;

type ToolResult = Record<string, unknown>;

export type LabiaMcpService = {
  getCapabilities: typeof getCapabilities;
  listProjects: (input: ListProjectsInput) => ReturnType<typeof listProjectsTool>;
  getProject: (input: GetProjectInput) => ReturnType<typeof getProjectTool>;
  listAssets: (input: ListAssetsInput) => ReturnType<typeof listAssetsTool>;
  getFlow: (input: GetFlowInput) => ReturnType<typeof getFlowTool>;
  createFlowDraft: (input: CreateFlowDraftInput) => ReturnType<typeof createFlowDraftTool>;
  saveFlowDraft: (input: SaveFlowDraftInput) => ReturnType<typeof saveFlowDraftTool>;
  estimateFlow: (input: EstimateFlowInput) => ReturnType<typeof estimateFlowTool>;
};

export const defaultLabiaMcpService: LabiaMcpService = {
  getCapabilities,
  listProjects: listProjectsTool,
  getProject: getProjectTool,
  listAssets: listAssetsTool,
  getFlow: getFlowTool,
  createFlowDraft: createFlowDraftTool,
  saveFlowDraft: saveFlowDraftTool,
  estimateFlow: estimateFlowTool,
};

function success(value: ToolResult) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function failure(error: unknown) {
  const message = error instanceof McpToolError
    ? error.message
    : "Não foi possível concluir a operação MCP local.";
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }, null, 2) }],
  };
}

export function createLabiaMcpServer(service: LabiaMcpService = defaultLabiaMcpService) {
  const server = new McpServer(LABIA_MCP_SERVER_INFO);

  server.registerTool("get_capabilities", {
    description: "Lista capabilities do LabIA local. Execução e start_run permanecem bloqueados.",
    inputSchema: getCapabilitiesInputSchema,
  }, async () => {
    try {
      return success(await service.getCapabilities());
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("list_projects", {
    description: "Lista Projetos pertencentes somente ao workspace local resolvido pelo LabIA.",
    inputSchema: listProjectsInputSchema,
  }, async (input) => {
    try {
      return success(await service.listProjects(input));
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("get_project", {
    description: "Lê um Projeto do workspace local, sem aceitar ownerId ou workspaceId enviados pelo cliente.",
    inputSchema: getProjectInputSchema,
  }, async (input) => {
    try {
      return success(await service.getProject(input));
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("list_assets", {
    description: "Lista Assets de um Projeto local; URLs de storage não são expostas pelo MCP.",
    inputSchema: listAssetsInputSchema,
  }, async (input) => {
    try {
      return success(await service.listAssets(input));
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("get_flow", {
    description: "Lê o grafo real de um Flow pertencente ao workspace local.",
    inputSchema: getFlowInputSchema,
  }, async (input) => {
    try {
      return success(await service.getFlow(input));
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("create_flow_draft", {
    description: "Cria um Projeto e Flow draft sem gerar mídia e sempre retorna generationStarted=false.",
    inputSchema: createFlowDraftInputSchema,
  }, async (input) => {
    try {
      return success(await service.createFlowDraft(input));
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("save_flow_draft", {
    description: "Valida e salva um grafo draft; nunca inicia geração.",
    inputSchema: saveFlowDraftInputSchema,
  }, async (input) => {
    try {
      return success(await service.saveFlowDraft(input));
    } catch (error) {
      return failure(error);
    }
  });

  server.registerTool("estimate_flow", {
    description: "Calcula uma estimativa atual do Flow sem criar execução ou iniciar geração.",
    inputSchema: estimateFlowInputSchema,
  }, async (input) => {
    try {
      return success(await service.estimateFlow(input));
    } catch (error) {
      return failure(error);
    }
  });

  return server;
}
