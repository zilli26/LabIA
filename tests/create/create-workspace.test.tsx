// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

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
});
