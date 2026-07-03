"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  FileText,
  Loader2,
  Plus,
  Save,
  StickyNote,
  UploadCloud,
} from "lucide-react";

import { LabFlowNodeComponent } from "@/components/nodes/lab-flow-node";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    description: "Registro livre dentro do fluxo.",
    icon: StickyNote,
  },
  {
    kind: "asset-output",
    label: "Saída",
    description: "Destino do resultado produzido.",
    icon: UploadCloud,
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
      costLabel: "~R$0,00",
    },
  } satisfies LabFlowNode;
}

function FlowCanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<LabFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState("Fluxo inicial");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Carregando Flow");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const { fitView, getViewport, screenToFlowPosition, setViewport } =
    useReactFlow<LabFlowNode, Edge>();

  const loadFlow = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage("Carregando Flow");

    const response = await fetch("/api/flows", {
      cache: "no-store",
    });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Erro ao carregar Flow.");
    }

    const payload = (await response.json()) as FlowResponse;
    const graph = payload.flow.graph;

    setFlowId(payload.flow.id);
    setFlowName(payload.flow.name);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setLastSavedAt(new Date(payload.flow.updatedAt).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }));

    if (graph.viewport) {
      setViewport(graph.viewport);
    } else {
      window.requestAnimationFrame(() => fitView({ padding: 0.18 }));
    }

    setStatusMessage("Flow carregado");
    setIsLoading(false);
  }, [fitView, setEdges, setNodes, setViewport]);

  useEffect(() => {
    loadFlow().catch((error: Error) => {
      setNodes(starterFlowGraph.nodes);
      setEdges(starterFlowGraph.edges);
      setStatusMessage(error.message);
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
      setStatusMessage("Alterações locais");
    },
    [screenToFlowPosition, setNodes],
  );

  const handleSave = useCallback(async () => {
    if (!flowId) {
      setStatusMessage("Banco não configurado");
      return;
    }

    setIsSaving(true);
    setStatusMessage("Salvando Flow");

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
      setStatusMessage(payload.error ?? "Erro ao salvar Flow");
      setIsSaving(false);
      return;
    }

    const payload = (await response.json()) as FlowResponse;
    setFlowName(payload.flow.name);
    setLastSavedAt(new Date(payload.flow.updatedAt).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }));
    setStatusMessage("Flow salvo");
    setIsSaving(false);
  }, [edges, flowId, flowName, getViewport, nodes]);

  const totalCostLabel = useMemo(() => "~R$0,00", []);

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-lab-bg text-lab-text">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-lab-border bg-lab-surface-1 px-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="lab-wordmark shrink-0">
            Lab<span>IA</span>
          </div>
          <div className="h-6 w-px bg-lab-border" />
          <Input
            aria-label="Nome do fluxo"
            value={flowName}
            onChange={(event) => {
              setFlowName(event.target.value);
              setStatusMessage("Alterações locais");
            }}
            className="h-8 w-56"
          />
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="cost">{totalCostLabel}</Badge>
          <div className="hidden font-mono text-xs text-lab-text-muted sm:block">
            {lastSavedAt ? `salvo ${lastSavedAt}` : statusMessage}
          </div>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-lab-border bg-lab-surface-1">
          <div className="border-b border-lab-border p-4">
            <div className="font-display text-sm font-semibold">Nós</div>
            <div className="mt-1 text-xs text-lab-text-dim">Utilitários E1</div>
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
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-control border border-lab-border bg-lab-surface-1 text-lab-text-dim group-hover:text-lab-reagent">
                    <Plus className="size-3" />
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-lab-text">
                      {node.label}
                    </span>
                    <span className="block truncate text-xs text-lab-text-dim">
                      {node.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto border-t border-lab-border p-4">
            <div
              className={cn(
                "font-mono text-xs",
                statusMessage.includes("Erro") ||
                  statusMessage.includes("Não foi possível") ||
                  statusMessage.includes("configurado")
                  ? "text-lab-danger"
                  : "text-lab-text-muted",
              )}
            >
              {statusMessage}
            </div>
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
              setStatusMessage("Alterações locais");
            }}
            onEdgesChange={(changes) => {
              onEdgesChange(changes);
              setStatusMessage("Alterações locais");
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
              nodeColor="var(--lab-surface-2)"
              nodeStrokeColor="var(--lab-border-strong)"
              maskColor="var(--lab-reagent-dim)"
            />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>

          {isLoading ? (
            <div className="absolute inset-0 grid place-items-center bg-lab-bg/70">
              <div className="flex items-center gap-2 rounded-control border border-lab-border bg-lab-surface-1 px-3 py-2 text-sm text-lab-text-dim">
                <Loader2 className="size-4 animate-spin text-lab-reagent" />
                Carregando
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
