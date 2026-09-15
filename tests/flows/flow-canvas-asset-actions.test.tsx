// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flowId = "flow-actions-1";

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  const reactFlowApi = {
    fitView: vi.fn(),
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    screenToFlowPosition: (point: { x: number; y: number }) => point,
    setViewport: vi.fn(),
  };

  function ReactFlow({
    nodes,
    nodeTypes,
    children,
  }: {
    nodes: Array<{ id: string; type?: string; data: Record<string, unknown> }>;
    nodeTypes: Record<string, React.ComponentType<{ id: string; data: Record<string, unknown> }> >;
    children?: React.ReactNode;
  }) {
    return (
      <div data-testid="flow-canvas">
        {nodes.map((node) => {
          const Node = nodeTypes[node.type ?? "labNode"];
          return Node ? <Node key={node.id} id={node.id} data={node.data} /> : null;
        })}
        {children}
      </div>
    );
  }

  return {
    addEdge: vi.fn(),
    Background: () => null,
    BackgroundVariant: { Dots: "dots" },
    Controls: () => null,
    Handle: () => null,
    MarkerType: { ArrowClosed: "arrowclosed" },
    MiniMap: () => null,
    Position: { Left: "left", Right: "right" },
    ReactFlow,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useEdgesState: (initial: unknown[]) => {
      const [value, setValue] = React.useState(initial);
      return [value, setValue, vi.fn()] as const;
    },
    useNodesState: (initial: unknown[]) => {
      const [value, setValue] = React.useState(initial);
      return [value, setValue, vi.fn()] as const;
    },
    useReactFlow: () => reactFlowApi,
  };
});

vi.mock("@/components/nodes/lab-flow-node", () => ({
  LabFlowNodeComponent: ({ id, data }: { id: string; data: Record<string, unknown> }) => {
    const params = (data.params ?? {}) as Record<string, unknown>;
    return (
      <div
        data-testid={`lab-node-${id}`}
        data-kind={String(data.kind)}
        data-asset-id={typeof params.assetId === "string" ? params.assetId : ""}
      />
    );
  },
}));

import { FlowCanvas } from "@/app/(studio)/fluxos/flow-canvas";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function definitions() {
  return [
    ["prompt", "Prompt"],
    ["image-generation", "Gerar imagem"],
    ["video-generation", "Animar imagem"],
    ["asset-input", "Asset importado"],
    ["video-extend", "Continuar clipe"],
    ["video-assembly", "Juntar clipes"],
  ].map(([type, label]) => ({
    type,
    label,
    description: label,
    inputs: [],
    outputs: [],
    ui: { componentKey: "labNode", kind: type },
  }));
}

function setupFetch({ projectId = "project-1" }: { projectId?: string | null } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === `/api/flows/${flowId}`) {
      return jsonResponse({
        flow: {
          id: flowId,
          name: "Flow do Projeto",
          projectId,
          graph: { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
          updatedAt: "2026-09-15T00:00:00.000Z",
        },
      });
    }

    if (url === "/api/flows/node-definitions") {
      return jsonResponse({ nodeDefinitions: definitions() });
    }

    if (url === "/api/projects/project-1/assets" && init?.method === "POST") {
      return jsonResponse(
        {
          asset: {
            assetId: "asset-uploaded",
            url: "https://storage.test/uploaded.png",
            type: "IMAGE",
            origin: "UPLOADED",
            projectRole: "source",
          },
        },
        201,
      );
    }

    if (url === `/api/flows/${flowId}/project` && init?.method === "POST") {
      return jsonResponse({
        project: {
          id: "project-1",
          name: "Flow sem Projeto",
          primaryFlowId: flowId,
        },
        flow: {
          id: flowId,
          projectId: "project-1",
          graph: { nodes: [], edges: [] },
        },
      }, 201);
    }

    if (url === "/api/projects/project-1/assets") {
      return jsonResponse({
        assets: [
          {
            assetId: "asset-existing",
            url: "https://storage.test/existing.png",
            type: "IMAGE",
            origin: "UPLOADED",
            projectRole: "source",
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

    throw new Error(`URL inesperada: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderCanvas() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<FlowCanvas flowId={flowId} />);
    await new Promise((resolve) => setTimeout(resolve, 75));
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

describe("ações de Asset no canvas do Flow", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("expõe + Criar, importa imagem-base e adiciona nó preenchido sem geração", async () => {
    const fetchMock = setupFetch();
    const { container, root } = await renderCanvas();
    expect(container.querySelector('[aria-label="Criar"]')).not.toBeNull();
    await click(container.querySelector('[aria-label="Criar"]')!);

    for (const label of [
      "Prompt",
      "Gerar imagem",
      "Animar imagem",
      "Importar imagem-base",
      "Assets do Projeto",
      "Continuar clipe",
      "Juntar clipes",
    ]) {
      expect(container.textContent).toContain(label);
    }
    expect(container.textContent).toMatch(/Director.*indisponível/i);

    await click(container.querySelector('[data-action="import-base-image"]')!);
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"][accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"]',
    );
    expect(input).not.toBeNull();

    const file = new File(["png bytes"], "produto.png", { type: "image/png" });
    Object.defineProperty(input, "files", { configurable: true, value: [file] });
    await act(async () => {
      input!.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 75));
    });

    const uploadCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/projects/project-1/assets" && init?.method === "POST",
    );
    expect(uploadCall).toBeDefined();
    expect((uploadCall?.[1]?.body as FormData).get("role")).toBe("source");
    expect((uploadCall?.[1]?.body as FormData).get("file")).toBe(file);
    expect(container.querySelector('[data-kind="asset-input"]')).not.toBeNull();
    expect(container.querySelector('[data-asset-id="asset-uploaded"]')).not.toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("image-generation"))).toBe(false);

    await act(async () => root.unmount());
  });

  it("mantém busca, entradas prioritárias visíveis e menu rolável no viewport", async () => {
    setupFetch();
    const { container, root } = await renderCanvas();
    await click(container.querySelector('[aria-label="Criar"]')!);

    const menu = container.querySelector<HTMLElement>('[data-testid="create-menu"]');
    const search = menu?.querySelector<HTMLInputElement>('[data-testid="create-search"]');

    expect(search).not.toBeNull();
    expect(search?.type).toBe("search");
    expect(search?.getAttribute("placeholder")).toBe("Buscar ações");

    const actionIds = Array.from(menu?.querySelectorAll<HTMLElement>("[data-action]") ?? [])
      .map((action) => action.dataset.action);
    expect(actionIds.slice(0, 2)).toEqual(["import-base-image", "project-assets"]);
    expect(menu?.className).toContain("overflow-y-auto");
    expect(menu?.className).toContain("overscroll-contain");
    expect(menu?.className).toContain("100dvh");

    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      valueSetter?.call(search, "imagem-base");
      search?.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });
    expect(menu?.textContent).toContain("Importar imagem-base");
    expect(menu?.textContent).not.toContain("Gerar imagem");

    await act(async () => root.unmount());
  });

  it("abre Assets do Projeto e adiciona o Asset selecionado no nó", async () => {
    setupFetch();
    const { container, root } = await renderCanvas();
    await click(container.querySelector('[aria-label="Criar"]')!);
    await click(container.querySelector('[data-action="project-assets"]')!);

    expect(container.textContent).toContain("asset-existing");
    await click(container.querySelector('[data-asset-option="asset-existing"]')!);

    expect(container.querySelector('[data-kind="asset-input"]')).not.toBeNull();
    expect(container.querySelector('[data-asset-id="asset-existing"]')).not.toBeNull();

    await act(async () => root.unmount());
  });

  it("oferece criar Projeto para Flow legado e retoma a importação", async () => {
    const fetchMock = setupFetch({ projectId: null });
    const { container, root } = await renderCanvas();

    await click(container.querySelector('[aria-label="Criar"]')!);
    await click(container.querySelector('[data-action="import-base-image"]')!);

    expect(container.textContent).toContain("Criar Projeto para este Flow");
    const projectName = container.querySelector<HTMLInputElement>("[name=flow-project-name]");
    expect(projectName?.value).toBe("Flow do Projeto");

    await click(container.querySelector('[data-action="create-project-for-flow"]')!);
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(["png bytes"], "produto.png", { type: "image/png" });
    Object.defineProperty(fileInput, "files", { configurable: true, value: [file] });
    await act(async () => {
      fileInput!.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 75));
    });

    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === `/api/flows/${flowId}/project` && init?.method === "POST")).toBe(true);
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === "/api/projects/project-1/assets" && init?.method === "POST")).toBe(true);
    expect(container.querySelector('[data-asset-id="asset-uploaded"]')).not.toBeNull();

    await act(async () => root.unmount());
  });

  it("oferece criar Projeto para Flow legado e retoma o picker", async () => {
    setupFetch({ projectId: null });
    const { container, root } = await renderCanvas();

    await click(container.querySelector('[aria-label="Criar"]')!);
    await click(container.querySelector('[data-action="project-assets"]')!);
    expect(container.textContent).toContain("Criar Projeto para este Flow");

    await click(container.querySelector('[data-action="create-project-for-flow"]')!);

    expect(container.textContent).toContain("asset-existing");
    await click(container.querySelector('[data-asset-option="asset-existing"]')!);
    expect(container.querySelector('[data-asset-id="asset-existing"]')).not.toBeNull();

    await act(async () => root.unmount());
  });
});
