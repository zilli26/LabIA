"use client";

import { useCallback, useEffect, useState } from "react";
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
  FileText,
  Image as ImageIcon,
  Loader2,
  PenLine,
  Plus,
  Save,
  StickyNote,
  UploadCloud,
} from "lucide-react";

import { LabFlowNodeComponent } from "@/components/nodes/lab-flow-node";
import { Button } from "@/components/ui/button";
import {
  starterFlowGraph,
  type FlowGraph,
  type LabFlowNode,
  type LabNodeKind,
} from "@/lib/flows/graph";
import { cn } from "@/lib/utils";

type FlowRecord = {
  id: string;
  name: string;
  graph: FlowGraph;
  updatedAt: string;
};

type FlowResponse = {
  flow: FlowRecord;
};

const nodeTypes = {
  labNode: LabFlowNodeComponent,
} satisfies NodeTypes;

const addableNodes: Array<{
  kind: LabNodeKind;
  label: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    kind: "text-input",
    label: "Texto",
    description: "Briefing, prompt ou contexto.",
    icon: FileText,
  },
  {
    kind: "note",
    label: "Nota",
    description: "Anotação livre no fluxo.",
    icon: StickyNote,
  },
  {
    kind: "asset-output",
    label: "Saída",
    description: "Destino do resultado.",
    icon: UploadCloud,
  },
];

const upcomingNodes = [
  {
    label: "Gerar imagem",
    accent: "var(--lab-node-image)",
    icon: ImageIcon,
  },
  {
    label: "Gerar vídeo",
    accent: "var(--lab-node-video)",
    icon: Clapperboard,
  },
  {
    label: "Copy da marca",
    accent: "var(--lab-node-copy)",
    icon: PenLine,
  },
];

function createNode(kind: LabNodeKind, position: { x: number; y: number }) {
  const meta = addableNodes.find((node) => node.kind === kind);
  const label = meta?.label ?? "Nó";
  const suffix = crypto.randomUUID().slice(0, 8);

  return {
    id: `${kind}-${suffix}`,
    type: "labNode",
    position,
    data: {
      kind,
      title: label,
      description: meta?.description ?? "Nó do fluxo.",
      status: "idle",
    },
  } satisfies LabFlowNode;
}

function FlowCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<LabFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState("Novo experimento");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const { fitView, getViewport, screenToFlowPosition, setViewport } =
    useReactFlow<LabFlowNode, Edge>();

  const loadFlow = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const response = await fetch("/api/flows", {
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Não foi possível carregar o fluxo.");
    }

    const payload = (await response.json()) as FlowResponse;
    const graph = payload.flow.graph;

    setFlowId(payload.flow.id);
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

    if (graph.viewport) {
      setViewport(graph.viewport);
    } else {
      window.requestAnimationFrame(() => fitView({ padding: 0.18 }));
    }

    setIsLoading(false);
  }, [fitView, setEdges, setNodes, setViewport]);

  useEffect(() => {
    loadFlow().catch((error: Error) => {
      setNodes(starterFlowGraph.nodes);
      setEdges(starterFlowGraph.edges);
      setErrorMessage(error.message);
      setIsLoading(false);
    });
  }, [loadFlow, setEdges, setNodes]);

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
    },
    [setEdges],
  );

  const handleAddNode = useCallback(
    (kind: LabNodeKind) => {
      const position = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      setNodes((currentNodes) => [
        ...currentNodes,
        createNode(kind, {
          x: position.x - 128,
          y: position.y - 64,
        }),
      ]);
      setIsDirty(true);
    },
    [screenToFlowPosition, setNodes],
  );

  const handleSave = useCallback(async () => {
    if (!flowId) {
      setErrorMessage("Conecte o banco para salvar (veja .env.example).");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

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
    setIsSaving(false);
  }, [edges, flowId, flowName, getViewport, nodes]);

  const isEmpty = !isLoading && nodes.length === 0;

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-lab-bg text-lab-text">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-lab-border bg-lab-surface-1 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="lab-wordmark shrink-0">
            Lab<span>IA</span>
          </div>
          <div className="h-6 w-px bg-lab-border" />
          <input
            aria-label="Nome do fluxo"
            value={flowName}
            onChange={(event) => {
              setFlowName(event.target.value);
              setIsDirty(true);
            }}
            className="lab-ghost-input w-56"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 font-mono text-xs sm:flex">
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
              {errorMessage
                ? errorMessage
                : isDirty
                  ? "alterações não salvas"
                  : lastSavedAt
                    ? `salvo às ${lastSavedAt}`
                    : "pronto"}
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
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-lab-border bg-lab-surface-1">
          <div className="p-4 pb-2">
            <div className="font-display text-sm font-semibold">
              Adicionar nós
            </div>
            <div className="mt-1 text-xs text-lab-text-dim">
              Monte o experimento conectando blocos.
            </div>
          </div>

          <div className="grid gap-2 p-3">
            {addableNodes.map((node) => {
              const Icon = node.icon;

              return (
                <button
                  key={node.kind}
                  type="button"
                  onClick={() => handleAddNode(node.kind)}
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

          <div className="px-4 pb-2 pt-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-lab-text-muted">
              Em breve no laboratório
            </div>
          </div>

          <div className="grid gap-1.5 px-3">
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

          <div className="mt-auto flex items-center justify-between border-t border-lab-border p-4">
            <span className="font-mono text-[11px] text-lab-text-muted">
              LabIA · etapa 1
            </span>
            <span className="font-mono text-[11px] text-lab-text-muted">
              {nodes.length} {nodes.length === 1 ? "nó" : "nós"}
            </span>
          </div>
        </aside>

        <section className="relative min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            colorMode="dark"
            onNodesChange={(changes) => {
              onNodesChange(changes);
              if (changes.some((change) => change.type !== "select")) {
                setIsDirty(true);
              }
            }}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              if (changes.some((change) => change.type !== "select")) {
                setIsDirty(true);
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
              maskColor="rgba(10, 11, 14, 0.72)"
            />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>

          {isEmpty ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-lab border border-lab-border bg-lab-surface-1/90 p-6 text-center">
                <div className="font-display text-base font-semibold">
                  Canvas vazio
                </div>
                <p className="text-sm text-lab-text-dim">
                  Todo experimento começa com um bloco. Adicione um nó de texto
                  e conecte a partir dele.
                </p>
                <Button onClick={() => handleAddNode("text-input")}>
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
      </div>
    </main>
  );
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
