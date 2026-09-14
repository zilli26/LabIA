// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const flowId = "flow-video-1";
const generationId = "generation-video-1";

const graph = {
  nodes: [
    {
      id: "template-video",
      type: "labNode",
      position: { x: 0, y: 0 },
      data: {
        kind: "video-generation",
        title: "Gerar Vídeo",
        description: "Vídeo",
        status: "idle",
        params: { model: "fal-ai/wan-25-preview/image-to-video" },
      },
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

const latestRun = {
  id: "run-video-1",
  status: "done",
  nodes: [
    {
      nodeId: "template-video",
      type: "video-generation",
      status: "done",
      outputs: { generationId },
      error: null,
      estimatedCost: { brl: 1.35 },
      actualCost: { brl: 1.35 },
    },
  ],
};

const latestRunInProgress = { ...latestRun, status: "running" };

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  const fitView = vi.fn();
  const getViewport = () => ({ x: 0, y: 0, zoom: 1 });
  const screenToFlowPosition = (point: { x: number; y: number }) => point;
  const setViewport = vi.fn();

  function ReactFlowProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }

  function ReactFlow({
    nodes,
    nodeTypes,
  }: {
    nodes: Array<{ id: string; type?: string; data: unknown }>;
    nodeTypes: Record<string, React.ComponentType<{ id: string; data: unknown }> >;
  }) {
    return (
      <div data-testid="flow-canvas">
        {nodes.map((node) => {
          const Node = nodeTypes[node.type ?? "labNode"];
          return Node ? <Node key={node.id} id={node.id} data={node.data} /> : null;
        })}
      </div>
    );
  }

  return {
    addEdge: vi.fn(),
    Background: () => null,
    BackgroundVariant: { Dots: "dots" },
    Controls: () => null,
    Handle: ({
      type,
      position,
      className,
    }: {
      type: string;
      position: string;
      className?: string;
    }) => <div data-handle={type} data-position={position} className={className} />,
    MarkerType: { ArrowClosed: "arrowclosed" },
    MiniMap: () => null,
    Position: { Left: "left", Right: "right" },
    ReactFlow,
    ReactFlowProvider,
    useEdgesState: (initial: unknown[]) => {
      const [value, setValue] = React.useState(initial);
      return [value, setValue, vi.fn()] as const;
    },
    useNodesState: (initial: unknown[]) => {
      const [value, setValue] = React.useState(initial);
      return [value, setValue, vi.fn()] as const;
    },
    useReactFlow: () => ({
      fitView,
      getViewport,
      screenToFlowPosition,
      setNodes: vi.fn(),
      setViewport,
    }),
  };
});

import { FlowCanvas } from "@/app/(studio)/fluxos/flow-canvas";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function renderCanvas() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<FlowCanvas flowId={flowId} />);
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
  return { container, root };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

describe("FlowCanvas video rehydration", () => {
  it("recupera o último FlowRun e o Asset de vídeo após reload", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === `/api/flows/${flowId}`) {
        return jsonResponse({
          flow: {
            id: flowId,
            name: "Vídeo",
            graph,
            updatedAt: "2026-09-14T00:00:00.000Z",
          },
        });
      }

      if (url === `/api/flows/${flowId}/runs/latest`) {
        return jsonResponse({ flowRun: latestRun });
      }

      if (url === `/api/generations/${generationId}`) {
        return jsonResponse({
          generation: {
            id: generationId,
            status: "DONE",
            model: "fal-ai/wan-25-preview/image-to-video",
            prompt: "Vídeo",
            actualCostBrl: 1.35,
            errorMessage: null,
            assets: [
              {
                id: "asset-video-1",
                url: "https://assets.example.test/video.mp4",
                width: 1280,
                height: 720,
              },
            ],
          },
        });
      }

      if (url === "/api/flows/node-definitions") {
        return jsonResponse({ nodeDefinitions: [] });
      }

      if (url === `/api/flows/${flowId}/cost`) {
        return jsonResponse({ cost: { total: { brl: 1.35 }, nodes: [] } });
      }

      throw new Error(`URL inesperada no teste: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container, root } = await renderCanvas();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/flows/${flowId}/runs/latest`,
      { cache: "no-store" },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/generations/${generationId}`,
      { cache: "no-store" },
    );
    expect(container.querySelector("video")?.getAttribute("src")).toBe(
      "https://assets.example.test/video.mp4",
    );

    await act(async () => root.unmount());
  });

  it("retoma o polling quando a última execução ainda está em andamento", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === `/api/flows/${flowId}`) {
        return jsonResponse({
          flow: {
            id: flowId,
            name: "Vídeo",
            graph,
            updatedAt: "2026-09-14T00:00:00.000Z",
          },
        });
      }

      if (url === `/api/flows/${flowId}/runs/latest`) {
        return jsonResponse({ flowRun: latestRunInProgress });
      }

      if (url === `/api/flows/${flowId}/runs/${latestRun.id}`) {
        return jsonResponse({ flowRun: latestRun });
      }

      if (url === `/api/generations/${generationId}`) {
        return jsonResponse({
          generation: {
            id: generationId,
            status: "DONE",
            model: "fal-ai/wan-25-preview/image-to-video",
            prompt: "Vídeo",
            actualCostBrl: 1.35,
            errorMessage: null,
            assets: [
              {
                id: "asset-video-1",
                url: "https://assets.example.test/video.mp4",
                width: 1280,
                height: 720,
              },
            ],
          },
        });
      }

      if (url === "/api/flows/node-definitions") {
        return jsonResponse({ nodeDefinitions: [] });
      }

      if (url === `/api/flows/${flowId}/cost`) {
        return jsonResponse({ cost: { total: { brl: 1.35 }, nodes: [] } });
      }

      throw new Error(`URL inesperada no teste: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { root } = await renderCanvas();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/flows/${flowId}/runs/${latestRun.id}`,
      { cache: "no-store" },
    );

    await act(async () => root.unmount());
  });
});
