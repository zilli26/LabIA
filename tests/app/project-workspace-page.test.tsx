// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProjectPage from "@/app/(studio)/projetos/[projectId]/page";
import { ProjectWorkspace } from "@/components/projects/project-workspace";

const project = {
  id: "project-a",
  name: "Campanha Produto",
  type: "VIDEO",
  objective: "Demonstrar o produto em um vídeo curto.",
  aspectRatio: "9:16",
  durationSeconds: 6,
  status: "DRAFT",
  primaryFlow: { id: "flow-a", name: "Campanha Produto · Flow principal" },
};

const importedImage = {
  assetId: "asset-image-a",
  type: "IMAGE",
  origin: "UPLOADED",
  url: "https://assets.example.test/product.png",
  contentType: "image/png",
  width: 1080,
  height: 1350,
  metadata: { originalFileName: "produto.png", projectRole: "source" },
};

const uploadedImage = {
  assetId: "asset-image-uploaded",
  type: "IMAGE",
  origin: "UPLOADED",
  url: "https://assets.example.test/product-uploaded.png",
  contentType: "image/png",
  width: 1200,
  height: 1500,
  metadata: { originalFileName: "produto-uploaded.png", projectRole: "source" },
};

const uploadedReference = {
  assetId: "asset-reference-uploaded",
  type: "IMAGE",
  origin: "UPLOADED",
  url: "https://assets.example.test/reference-uploaded.webp",
  contentType: "image/webp",
  width: 1080,
  height: 1920,
  metadata: { originalFileName: "reference-uploaded.webp", projectRole: "reference" },
};

const uploadedVideo = {
  assetId: "asset-video-uploaded",
  type: "VIDEO",
  origin: "UPLOADED",
  url: "https://assets.example.test/product-uploaded.mp4",
  contentType: "video/mp4",
  width: 1080,
  height: 1920,
  metadata: { originalFileName: "product-uploaded.mp4", projectRole: "source" },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
  return { promise, resolve };
}

async function chooseIntent(container: HTMLElement, label: string) {
  const intentButton = [...container.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent?.includes(label));
  expect(intentButton).not.toBeUndefined();
  await act(async () => {
    intentButton!.click();
    await Promise.resolve();
  });
  return intentButton!;
}

async function chooseFile(container: HTMLElement, file: File, intent = "Imagem do produto / imagem-base", accept = "image/jpeg,image/png,image/webp") {
  await chooseIntent(container, intent);
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  expect(input?.getAttribute("accept")).toBe(accept);
  expect(input?.getAttribute("aria-label")).toContain(intent.toLowerCase());
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => {
    input!.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
  });
}

async function renderWorkspace(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root!: Root;
  await act(async () => {
    root = createRoot(container);
    root.render(<ProjectWorkspace projectId="project-a" />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  return { container, root };
}

describe("workspace do Projeto", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("encaminha o id na página e busca Projeto e Assets somente por GET", async () => {
    const markup = renderToStaticMarkup(await ProjectPage({ params: Promise.resolve({ projectId: "project-a" }) }));
    expect(markup).toContain('data-project-id="project-a"');

    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (input, init) => {
      void init;
      const url = String(input);
      if (url.endsWith("/assets")) return jsonResponse({ assets: [importedImage] });
      return jsonResponse({ project });
    });
    const { container, root } = await renderWorkspace(fetchMock);

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-a", { method: "GET", cache: "no-store" });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/project-a/assets", { method: "GET", cache: "no-store" });
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method === "GET")).toBe(true);
    expect(container.textContent).toContain("Campanha Produto");
    expect(container.textContent).toContain("Demonstrar o produto em um vídeo curto.");
    expect(container.textContent).toContain("Fontes e referências");
    expect(container.textContent).toContain("produto.png");
    expect(container.textContent).toContain("Imagem do produto / imagem-base");
    expect(container.textContent).toContain("Importar mídia");
    expect(container.textContent).toContain("Abrir Flow");
    expect(container.querySelector('a[href="/fluxos/flow-a"]')).not.toBeNull();
    expect(fetchMock.mock.calls.some(([input, init]) => String(input).includes("/assets") && (init as RequestInit)?.method !== "GET")).toBe(false);
    await act(async () => root.unmount());
  });

  it("mostra vazio real sem inventar Asset e mantém o CTA de importação disponível", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("/assets")
      ? jsonResponse({ assets: [] })
      : jsonResponse({ project }));
    const { container, root } = await renderWorkspace(fetchMock);

    expect(container.textContent).toContain("Nenhuma fonte ou referência neste Projeto.");
    expect(container.textContent).not.toContain("produto.png");
    const intentButtons = [...container.querySelectorAll<HTMLButtonElement>("button")].filter((button) => ["Imagem do produto / imagem-base", "Character sheet / referência", "Vídeo de referência / produto"].some((label) => button.textContent?.includes(label)));
    expect(intentButtons).toHaveLength(3);
    expect(intentButtons.every((button) => button.className.includes("min-h-11"))).toBe(true);
    const importButton = [...container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.includes("Importar mídia"));
    expect(importButton?.disabled).toBe(true);
    expect(container.textContent).toContain("Importar mídia");
    await act(async () => root.unmount());
  });

  it("envia imagem-base como multipart source e adiciona somente o Asset real retornado", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "produto-uploaded.png", { type: "image/png" });
    const upload = deferred<Response>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return upload.promise;
      return String(input).endsWith("/assets") ? jsonResponse({ assets: [importedImage] }) : jsonResponse({ project });
    });
    const { container, root } = await renderWorkspace(fetchMock);

    await chooseFile(container, file);
    expect(container.textContent).toContain("Enviando imagem-base…");
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall?.[0]).toBe("/api/projects/project-a/assets");
    expect(postCall?.[1]?.body).toBeInstanceOf(FormData);
    expect((postCall?.[1]?.body as FormData).get("role")).toBe("source");
    expect((postCall?.[1]?.body as FormData).get("file")).toBe(file);
    expect(postCall?.[1]?.headers).toBeUndefined();

    upload.resolve(jsonResponse({ asset: uploadedImage }, 201));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Imagem do produto importada.");
    expect(container.textContent).toContain("produto-uploaded.png");
    expect(container.textContent).toContain("Imagem do produto / imagem-base");
    await act(async () => root.unmount());
  });

  it("envia referência visual como multipart reference e aceita imagem ou vídeo", async () => {
    const file = new File([new Uint8Array([7, 8, 9])], "reference-uploaded.webp", { type: "image/webp" });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return jsonResponse({ asset: uploadedReference }, 201);
      return String(input).endsWith("/assets") ? jsonResponse({ assets: [importedImage] }) : jsonResponse({ project });
    });
    const { container, root } = await renderWorkspace(fetchMock);

    await chooseFile(
      container,
      file,
      "Character sheet / referência",
      "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm",
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect((postCall?.[1]?.body as FormData).get("role")).toBe("reference");
    expect((postCall?.[1]?.body as FormData).get("file")).toBe(file);
    expect(container.textContent).toContain("Character sheet / referência importada.");
    expect(container.textContent).toContain("reference-uploaded.webp");
    await act(async () => root.unmount());
  });

  it("envia vídeo de referência como multipart source e aceita MP4, MOV ou WebM", async () => {
    const file = new File([new Uint8Array([10, 11, 12])], "product-uploaded.mp4", { type: "video/mp4" });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return jsonResponse({ asset: uploadedVideo }, 201);
      return String(input).endsWith("/assets") ? jsonResponse({ assets: [importedImage] }) : jsonResponse({ project });
    });
    const { container, root } = await renderWorkspace(fetchMock);

    await chooseFile(
      container,
      file,
      "Vídeo de referência / produto",
      "video/mp4,video/quicktime,video/webm",
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect((postCall?.[1]?.body as FormData).get("role")).toBe("source");
    expect((postCall?.[1]?.body as FormData).get("file")).toBe(file);
    expect(container.textContent).toContain("Vídeo de referência importado.");
    expect(container.textContent).toContain("product-uploaded.mp4");
    await act(async () => root.unmount());
  });

  it("mostra erro seguro e preserva Assets carregados quando o upload falha", async () => {
    const file = new File([new Uint8Array([4, 5, 6])], "falha.webp", { type: "image/webp" });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return jsonResponse({ error: "Storage indisponível." }, 503);
      return String(input).endsWith("/assets") ? jsonResponse({ assets: [importedImage] }) : jsonResponse({ project });
    });
    const { container, root } = await renderWorkspace(fetchMock);

    await chooseFile(container, file);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("produto.png");
    expect(container.textContent).not.toContain("falha.webp");
    expect(container.textContent).toContain("Não foi possível importar a imagem do produto");
    expect(container.textContent).not.toContain("Storage indisponível.");
    await act(async () => root.unmount());
  });

  it("expõe erro seguro do Projeto sem simular dados", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("/assets")
      ? jsonResponse({ assets: [] })
      : jsonResponse({ error: "Projeto não encontrado." }, 404));
    const { container, root } = await renderWorkspace(fetchMock);

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Não foi possível carregar o Projeto");
    expect(container.textContent).not.toContain("Campanha Produto");
    expect(container.textContent).not.toContain("Nenhuma fonte ou referência neste Projeto.");
    await act(async () => root.unmount());
  });

  it("mantém o Projeto e sinaliza separadamente erro no endpoint de Assets", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith("/assets")
      ? jsonResponse({ error: "Storage indisponível." }, 503)
      : jsonResponse({ project }));
    const { container, root } = await renderWorkspace(fetchMock);

    expect(container.textContent).toContain("Campanha Produto");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Não foi possível carregar Fontes e referências");
    expect(container.textContent).not.toContain("Nenhuma fonte ou referência neste Projeto.");
    await act(async () => root.unmount());
  });
});
