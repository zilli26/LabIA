// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", async () => {
  const React = await import("react");

  return {
    Handle: ({
      type,
      position,
      className,
    }: {
      type: string;
      position: string;
      className?: string;
    }) => <div data-handle={type} data-position={position} className={className} />,
    Position: { Left: "left", Right: "right" },
    useReactFlow: () => ({ setNodes: vi.fn() }),
  };
});

import { LabFlowNodeComponent } from "@/components/nodes/lab-flow-node";

beforeEach(() => {
  document.body.replaceChildren();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("LabFlowNode handles", () => {
  it("mantém Handles negativos fora do clipping interno do nó", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LabFlowNodeComponent
          id="note-1"
          data={{
            kind: "note",
            title: "Nota",
            description: "Teste",
            status: "idle",
            params: {},
          }}
          selected={false}
          type="labNode"
          zIndex={0}
          isConnectable
          dragging={false}
          selectable
          deletable
          draggable
          positionAbsoluteX={0}
          positionAbsoluteY={0}
        />,
      );
      await Promise.resolve();
    });

    const shell = container.firstElementChild as HTMLElement | null;
    expect(shell).not.toBeNull();
    expect(shell?.className).not.toContain("overflow-hidden");
    expect(shell?.querySelector("[data-handle='target']")).not.toBeNull();
    expect(shell?.querySelector("[data-handle='source']")).not.toBeNull();

    await act(async () => root.unmount());
  });
});
