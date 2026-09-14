// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flowId = "flow-layout-1";

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
    children,
  }: {
    nodes: Array<{ id: string; type?: string; position: { x: number; y: number }; data: unknown }>;
    nodeTypes: Record<string, React.ComponentType<{ id: string; data: unknown }> >;
    children?: React.ReactNode;
  }) {
    return (
      <div data-testid="flow-canvas">
        {nodes.map((node) => {
          const Node = nodeTypes[node.type ?? "labNode"];
          return Node ? (
            <div
              key={node.id}
              data-testid={`flow-node-${node.id}`}
              data-x={node.position.x}
              data-y={node.position.y}
            >
              <Node id={node.id} data={node.data} />
            </div>
          ) : null;
        })}
        {children}
      </div>
    );
  }

  function MiniMap({ position }: { position?: string }) {
    return <div data-testid="minimap" data-position={position} />;
  }

  function Controls({ position }: { position?: string }) {
    return <div data-testid="controls" data-position={position} />;
  }

  return {
    addEdge: vi.fn(),
    Background: () => null,
    BackgroundVariant: { Dots: "dots" },
    Controls,
    Handle: () => null,
    MarkerType: { ArrowClosed: "arrowclosed" },
    MiniMap,
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
      setViewport,
    }),
  };
});

vi.mock("@/components/nodes/lab-flow-node", () => ({
  LabFlowNodeComponent: () => <div data-testid="lab-node" />,
}));

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

  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
  });

  return { container, root };
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function setupFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url === `/api/flows/${flowId}`) {
      return jsonResponse({
        flow: {
          id: flowId,
          name: "Layout",
          graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
          updatedAt: "2026-09-14T00:00:00.000Z",
        },
      });
    }

    if (url === "/api/flows/node-definitions") {
      return jsonResponse({
        nodeDefinitions: [
          {
            type: "note",
            label: "Nota",
            description: "Anotação",
            inputs: [],
            outputs: [],
            ui: { componentKey: "labNode", kind: "note" },
          },
        ],
      });
    }

    if (url === `/api/flows/${flowId}/cost`) {
      return jsonResponse({ cost: { total: { brl: 0 }, nodes: [] } });
    }

    if (url === `/api/flows/${flowId}/runs/latest`) {
      return jsonResponse({ flowRun: null });
    }

    throw new Error(`URL inesperada no teste: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  document.body.replaceChildren();
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("FlowCanvas layout", () => {
  it("cria nós em células livres, sem sobrepor o nó existente", async () => {
    setupFetch();
    const { container, root } = await renderCanvas();

    await click(container.querySelector("button[aria-expanded]")!);
    await click([...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Nota"))!);
    await click(container.querySelector("button[aria-expanded]")!);
    await click([...container.querySelectorAll("button")].find((button) => button.textContent?.includes("Nota"))!);

    const nodes = [...container.querySelectorAll<HTMLElement>("[data-testid^='flow-node-']")];
    expect(nodes).toHaveLength(2);

    const rectangles = nodes.map((node) => ({
      x: Number(node.dataset.x),
      y: Number(node.dataset.y),
      width: 256,
      height: 480,
    }));
    const [first, second] = rectangles;
    const overlaps =
      first.x < second.x + second.width &&
      first.x + first.width > second.x &&
      first.y < second.y + second.height &&
      first.y + first.height > second.y;

    expect(overlaps).toBe(false);

    await act(async () => root.unmount());
  });

  it("separa MiniMap e Controls em cantos diferentes do canvas", async () => {
    setupFetch();
    const { container, root } = await renderCanvas();

    const minimap = container.querySelector<HTMLElement>("[data-testid='minimap']");
    const controls = container.querySelector<HTMLElement>("[data-testid='controls']");

    expect(minimap?.dataset.position).toBe("bottom-left");
    expect(controls?.dataset.position).toBe("bottom-right");
    expect(minimap?.dataset.position).not.toBe(controls?.dataset.position);

    const panelRects = [
      { x: 16, y: 560, width: 176, height: 112 },
      { x: 832, y: 560, width: 176, height: 112 },
    ];
    expect(
      panelRects[0].x < panelRects[1].x + panelRects[1].width &&
        panelRects[0].x + panelRects[0].width > panelRects[1].x &&
        panelRects[0].y < panelRects[1].y + panelRects[1].height &&
        panelRects[0].y + panelRects[0].height > panelRects[1].y,
    ).toBe(false);

    await act(async () => root.unmount());
  });
});
