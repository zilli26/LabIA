// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setNodes = vi.fn();

vi.mock("@xyflow/react", async () => {
  const React = await import("react");

  return {
    Handle: ({ id, type }: { id?: string; type: string }) => (
      <div data-testid={`handle-${id ?? type}`} />
    ),
    Position: { Left: "left", Right: "right" },
    useReactFlow: () => ({ setNodes }),
  };
});

import { LabFlowNodeComponent } from "@/components/nodes/lab-flow-node";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("asset-input node canvas control", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          assets: [
            {
              assetId: "asset-source",
              url: "https://storage.example.com/source.png",
              type: "IMAGE",
              origin: "UPLOADED",
              projectRole: "source",
              contentType: "image/png",
            },
          ],
        }),
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
    setNodes.mockReset();
  });

  it("selects a Project Asset, shows zero cost, and exposes image/video handles", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LabFlowNodeComponent
          id="asset-input-1"
          data={{
            kind: "asset-input",
            title: "Imagem-base",
            description: "Selecione o asset do projeto.",
            status: "idle",
            params: {
              projectId: "project-a",
              assetId: "",
              projectRole: "source",
            },
          }}
          selected={false}
          type="labNode"
          dragging={false}
          zIndex={0}
          selectable
          deletable
          draggable
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          isConnectable
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/project-a/assets",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(container.querySelector('[aria-label="Asset do Projeto"]')).not.toBeNull();
    expect(container.textContent).toContain("custo R$0,00");
    expect(container.textContent).toContain("Selecione um Asset source");
    expect(container.querySelector('[data-testid="handle-image"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="handle-video"]')).not.toBeNull();

    const assetSelect = container.querySelector<HTMLSelectElement>(
      '[aria-label="Asset do Projeto"]',
    );
    expect(assetSelect?.options).toHaveLength(2);
    await act(async () => {
      assetSelect!.value = "asset-source";
      assetSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(setNodes).toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it("keeps the legacy image URL behind an advanced disclosure", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LabFlowNodeComponent
          id="video-1"
          data={{
            kind: "video-generation",
            title: "Animar imagem",
            description: "",
            status: "idle",
            params: { model: "fal-ai/wan-25-preview/image-to-video" },
          }}
          selected={false}
          type="labNode"
          dragging={false}
          zIndex={0}
          selectable
          deletable
          draggable
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          isConnectable
        />,
      );
    });

    expect(container.querySelector("details")).not.toBeNull();
    expect(container.textContent).toContain("Avançado");
    expect(container.textContent).toContain("Asset importado");

    await act(async () => root.unmount());
  });
});
