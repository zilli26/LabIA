"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  PenLine,
  Play,
  Plus,
  Save,
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

const upcomingNodes = [
  {
    label: "Copy da marca",
    accent: "var(--lab-node-copy)",
    icon: PenLine,
  },
];

const paidVideoKindSet = new Set<string>(PAID_VIDEO_KINDS);

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
      params: getDefaultParams(kind),
    },
  } satisfies LabFlowNode;
}

function getRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
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
  const [addableNodes, setAddableNodes] = useState(fallbackAddableNodes);
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const { fitView, getViewport, screenToFlowPosition, setViewport } =
    useReactFlow<LabFlowNode, Edge>();
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
    fetch("/api/flows/node-definitions", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { nodeDefinitions?: SerializableNodeDefinition[] } | null) => {
        if (!payload?.nodeDefinitions) {
          return;
        }

        setAddableNodes(
          payload.nodeDefinitions.filter(
            (definition) =>
              definition.ui.componentKey === "labNode" &&
              isLabNodeKind(definition.ui.kind),
          ),
        );
      })
      .catch(() => setAddableNodes(fallbackAddableNodes));
  }, []);

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
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setIsDirty(false);
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

  const onConnect = useCallback(
    (connection: Connection) => {
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
    [setEdges],
  );

  const handleAddNode = useCallback(
    (definition: SerializableNodeDefinition) => {
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      setNodes((currentNodes) => [
        ...currentNodes,
        createNode(definition, {
          x: position.x - 128,
          y: position.y - 64,
        }),
      ]);
      setIsDirty(true);
      setRunMessage(null);
      setIsNodeMenuOpen(false);
    },
    [screenToFlowPosition, setNodes],
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
            className="!h-28 !w-44"
            nodeColor="var(--lab-surface-2)"
            nodeStrokeColor="var(--lab-border-strong)"
            maskColor="var(--lab-canvas-mask)"
          />
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>

        <div className="absolute left-4 top-4 z-20">
          <Button
            type="button"
            onClick={() => setIsNodeMenuOpen((current) => !current)}
            aria-expanded={isNodeMenuOpen}
            variant="secondary"
          >
            <Plus />
            Nó
          </Button>

          {isNodeMenuOpen ? (
            <div className="mt-2 w-72 rounded-control border border-lab-border bg-lab-surface-1 p-2 shadow-none">
              <div className="grid gap-2">
                {addableNodes.map((node) => {
                  const kind = isLabNodeKind(node.ui.kind)
                    ? node.ui.kind
                    : "note";
                  const Icon = nodeIcons[kind];

                  return (
                    <button
                      key={node.type}
                      type="button"
                      onClick={() => handleAddNode(node)}
                      className="group flex items-center gap-3 rounded-control border border-lab-border bg-lab-surface-2 p-3 text-left transition-colors hover:border-lab-border-strong hover:bg-lab-bg focus-visible:outline-none focus-visible:shadow-lab-focus"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-lab-border bg-lab-surface-1 text-lab-text-dim transition-colors group-hover:text-lab-reagent-bright">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-lab-text">
                          {node.label}
                        </span>
                        <span className="block truncate text-xs text-lab-text-muted">
                          {node.description}
                        </span>
                      </span>
                      <Plus className="size-4 shrink-0 text-lab-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>

              <div className="px-2 pb-2 pt-4 text-[11px] font-medium uppercase tracking-wider text-lab-text-muted">
                Em breve
              </div>
              <div className="grid gap-1.5">
                {upcomingNodes.map((node) => {
                  const Icon = node.icon;

                  return (
                    <div
                      key={node.label}
                      className="flex items-center gap-3 rounded-control border border-dashed border-lab-border/70 p-2.5 opacity-60"
                    >
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-control bg-lab-surface-2"
                        style={{ color: node.accent }}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="text-sm text-lab-text-dim">
                        {node.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
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
