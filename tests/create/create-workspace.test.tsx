// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateWorkspace } from "@/components/create/create-workspace";

const router = { push: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.restoreAllMocks();
  router.push.mockReset();
  document.body.replaceChildren();
});

describe("CreateWorkspace template launcher", () => {
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  it("starts with the enabled image-base to short-video template", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ flow: { id: "flow-video-1" } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<CreateWorkspace />));

    const primary = container.querySelector<HTMLButtonElement>(
      '[data-template="image-to-video"]',
    );
    expect(primary).not.toBeNull();
    expect(primary?.getAttribute("aria-checked")).toBe("true");
    expect(primary?.disabled).toBe(false);
    expect(container.textContent).toContain("Imagem-base → Vídeo curto");
    expect(container.textContent).not.toContain("Em preparação");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-id="create-template"]')?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flows",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ template: "image-to-video" }),
      }),
    );
    expect(router.push).toHaveBeenCalledWith("/fluxos/flow-video-1");

    await act(async () => root.unmount());
  });

  it("keeps image-only as a secondary template and launches it in the canvas", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ flow: { id: "flow-image-1" } }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<CreateWorkspace />));

    const imageOnly = container.querySelector<HTMLButtonElement>(
      '[data-template="image-only"]',
    );
    expect(imageOnly?.getAttribute("aria-checked")).toBe("false");

    await act(async () => imageOnly?.click());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(imageOnly?.getAttribute("aria-checked")).toBe("true");

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-id="create-template"]')?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flows",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ template: "image-only" }),
      }),
    );
    expect(router.push).toHaveBeenCalledWith("/fluxos/flow-image-1");

    await act(async () => root.unmount());
  });

  it("exposes the imported product to short video path without implicit image generation", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      flow: { id: "flow-product-video-1" },
      project: { id: "project-product-video-1" },
    }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<CreateWorkspace />));

    const productVideo = container.querySelector<HTMLButtonElement>(
      '[data-template="product-imported-to-video"]',
    );
    expect(productVideo).not.toBeNull();
    expect(productVideo?.getAttribute("aria-checked")).toBe("false");
    expect(container.textContent).toContain("Produto importado → Vídeo curto");
    expect(container.textContent).toContain("Começa com uma imagem-base do Projeto");
    expect(container.textContent).toContain("não gera imagem automaticamente");

    await act(async () => productVideo?.click());
    expect(productVideo?.getAttribute("aria-checked")).toBe("true");
    expect(container.textContent).toContain("Nome do Projeto");
    expect(container.textContent).toContain("Objetivo do Projeto");
    expect(container.textContent).toContain("9:16");
    expect(container.textContent).toContain("5 segundos");
    expect(container.textContent).toContain("Criar Projeto e abrir canvas");
    expect(container.querySelector<HTMLButtonElement>('[data-id="create-template"]')?.className).toContain("min-h-11");

    const projectName = container.querySelector<HTMLInputElement>("[name=project-name]");
    expect(projectName).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(projectName, "Produto X");
      projectName!.dispatchEvent(new Event("input", { bubbles: true }));
      projectName!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-id="create-template"]')?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flows",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          template: "product-imported-to-video",
          project: {
            name: "Produto X",
            objective: "",
            aspectRatio: "9:16",
            durationSeconds: 5,
          },
        }),
      }),
    );
    expect(router.push).toHaveBeenCalledWith("/fluxos/flow-product-video-1");

    await act(async () => root.unmount());
  });

  it("exposes the production blueprint as a real canvas recipe", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      flow: { id: "flow-blueprint-1" },
      project: { id: "project-blueprint-1" },
    }, 201));
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<CreateWorkspace />));

    const blueprint = container.querySelector<HTMLButtonElement>(
      '[data-template="product-production-blueprint"]',
    );
    expect(blueprint).not.toBeNull();
    await act(async () => blueprint?.click());
    expect(container.textContent).toContain("Briefing, contexto, teste, revisão, continuidade e montagem");
    expect(container.textContent).toContain("Nome do Projeto");

    const projectName = container.querySelector<HTMLInputElement>("[name=project-name]");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(projectName, "Blueprint Produto X");
      projectName!.dispatchEvent(new Event("input", { bubbles: true }));
      projectName!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-id="create-template"]')?.click();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flows",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          template: "product-production-blueprint",
          project: {
            name: "Blueprint Produto X",
            objective: "",
            aspectRatio: "9:16",
            durationSeconds: 5,
          },
        }),
      }),
    );
    expect(router.push).toHaveBeenCalledWith("/fluxos/flow-blueprint-1");

    await act(async () => root.unmount());
  });
});
