"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type NodeTypes,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react";
import {
  Clapperboard,
  Film,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Play,
  Plus,
  Save,
  Search,
  StickyNote,
  UploadCloud,
} from "lucide-react";

import {
  VideoCostConfirmModal,
  type VideoCostConfirmItem,
} from "@/components/flows/video-cost-confirm-modal";
import { LabFlowNodeComponent } from "@/components/nodes/lab-flow-node";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  starterFlowGraph,
  type FlowGraph,
  type LabFlowNode,
  type LabNodeKind,
} from "@/lib/flows/graph";
import { countConsecutiveVideoExtends } from "@/lib/flows/video-chain";
import type { SerializableNodeDefinition } from "@/lib/flows/types";
import { cn } from "@/lib/utils";
import { PAID_VIDEO_KINDS } from "@/lib/flows/video-cost-gate";

type FlowRecord = {
  id: string;
  name: string;
  graph: FlowGraph;
  updatedAt: string;
  projectId?: string | null;
};

type FlowResponse = {
  flow: FlowRecord;
};

type CostResponse = {
  cost: {
    total: {
      brl: number;
    };
    nodes: Array<{
      nodeId: string;
      type: string;
      estimatedCost: {
        brl: number;
      };
    }>;
  };
  confirmation?: { token: string; expiresAt: number };
};

type FlowRunResponse = {
  flowRun: {
    id: string;
    status: string;
    nodes: Array<{
      nodeId: string;
      type: string;
      status: string;
      outputs: unknown;
      error: string | null;
      estimatedCost: {
        brl: number;
      };
      actualCost: {
        brl: number;
      };
    }>;
  };
};

type LatestFlowRunResponse = {
  flowRun: FlowRunResponse["flowRun"] | null;
};

type GenerationResponse = {
  generation: {
    id: string;
    status: string;
    model: string;
    prompt: string;
    actualCostBrl: number | null;
    errorMessage: string | null;
    assets: Array<{
      id: string;
      url: string;
      width: number | null;
      height: number | null;
    }>;
  };
};

type CostConfirmState = {
  open: boolean;
  isLoading: boolean;
  cost: CostResponse["cost"] | null;
  errorMessage: string | null;
  confirmationToken: string | null;
};

const nodeTypes = {
  labNode: LabFlowNodeComponent,
} satisfies NodeTypes;

const nodeIcons: Record<LabNodeKind, typeof FileText> = {
  "text-input": FileText,
  "asset-input": UploadCloud,
  prompt: MessageSquareText,
  "image-generation": ImageIcon,
  "video-generation": Clapperboard,
  "video-extend": Clapperboard,
  "video-assembly": Film,
  text2video: Clapperboard,
  note: StickyNote,
  "asset-output": UploadCloud,
};

const fallbackAddableNodes: SerializableNodeDefinition[] = [
  {
    type: "text-input",
    label: "Texto",
    description: "Briefing, prompt ou contexto.",
    inputs: [],
    outputs: [],
    ui: { componentKey: "labNode", kind: "text-input" },
  },
  {
    type: "prompt",
    label: "Prompt",
    description: "Prompt estruturado para imagem.",
    inputs: [],
    outputs: [],
    ui: { componentKey: "labNode", kind: "prompt" },
  },
  {
    type: "asset-input",
    label: "Asset importado",
    description: "Selecione imagem ou vídeo já importado no Projeto.",
    inputs: [],
    outputs: [
      { id: "image", label: "Imagem", type: "image" },
      { id: "video", label: "Vídeo", type: "video" },
    ],
    ui: { componentKey: "labNode", kind: "asset-input" },
  },
  {
    type: "image-generation",
    label: "Gerar Imagem",
    description: "Modelo fal.ai com custo visível.",
    inputs: [],
    outputs: [],
    ui: { componentKey: "labNode", kind: "image-generation" },
  },
  {
    type: "note",
    label: "Nota",
    description: "Anotação livre no fluxo.",
    inputs: [],
    outputs: [],
    ui: { componentKey: "labNode", kind: "note" },
  },
  {
    type: "asset-output",
    label: "Saída",
    description: "Destino do resultado.",
    inputs: [],
    outputs: [],
    ui: { componentKey: "labNode", kind: "asset-output" },
  },
];

const paidVideoKindSet = new Set<string>(PAID_VIDEO_KINDS);

type CreateAction = {
  id: string;
  label: string;
  description: string;
  kind: LabNodeKind;
  icon: typeof FileText;
};

const createActionSections: Array<{
  label: string;
  actions: CreateAction[];
}> = [
  {
    label: "Criar",
    actions: [
      {
        id: "prompt",
        label: "Prompt",
        description: "Escreva a intenção do próximo passo.",
        kind: "prompt",
        icon: MessageSquareText,
      },
      {
        id: "image-generation",
        label: "Gerar imagem",
        description: "Crie uma imagem com custo visível.",
        kind: "image-generation",
        icon: ImageIcon,
      },
      {
        id: "video-generation",
        label: "Animar imagem",
        description: "Transforme uma imagem em clipe.",
        kind: "video-generation",
        icon: Clapperboard,
      },
      {
        id: "import-base-image",
        label: "Importar imagem-base",
        description: "Adicione JPG, PNG ou WebP ao Projeto.",
        kind: "asset-input",
        icon: UploadCloud,
      },
    ],
  },
  {
    label: "Projeto",
    actions: [
      {
        id: "project-assets",
        label: "Assets do Projeto",
        description: "Escolha uma fonte já importada.",
        kind: "asset-input",
        icon: UploadCloud,
      },
    ],
  },
  {
    label: "Pós-produção",
    actions: [
      {
        id: "video-extend",
        label: "Continuar clipe",
        description: "Continue uma cena a partir do último frame.",
        kind: "video-extend",
        icon: Clapperboard,
      },
      {
        id: "video-assembly",
        label: "Juntar clipes",
        description: "Feche um vídeo com várias cenas.",
        kind: "video-assembly",
        icon: Film,
      },
    ],
  },
  {
    label: "Direção",
    actions: [],
  },
];

const compatibilityActions: CreateAction[] = [
  {
    id: "note",
    label: "Nota",
    description: "Anotação livre no fluxo.",
    kind: "note",
    icon: StickyNote,
  },
];

const priorityCreateActionIds = new Set(["import-base-image", "project-assets"]);

const assetInputDefinition: SerializableNodeDefinition = {
  type: "asset-input",
  label: "Asset importado",
  description: "Conecte este Asset à entrada de Animar imagem.",
  inputs: [],
  outputs: [
    { id: "image", label: "Imagem", type: "image" },
    { id: "video", label: "Vídeo", type: "video" },
  ],
  ui: { componentKey: "labNode", kind: "asset-input" },
};

type CanvasProjectAsset = {
  assetId: string;
  type: string;
  projectRole?: string;
};

type PendingProjectAction = "import-base-image" | "project-assets" | null;

function CreateActionButton({
  action,
  onSelect,
  disabled = false,
  priority = false,
}: {
  action: CreateAction;
  onSelect: (action: CreateAction) => void;
  disabled?: boolean;
  priority?: boolean;
}) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      data-action={action.id}
      data-priority={priority ? "true" : undefined}
      disabled={disabled}
      onClick={() => onSelect(action)}
      className={cn(
        "group flex min-w-0 items-center gap-2.5 rounded-control border border-lab-border bg-lab-surface-2 text-left transition-colors hover:border-lab-border-strong hover:bg-lab-bg focus-visible:outline-none focus-visible:shadow-lab-focus disabled:cursor-wait disabled:opacity-60",
        priority ? "p-2.5" : "p-2",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-control border border-lab-border bg-lab-surface-1 text-lab-text-dim transition-colors group-hover:text-lab-reagent-bright",
          priority && "border-lab-border-strong text-lab-reagent",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-lab-text">{action.label}</span>
        <span className="block truncate text-[11px] leading-4 text-lab-text-muted">
          {action.description}
        </span>
      </span>
      {action.id !== "project-assets" ? (
        <Plus className="size-4 shrink-0 text-lab-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      ) : null}
    </button>
  );
}

function formatBrl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function isLabNodeKind(kind: string): kind is LabNodeKind {
  return kind in nodeIcons;
}

function getDefaultParams(kind: LabNodeKind) {
  if (kind === "prompt") {
    return { prompt: "" };
  }

  if (kind === "asset-input") {
    return { assetId: "", projectRole: "source", pending: true };
  }

  if (kind === "image-generation") {
    return { model: "fal-ai/flux/dev" };
  }

  if (kind === "video-generation") {
    return {
      model: "fal-ai/wan-25-preview/image-to-video",
      prompt: "",
      duration: "5",
      resolution: "1080p",
    };
  }

  if (kind === "video-extend") {
    return {
      model: "fal-ai/wan-25-preview/image-to-video",
      prompt: "",
      sceneContext: "",
      duration: "5",
      resolution: "1080p",
    };
  }

  if (kind === "video-assembly") {
    return {};
  }

  if (kind === "text2video") {
    return {
      model: "fal-ai/wan-25-preview/image-to-video",
      prompt: "",
      duration: "5",
      resolution: "1080p",
    };
  }

  return undefined;
}

function createNode(
  definition: SerializableNodeDefinition,
  position: { x: number; y: number },
  projectId?: string,
) {
  const kind = isLabNodeKind(definition.ui.kind)
    ? definition.ui.kind
    : "note";
  const suffix = crypto.randomUUID().slice(0, 8);

  return {
    id: `${kind}-${suffix}`,
    type: "labNode",
    position,
    data: {
      kind,
      title: definition.label ?? "Nó",
      description: definition.description ?? "Nó do fluxo.",
      status: "idle",
      params: {
        ...(getDefaultParams(kind) ?? {}),
        ...(kind === "asset-input" && projectId ? { projectId } : {}),
      },
    },
  } satisfies LabFlowNode;
}

function createActionDefinition(action: CreateAction): SerializableNodeDefinition {
  if (action.kind === "asset-input") {
    return {
      ...assetInputDefinition,
      label: action.label,
      description: action.description,
    };
  }

  return {
    type: action.kind,
    label: action.label,
    description: action.description,
    inputs: [],
    outputs: [],
    ui: { componentKey: "labNode", kind: action.kind },
  };
}

const NEW_NODE_WIDTH = 256;
const NEW_NODE_HEIGHT = 480;
const NEW_NODE_GAP = 32;

type NodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getNodeRect(node: LabFlowNode): NodeRect {
  const measured = (node as LabFlowNode & { measured?: { width?: number; height?: number } }).measured;
  const dimensions = node as LabFlowNode & { width?: number; height?: number };

  return {
    x: node.position.x,
    y: node.position.y,
    width: measured?.width ?? dimensions.width ?? NEW_NODE_WIDTH,
    height: measured?.height ?? dimensions.height ?? NEW_NODE_HEIGHT,
  };
}

function overlapsWithGap(candidate: NodeRect, existing: NodeRect) {
  return (
    candidate.x < existing.x + existing.width + NEW_NODE_GAP &&
    candidate.x + candidate.width + NEW_NODE_GAP > existing.x &&
    candidate.y < existing.y + existing.height + NEW_NODE_GAP &&
    candidate.y + candidate.height + NEW_NODE_GAP > existing.y
  );
}

function findFreeNodePosition(
  nodes: LabFlowNode[],
  anchor: { x: number; y: number },
) {
  const existingRects = nodes.map(getNodeRect);
  const cellWidth =
    Math.max(NEW_NODE_WIDTH, ...existingRects.map((rect) => rect.width)) +
    NEW_NODE_GAP;
  const cellHeight =
    Math.max(NEW_NODE_HEIGHT, ...existingRects.map((rect) => rect.height)) +
    NEW_NODE_GAP;
  const origin = {
    x: anchor.x - NEW_NODE_WIDTH / 2,
    y: anchor.y - NEW_NODE_HEIGHT / 2,
  };

  for (let radius = 0; radius <= nodes.length + 1; radius += 1) {
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== radius) {
          continue;
        }

        const candidate = {
          x: origin.x + x * cellWidth,
          y: origin.y + y * cellHeight,
          width: NEW_NODE_WIDTH,
          height: NEW_NODE_HEIGHT,
        };

        if (!existingRects.some((rect) => overlapsWithGap(candidate, rect))) {
          return { x: candidate.x, y: candidate.y };
        }
      }
    }
  }

  return origin;
}

function getRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function getCanvasConnectionFeedback(
  graph: FlowGraph,
  connection: Connection,
) {
  if (!connection.source || !connection.target) {
    return "Selecione origem e destino para conectar os nós.";
  }

  const sourceNode = graph.nodes.find((node) => node.id === connection.source);
  const targetNode = graph.nodes.find((node) => node.id === connection.target);

  if (!sourceNode || !targetNode) {
    return "Nó de origem ou destino não existe no grafo.";
  }

  const sourceType = getCanvasPortType(
    sourceNode.data.kind,
    "source",
    connection.sourceHandle,
  );
  const targetType = getCanvasPortType(
    targetNode.data.kind,
    "target",
    connection.targetHandle,
  );

  if (!sourceType || !targetType) {
    return "Porta de origem ou destino não existe.";
  }

  return sourceType === "any" || targetType === "any" || sourceType === targetType
    ? null
    : `Saída ${sourceType} não conecta em entrada ${targetType}.`;
}

function getCanvasPortType(
  kind: LabNodeKind,
  direction: "source" | "target",
  handleId: string | null | undefined,
) {
  if (kind === "asset-input" && direction === "source") {
    return handleId === "video" ? "video" : handleId === "image" ? "image" : undefined;
  }

  if (direction === "target") {
    if (kind === "image-generation" || kind === "text2video") return "text";
    if (kind === "video-generation") return "image";
    if (kind === "video-extend" || kind === "video-assembly") return "video";
    if (kind === "asset-output" || kind === "note") return "any";
    return undefined;
  }

  if (kind === "text-input" || kind === "prompt") return "text";
  if (kind === "image-generation") return "image";
  if (kind === "video-generation" || kind === "video-extend" || kind === "video-assembly" || kind === "text2video") return "video";
  if (kind === "note") return "any";
  return undefined;
}

function FlowCanvasInner({ flowId }: { flowId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<LabFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [flowName, setFlowName] = useState("Novo experimento");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isNodeMenuOpen, setIsNodeMenuOpen] = useState(false);
  const [createSearch, setCreateSearch] = useState("");
  const [isImportingAsset, setIsImportingAsset] = useState(false);
  const [isProjectAssetPickerOpen, setIsProjectAssetPickerOpen] = useState(false);
  const [projectAssets, setProjectAssets] = useState<CanvasProjectAsset[]>([]);
  const [projectAssetsError, setProjectAssetsError] = useState<string | null>(null);
  const [pendingProjectAction, setPendingProjectAction] = useState<PendingProjectAction>(null);
  const [isCreatingProjectForFlow, setIsCreatingProjectForFlow] = useState(false);
  const [flowProjectName, setFlowProjectName] = useState("");
  const [flowProjectObjective, setFlowProjectObjective] = useState("");
  const [flowProjectError, setFlowProjectError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [costLabel, setCostLabel] = useState("~R$ 0,00");
  const [costConfirm, setCostConfirm] = useState<CostConfirmState>({
    open: false,
    isLoading: false,
    cost: null,
    errorMessage: null,
    confirmationToken: null,
  });
  const costConfirmRequestRef = useRef(0);
  const flowLoadedRef = useRef(false);
  const flowProjectIdRef = useRef<string | undefined>(undefined);
  const ensureProjectPromiseRef = useRef<Promise<string> | null>(null);
  const assetFileInputRef = useRef<HTMLInputElement>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [flowProjectId, setFlowProjectId] = useState<string | undefined>();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const { fitView, getViewport, screenToFlowPosition, setViewport } =
    useReactFlow<LabFlowNode, Edge>();
  const normalizedCreateSearch = createSearch.trim().toLocaleLowerCase("pt-BR");
  const matchesCreateSearch = useCallback(
    (action: CreateAction) =>
      !normalizedCreateSearch ||
      `${action.label} ${action.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedCreateSearch),
    [normalizedCreateSearch],
  );
  const priorityCreateActions = useMemo(
    () =>
      createActionSections
        .flatMap((section) => section.actions)
        .filter((action) => priorityCreateActionIds.has(action.id) && matchesCreateSearch(action)),
    [matchesCreateSearch],
  );
  const visibleCreateSections = useMemo(
    () =>
      createActionSections
        .map((section) => ({
          ...section,
          actions: section.actions.filter(
            (action) =>
              !priorityCreateActionIds.has(action.id) && matchesCreateSearch(action),
          ),
        }))
        .filter(
          (section) =>
            section.actions.length > 0 ||
            (section.label === "Direção" && !normalizedCreateSearch),
        ),
    [matchesCreateSearch, normalizedCreateSearch],
  );
  const visibleCompatibilityActions = useMemo(
    () => compatibilityActions.filter(matchesCreateSearch),
    [matchesCreateSearch],
  );
  const nodesWithExtendDepth = useMemo(
    () =>
      nodes.map((node) => {
        if (node.data.kind !== "video-extend") {
          return node;
        }

        const extendChainDepth = countConsecutiveVideoExtends({
          nodes,
          edges,
          nodeId: node.id,
        });

        if (node.data.extendChainDepth === extendChainDepth) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            extendChainDepth,
          },
        };
      }),
    [edges, nodes],
  );
  const costConfirmItems = useMemo<VideoCostConfirmItem[]>(() => {
    if (!costConfirm.cost) {
      return [];
    }

    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    return costConfirm.cost.nodes
      .filter((nodeCost) => paidVideoKindSet.has(nodeCost.type))
      .map((nodeCost) => {
        const node = nodesById.get(nodeCost.nodeId);

        return {
          nodeId: nodeCost.nodeId,
          label: node?.data.title ?? nodeCost.nodeId,
          kind: (node?.data.kind ?? nodeCost.type) as LabNodeKind,
          brl: nodeCost.estimatedCost.brl,
        };
      });
  }, [costConfirm.cost, nodes]);

  useEffect(() => {
    const markDirty = () => {
      setIsDirty(true);
      setRunMessage(null);
    };

    window.addEventListener("lab-flow-node-data-change", markDirty);
    return () => window.removeEventListener("lab-flow-node-data-change", markDirty);
  }, []);

  const fetchFlowCost = useCallback(
    async (graph: FlowGraph) => {
      const response = await fetch(`/api/flows/${flowId}/cost`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          graph,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Não foi possível estimar o custo do fluxo.");
      }

      return (await response.json()) as CostResponse;
    },
    [flowId],
  );

  const applyCostEstimate = useCallback(
    (payload: CostResponse) => {
      setCostLabel(`~${formatBrl(payload.cost.total.brl)}`);
      setNodes((currentNodes) => {
        const costByNodeId = new Map(
          payload.cost.nodes.map((node) => [node.nodeId, node.estimatedCost.brl]),
        );
        let changed = false;
        const nextNodes = currentNodes.map((node) => {
          const brl = costByNodeId.get(node.id) ?? 0;
          const nextCostLabel = brl > 0 ? `~${formatBrl(brl)}` : undefined;

          if (node.data.costLabel === nextCostLabel) {
            return node;
          }

          changed = true;
          return {
            ...node,
            data: {
              ...node.data,
              costLabel: nextCostLabel,
            },
          };
        });

        return changed ? nextNodes : currentNodes;
      });
    },
    [setNodes],
  );

  const estimateCost = useCallback(
    async (graph: FlowGraph) => {
      try {
        const payload = await fetchFlowCost(graph);
        applyCostEstimate(payload);
        return payload;
      } catch {
        return null;
      }
    },
    [applyCostEstimate, fetchFlowCost],
  );

  const loadFlow = useCallback(async () => {
    flowLoadedRef.current = false;
    setIsLoading(true);
    setErrorMessage(null);

    const response = await fetch(`/api/flows/${flowId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Não foi possível carregar o fluxo.");
    }

    const payload = (await response.json()) as FlowResponse;
    const graph = payload.flow.graph;

    setFlowName(payload.flow.name);
    setFlowProjectId(payload.flow.projectId ?? undefined);
    flowProjectIdRef.current = payload.flow.projectId ?? undefined;
    setNodes(
      graph.nodes.map((node) =>
        node.data.kind === "asset-input" && payload.flow.projectId
          ? {
              ...node,
              data: {
                ...node.data,
                params: {
                  ...(node.data.params ?? {}),
                  projectId: payload.flow.projectId,
                },
              },
            }
          : node,
      ),
    );
    setEdges(graph.edges);
    setIsDirty(false);
    flowLoadedRef.current = true;
    setLastSavedAt(
      new Date(payload.flow.updatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    void estimateCost(graph);

    if (graph.viewport) {
      setViewport(graph.viewport);
    } else {
      window.requestAnimationFrame(() => fitView({ padding: 0.18 }));
    }

    setIsLoading(false);
  }, [estimateCost, fitView, flowId, setEdges, setNodes, setViewport]);

  useEffect(() => {
    loadFlow().catch((error: Error) => {
      setNodes(starterFlowGraph.nodes);
      setEdges(starterFlowGraph.edges);
      setErrorMessage(error.message);
      setIsLoading(false);
    });
  }, [loadFlow, setEdges, setNodes]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const timer = window.setTimeout(() => {
      void estimateCost({
        nodes,
        edges,
        viewport: getViewport(),
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [edges, estimateCost, getViewport, isLoading, nodes]);

  const refreshGeneration = useCallback(
    async (generationId: string, nodeId: string, attempt = 0) => {
      const response = await fetch(`/api/generations/${generationId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as GenerationResponse;
      const asset = payload.generation.assets[0];

      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  status:
                    payload.generation.status.toLowerCase() as LabFlowNode["data"]["status"],
                  params: {
                    ...(node.data.params ?? {}),
                    generationId,
                    generationStatus: payload.generation.status.toLowerCase(),
                    model: payload.generation.model,
                    prompt: payload.generation.prompt,
                    assetUrl: asset?.url,
                    assetWidth: asset?.width,
                    assetHeight: asset?.height,
                    actualCostBrl: payload.generation.actualCostBrl ?? undefined,
                    errorMessage: payload.generation.errorMessage ?? undefined,
                  },
                },
              }
            : node,
        ),
      );

      if (
        !["DONE", "FAILED"].includes(payload.generation.status) &&
        attempt < 30
      ) {
        window.setTimeout(
          () => void refreshGeneration(generationId, nodeId, attempt + 1),
          2000,
        );
      }
    },
    [setNodes],
  );

  const applyRunState = useCallback(
    (flowRun: FlowRunResponse["flowRun"]) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const runNode = flowRun.nodes.find((item) => item.nodeId === node.id);

          if (!runNode) {
            return node;
          }

          const outputs = getRecord(runNode.outputs);
          const generationId =
            typeof outputs.generationId === "string"
              ? outputs.generationId
              : undefined;
          const output = getRecord(outputs.output);
          const assetId =
            typeof outputs.assetId === "string"
              ? outputs.assetId
              : typeof output.assetId === "string"
                ? output.assetId
                : undefined;
          const assetUrl =
            typeof outputs.url === "string"
              ? outputs.url
              : typeof output.url === "string"
                ? output.url
                : undefined;

          if (
            (node.data.kind === "image-generation" ||
              node.data.kind === "video-generation" ||
              node.data.kind === "video-extend" ||
              node.data.kind === "text2video") &&
            generationId
          ) {
            void refreshGeneration(generationId, node.id);
          }

          return {
            ...node,
            data: {
              ...node.data,
              status: runNode.status as LabFlowNode["data"]["status"],
              params: {
                ...(node.data.params ?? {}),
                generationId,
                queueJobId:
                  typeof outputs.queueJobId === "string"
                    ? outputs.queueJobId
                    : undefined,
                assetId,
                assetUrl,
                assemblyStatus:
                  node.data.kind === "video-assembly" && assetId
                    ? "done"
                    : undefined,
                generationStatus:
                  (node.data.kind === "image-generation" ||
                    node.data.kind === "video-generation" ||
                    node.data.kind === "video-extend" ||
                    node.data.kind === "text2video") &&
                  generationId
                    ? "queued"
                    : undefined,
                errorMessage: runNode.error ?? undefined,
              },
            },
          };
        }),
      );
    },
    [refreshGeneration, setNodes],
  );

  const pollRun = useCallback(
    async (runId: string, attempt = 0) => {
      const response = await fetch(`/api/flows/${flowId}/runs/${runId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as FlowRunResponse;
      applyRunState(payload.flowRun);

      if (!["done", "failed"].includes(payload.flowRun.status) && attempt < 20) {
        window.setTimeout(() => void pollRun(runId, attempt + 1), 1500);
      }
    },
    [applyRunState, flowId],
  );

  const rehydrateLatestRun = useCallback(async () => {
    const response = await fetch(`/api/flows/${flowId}/runs/latest`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as LatestFlowRunResponse;
    if (payload.flowRun) {
      applyRunState(payload.flowRun);

      if (!["done", "failed"].includes(payload.flowRun.status)) {
        void pollRun(payload.flowRun.id);
      }
    }
  }, [applyRunState, flowId, pollRun]);

  useEffect(() => {
    if (isLoading || !flowLoadedRef.current) {
      return;
    }

    void rehydrateLatestRun();
  }, [isLoading, rehydrateLatestRun]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const feedback = getCanvasConnectionFeedback(
        { nodes, edges },
        connection,
      );

      if (feedback) {
        setConnectionError(feedback);
        setRunMessage(null);
        return;
      }

      setConnectionError(null);
      setEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            id: `edge-${crypto.randomUUID()}`,
            type: "smoothstep",
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          },
          currentEdges,
        ),
      );
      setIsDirty(true);
      setRunMessage(null);
    },
    [edges, nodes, setEdges],
  );

  const handleAddNode = useCallback(
    (definition: SerializableNodeDefinition) => {
      const anchor = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      setNodes((currentNodes) => [
        ...currentNodes,
        createNode(
          definition,
          findFreeNodePosition(currentNodes, anchor),
          flowProjectId,
        ),
      ]);
      setIsDirty(true);
      setRunMessage(null);
      setIsNodeMenuOpen(false);
    },
    [flowProjectId, screenToFlowPosition, setNodes],
  );

  const fillProjectAssetNode = useCallback(
    (asset: CanvasProjectAsset, projectId: string) => {
      const assetParams = {
        assetId: asset.assetId,
        assetType: asset.type,
        projectId,
        projectRole: asset.projectRole ?? "source",
        pending: false,
      };

      setNodes((currentNodes) => {
        const withProjectId = currentNodes.map((node) =>
          node.data.kind === "asset-input"
            ? {
                ...node,
                data: {
                  ...node.data,
                  params: {
                    ...(node.data.params ?? {}),
                    projectId,
                  },
                },
              }
            : node,
        );
        const target = withProjectId.find((node) => {
          if (node.data.kind !== "asset-input") return false;
          const params = (node.data.params ?? {}) as Record<string, unknown>;
          return typeof params.assetId !== "string" || params.assetId.trim().length === 0;
        });

        if (target) {
          return withProjectId.map((node) =>
            node.id === target.id
              ? { ...node, data: { ...node.data, params: { ...(node.data.params ?? {}), ...assetParams } } }
              : node,
          );
        }

        const anchor = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const node = createNode(assetInputDefinition, findFreeNodePosition(withProjectId, anchor), projectId);
        return [
          ...withProjectId,
          { ...node, data: { ...node.data, params: { ...(node.data.params ?? {}), ...assetParams } } },
        ];
      });
      setIsDirty(true);
      setRunMessage(null);
      setIsNodeMenuOpen(false);
      setIsProjectAssetPickerOpen(false);
    },
    [screenToFlowPosition, setNodes],
  );

  const requestProjectForFlow = useCallback((action: Exclude<PendingProjectAction, null>) => {
    setPendingProjectAction(action);
    setFlowProjectName(flowName.trim() || "Novo Projeto");
    setFlowProjectObjective("");
    setFlowProjectError(null);
    setProjectAssetsError(null);
    setIsProjectAssetPickerOpen(action === "project-assets");
  }, [flowName]);

  const loadProjectAssets = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/assets`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        assets?: CanvasProjectAsset[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível carregar os Assets do Projeto.");
      }

      setProjectAssets(
        (payload.assets ?? []).filter((asset) =>
          ["IMAGE", "VIDEO"].includes(asset.type.toUpperCase()),
        ),
      );
    } catch (error) {
      setProjectAssetsError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os Assets do Projeto.",
      );
    }
  }, []);

  const openProjectAssetPicker = useCallback(async () => {
    if (!flowProjectId) {
      requestProjectForFlow("project-assets");
      return;
    }

    setProjectAssetsError(null);
    setIsProjectAssetPickerOpen(true);
    await loadProjectAssets(flowProjectId);
  }, [flowProjectId, loadProjectAssets, requestProjectForFlow]);

  const ensureFlowProject = useCallback(async () => {
    const knownProjectId = flowProjectIdRef.current ?? flowProjectId;
    if (knownProjectId) return knownProjectId;

    if (!ensureProjectPromiseRef.current) {
      ensureProjectPromiseRef.current = (async () => {
        const response = await fetch(`/api/flows/${flowId}/project`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: flowName.trim() || "Novo Projeto", objective: "" }),
        });
        const payload = (await response.json()) as { flow?: { projectId?: string }; error?: string };
        if (!response.ok || !payload.flow?.projectId) {
          throw new Error(payload.error ?? "Não foi possível criar o Projeto para este Flow.");
        }
        flowProjectIdRef.current = payload.flow.projectId;
        setFlowProjectId(payload.flow.projectId);
        return payload.flow.projectId;
      })().finally(() => {
        ensureProjectPromiseRef.current = null;
      });
    }

    return ensureProjectPromiseRef.current;
  }, [flowId, flowName, flowProjectId]);

  const handleImportBaseImage = useCallback(() => {
    setPendingProjectAction(null);
    setIsProjectAssetPickerOpen(false);
    assetFileInputRef.current?.click();
  }, []);

  const handleCreateProjectForFlow = useCallback(async () => {
    const name = flowProjectName.trim();
    if (!name) {
      setFlowProjectError("Informe um nome para o Projeto.");
      return;
    }

    setIsCreatingProjectForFlow(true);
    setFlowProjectError(null);

    try {
      const response = await fetch(`/api/flows/${flowId}/project`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          objective: flowProjectObjective.trim(),
        }),
      });
      const payload = (await response.json()) as {
        project?: { id?: string };
        flow?: { projectId?: string };
        error?: string;
      };

      if (!response.ok || !payload.flow?.projectId) {
        throw new Error(payload.error ?? "Não foi possível criar o Projeto para este Flow.");
      }

      const projectId = payload.flow.projectId;
      const nextAction = pendingProjectAction;
      setFlowProjectId(projectId);
      setPendingProjectAction(null);
      setFlowProjectError(null);

      if (nextAction === "import-base-image") {
        window.setTimeout(() => assetFileInputRef.current?.click(), 0);
      } else if (nextAction === "project-assets") {
        setIsProjectAssetPickerOpen(true);
        await loadProjectAssets(projectId);
      }
    } catch (error) {
      setFlowProjectError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o Projeto para este Flow.",
      );
    } finally {
      setIsCreatingProjectForFlow(false);
    }
  }, [flowId, flowProjectName, flowProjectObjective, loadProjectAssets, pendingProjectAction]);

  const handleBaseImageFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const file = input.files?.[0];
      input.value = "";

      if (!file) {
        return;
      }

      setIsImportingAsset(true);
      setErrorMessage(null);

      try {
        const projectId = await ensureFlowProject();
        const formData = new FormData();
        formData.append("file", file);
        formData.append("role", "source");
        const response = await fetch(`/api/projects/${projectId}/assets`, {
          method: "POST",
          body: formData,
        });
        const payload = (await response.json()) as {
          asset?: CanvasProjectAsset;
          error?: string;
        };

        if (!response.ok || !payload.asset?.assetId) {
          throw new Error(payload.error ?? "Não foi possível importar a imagem-base.");
        }

        fillProjectAssetNode(payload.asset, projectId);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível importar a imagem-base.",
        );
      } finally {
        setIsImportingAsset(false);
      }
    },
    [ensureFlowProject, fillProjectAssetNode],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setRunMessage(null);

    const graph: FlowGraph = {
      nodes,
      edges,
      viewport: getViewport(),
    };

    const response = await fetch(`/api/flows/${flowId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: flowName,
        graph,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setErrorMessage(payload.error ?? "Não foi possível salvar o fluxo.");
      setIsSaving(false);
      return;
    }

    const payload = (await response.json()) as FlowResponse;
    setFlowName(payload.flow.name);
    setIsDirty(false);
    setLastSavedAt(
      new Date(payload.flow.updatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    void estimateCost(graph);
    setIsSaving(false);
  }, [edges, estimateCost, flowId, flowName, getViewport, nodes]);

  const enqueueFlowRun = useCallback(async (confirmationToken: string) => {
    setIsRunning(true);
    setErrorMessage(null);
    setRunMessage(null);

    const response = await fetch(`/api/flows/${flowId}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmationToken }),
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setErrorMessage(payload.error ?? "Não foi possível executar o fluxo.");
      setIsRunning(false);
      return;
    }

    const payload = (await response.json()) as FlowRunResponse;
    applyRunState(payload.flowRun);
    void pollRun(payload.flowRun.id);
    setRunMessage("execução enfileirada");
    setIsRunning(false);
  }, [applyRunState, flowId, pollRun]);

  const handleRun = useCallback(async () => {
    if (isDirty) {
      setErrorMessage("Salve o fluxo antes de executar.");
      return;
    }

    const graph: FlowGraph = {
      nodes,
      edges,
      viewport: getViewport(),
    };

    setErrorMessage(null);
    setRunMessage(null);
    setCostConfirm({
      open: true,
      isLoading: true,
      cost: null,
      errorMessage: null,
      confirmationToken: null,
    });

    const requestId = costConfirmRequestRef.current + 1;
    costConfirmRequestRef.current = requestId;

    try {
      const payload = await fetchFlowCost(graph);
      if (costConfirmRequestRef.current !== requestId) {
        return;
      }
      applyCostEstimate(payload);
      setCostConfirm({
        open: true,
        isLoading: false,
        cost: payload.cost,
        errorMessage: null,
        confirmationToken: payload.confirmation?.token ?? null,
      });
    } catch (error) {
      if (costConfirmRequestRef.current !== requestId) {
        return;
      }
      setCostConfirm({
        open: true,
        isLoading: false,
        cost: null,
        confirmationToken: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Não foi possível estimar o custo do fluxo.",
      });
    }
  }, [
    applyCostEstimate,
    edges,
    fetchFlowCost,
    getViewport,
    isDirty,
    nodes,
  ]);

  const handleCancelCostConfirm = useCallback(() => {
    if (isRunning) {
      return;
    }

    costConfirmRequestRef.current += 1;
    setCostConfirm({
      open: false,
      isLoading: false,
      cost: null,
      errorMessage: null,
      confirmationToken: null,
    });
  }, [isRunning]);

  const handleConfirmCost = useCallback(async () => {
    if (!costConfirm.cost || !costConfirm.confirmationToken || costConfirm.isLoading || costConfirm.errorMessage) {
      return;
    }

    await enqueueFlowRun(costConfirm.confirmationToken);
    setCostConfirm({
      open: false,
      isLoading: false,
      cost: null,
      errorMessage: null,
      confirmationToken: null,
    });
  }, [
    costConfirm.cost,
    costConfirm.errorMessage,
    costConfirm.isLoading,
    costConfirm.confirmationToken,
    enqueueFlowRun,
  ]);

  const isEmpty = !isLoading && nodes.length === 0;
  const statusMessage = errorMessage
    ? errorMessage
    : runMessage
      ? runMessage
      : isDirty
        ? "alterações não salvas"
        : lastSavedAt
          ? `salvo às ${lastSavedAt}`
          : "pronto";

  return (
    <main className="flex h-[calc(100vh-3.5rem)] min-h-0 flex-col overflow-hidden bg-lab-bg text-lab-text">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-lab-border bg-lab-surface-1 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <input
            aria-label="Nome do fluxo"
            value={flowName}
            onChange={(event) => {
              setFlowName(event.target.value);
              setIsDirty(true);
              setRunMessage(null);
            }}
            className="lab-ghost-input w-64 max-w-[52vw]"
          />
          <Badge variant="cost">{costLabel}</Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 font-mono text-xs md:flex">
            <span
              className={cn(
                "lab-status-dot",
                errorMessage
                  ? "bg-lab-danger"
                  : isDirty
                    ? "bg-lab-warning"
                    : "bg-lab-reagent",
              )}
            />
            <span
              className={cn(
                errorMessage ? "text-lab-danger" : "text-lab-text-muted",
              )}
            >
              {statusMessage}
            </span>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            variant={isDirty ? "default" : "secondary"}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar
          </Button>
          <Button
            onClick={handleRun}
            disabled={isRunning || isLoading}
            variant="secondary"
          >
            {isRunning ? <Loader2 className="animate-spin" /> : <Play />}
            Executar
          </Button>
        </div>
      </header>

      <section className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodesWithExtendDepth}
          edges={edges}
          nodeTypes={nodeTypes}
          colorMode="dark"
          onNodesChange={(changes) => {
            onNodesChange(changes);
            if (changes.some((change) => change.type !== "select")) {
              setIsDirty(true);
              setRunMessage(null);
            }
          }}
          onEdgesChange={(changes) => {
            onEdgesChange(changes);
            if (changes.some((change) => change.type !== "select")) {
              setIsDirty(true);
              setRunMessage(null);
            }
          }}
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.18 }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={16}
            size={1}
            color="var(--lab-canvas-dot)"
          />
          <MiniMap
            pannable
            zoomable
            position="bottom-left"
            className="!h-28 !w-44"
            nodeColor="var(--lab-surface-2)"
            nodeStrokeColor="var(--lab-border-strong)"
            maskColor="var(--lab-canvas-mask)"
          />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>

        {connectionError ? (
          <p
            role="alert"
            className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-control border border-lab-danger/50 bg-lab-surface-1 px-3 py-2 text-xs text-lab-danger shadow-none"
          >
            {connectionError}
          </p>
        ) : null}

        <div className="absolute left-4 top-4 z-20">
          <Button
            type="button"
            onClick={() => setIsNodeMenuOpen((current) => !current)}
            aria-label="Criar"
            aria-expanded={isNodeMenuOpen}
            variant="secondary"
          >
            <Plus />
            Criar
          </Button>

          {isNodeMenuOpen ? (
            <div
              data-testid="create-menu"
              data-menu-scroll="true"
              className="mt-2 flex max-h-[calc(100dvh-5rem)] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto overscroll-contain rounded-control border border-lab-border bg-lab-surface-1 p-2 shadow-none"
            >
              <label className="sticky top-0 z-10 mb-2 flex shrink-0 items-center gap-2 rounded-control border border-lab-border bg-lab-surface-2 px-2.5 py-2 focus-within:border-lab-border-strong">
                <Search className="size-4 shrink-0 text-lab-text-muted" />
                <span className="sr-only">Buscar ações</span>
                <input
                  data-testid="create-search"
                  type="search"
                  value={createSearch}
                  onChange={(event) => setCreateSearch(event.target.value)}
                  placeholder="Buscar ações"
                  aria-label="Buscar ações"
                  className="min-w-0 flex-1 bg-transparent text-sm text-lab-text outline-none placeholder:text-lab-text-muted"
                />
              </label>

              {priorityCreateActions.length > 0 ? (
                <div className="mb-2 border-b border-lab-border pb-2">
                  <div className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-lab-text-muted">
                    Entrada do Projeto
                  </div>
                  <div className="grid gap-1.5">
                    {priorityCreateActions.map((action) => (
                      <CreateActionButton
                        key={action.id}
                        action={action}
                        priority
                        disabled={action.id === "import-base-image" && isImportingAsset}
                        onSelect={(selectedAction) => {
                          if (selectedAction.id === "import-base-image") {
                            handleImportBaseImage();
                          } else {
                            void openProjectAssetPicker();
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {visibleCreateSections.map((section) => (
                <div key={section.label} className="mb-2 last:mb-0">
                  <div className="px-1 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-lab-text-muted">
                    {section.label}
                  </div>
                  {section.actions.length > 0 ? (
                    <div className="grid gap-1.5">
                      {section.actions.map((action) => (
                        <CreateActionButton
                          key={action.id}
                          action={action}
                          onSelect={(selectedAction) =>
                            handleAddNode(createActionDefinition(selectedAction))
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="px-1 py-1 text-[11px] leading-4 text-lab-text-muted">
                      Director — indisponível até haver executor de texto comprovado.
                    </p>
                  )}
                </div>
              ))}

              {visibleCompatibilityActions.length > 0 ? (
                <div className="mb-2 last:mb-0">
                  <div className="px-1 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-lab-text-muted">
                    Mais ferramentas
                  </div>
                  <div className="grid gap-1.5">
                    {visibleCompatibilityActions.map((action) => (
                      <CreateActionButton
                        key={action.id}
                        action={action}
                        onSelect={(selectedAction) =>
                          handleAddNode(createActionDefinition(selectedAction))
                        }
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {priorityCreateActions.length === 0 &&
              visibleCreateSections.length === 0 &&
              visibleCompatibilityActions.length === 0 ? (
                <p className="px-1 py-2 text-xs text-lab-text-muted">Nenhuma ação encontrada.</p>
              ) : null}

              {pendingProjectAction ? (
                <div
                  data-testid="flow-project-link-panel"
                  className="mt-3 border-t border-lab-border px-2 pt-3"
                >
                  <p className="text-xs leading-5 text-lab-text-dim">
                    Este Flow ainda não está vinculado a um Projeto. Crie a casa deste trabalho para continuar.
                  </p>
                  <label className="mt-3 grid gap-1 text-xs text-lab-text" htmlFor="flow-project-name">
                    Nome do Projeto
                    <input
                      id="flow-project-name"
                      name="flow-project-name"
                      value={flowProjectName}
                      onChange={(event) => setFlowProjectName(event.target.value)}
                      required
                      className="lab-ghost-input"
                    />
                  </label>
                  <label className="mt-2 grid gap-1 text-xs text-lab-text" htmlFor="flow-project-objective">
                    Objetivo do Projeto <span className="text-lab-text-muted">opcional</span>
                    <textarea
                      id="flow-project-objective"
                      name="flow-project-objective"
                      value={flowProjectObjective}
                      onChange={(event) => setFlowProjectObjective(event.target.value)}
                      rows={2}
                      className="lab-ghost-input min-h-14 resize-y"
                    />
                  </label>
                  <Button
                    type="button"
                    data-action="create-project-for-flow"
                    onClick={() => void handleCreateProjectForFlow()}
                    disabled={isCreatingProjectForFlow}
                    className="mt-3 w-full"
                  >
                    {isCreatingProjectForFlow ? "Criando Projeto..." : "Criar Projeto para este Flow"}
                  </Button>
                  {flowProjectError ? (
                    <p role="alert" className="mt-2 text-xs text-lab-danger">
                      {flowProjectError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isProjectAssetPickerOpen ? (
                <div
                  data-testid="project-asset-picker"
                  className="mt-3 border-t border-lab-border px-2 pt-3"
                >
                  <div className="mb-2 text-xs font-medium text-lab-text">
                    Escolha um Asset de imagem ou vídeo
                  </div>
                  {projectAssetsError ? (
                    <p role="alert" className="text-xs text-lab-danger">
                      {projectAssetsError}
                    </p>
                  ) : projectAssets.length > 0 ? (
                    <div className="grid gap-1.5">
                      {projectAssets.map((asset) => (
                        <button
                          key={asset.assetId}
                          type="button"
                          data-asset-option={asset.assetId}
                          onClick={() => {
                            if (flowProjectId) fillProjectAssetNode(asset, flowProjectId);
                          }}
                          className="rounded-control border border-lab-border bg-lab-surface-2 px-3 py-2 text-left text-xs text-lab-text transition-colors hover:border-lab-border-strong focus-visible:outline-none focus-visible:shadow-lab-focus"
                        >
                          <span className="block font-medium">{asset.assetId}</span>
                          <span className="block text-lab-text-muted">
                            {asset.type === "VIDEO" ? "Vídeo" : "Imagem"} · fonte do Projeto
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-lab-text-muted">
                      Nenhum Asset de imagem ou vídeo disponível neste Projeto.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <input
            ref={assetFileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            aria-label="Arquivo da imagem-base"
            className="sr-only"
            onChange={(event) => void handleBaseImageFileChange(event)}
          />
        </div>

        {isEmpty ? (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-control border border-lab-border bg-lab-surface-1/90 p-6 text-center">
              <div className="font-display text-base font-semibold">
                Canvas vazio
              </div>
              <p className="text-sm text-lab-text-dim">
                Todo experimento começa com um bloco. Adicione um nó de texto e
                conecte a partir dele.
              </p>
              <Button onClick={() => handleAddNode(fallbackAddableNodes[0])}>
                <Plus />
                Adicionar nó de texto
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="absolute inset-0 grid place-items-center bg-lab-bg/70">
            <div className="flex items-center gap-2 rounded-control border border-lab-border bg-lab-surface-1 px-3 py-2 text-sm text-lab-text-dim">
              <Loader2 className="size-4 animate-spin text-lab-reagent-bright" />
              Preparando o laboratório
            </div>
          </div>
        ) : null}
      </section>

      <VideoCostConfirmModal
        open={costConfirm.open}
        totalBrl={costConfirm.cost?.total.brl ?? null}
        items={costConfirmItems}
        isLoading={costConfirm.isLoading}
        isConfirming={isRunning}
        errorMessage={costConfirm.errorMessage}
        formatBrl={formatBrl}
        onCancel={handleCancelCostConfirm}
        onConfirm={handleConfirmCost}
      />
    </main>
  );
}

export function FlowCanvas({ flowId }: { flowId: string }) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner flowId={flowId} />
    </ReactFlowProvider>
  );
}
