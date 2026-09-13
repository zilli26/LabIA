// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CreateWorkspace } from "@/components/create/create-workspace";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

function setPublicInputValue(element: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("CreateWorkspace provider selection", () => {
  it("carrega opções reais e transforma a revisão em confirmação server-side antes do CTA único", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/api/provider-connections/session")) return new Response(null, { status: 204 });
      if (url.endsWith("/api/provider-connections/image-options")) {
        return jsonResponse({
          connections: [{
            id: "pc-authenticated",
            label: "ChatGPT pessoal",
            planType: "plus",
            models: [{ id: "gpt-image-approved", name: "Imagem aprovada" }],
          }],
        });
      }
      if (url.endsWith("/api/flows") && init?.method === "POST") return jsonResponse({ flow: { id: "flow-guided-1" } }, 201);
      if (url.endsWith("/api/flows/flow-guided-1") && init?.method === "PUT") return jsonResponse({ flow: { id: "flow-guided-1" } });
      if (url.endsWith("/api/flows/flow-guided-1/cost")) {
        return jsonResponse({
          cost: { total: { usd: 0, brl: 0, billingMode: "subscription" } },
          confirmation: { token: "signed-confirmation", expiresAt: 1_900_000_000 },
        });
      }
      if (url.endsWith("/api/flows/flow-guided-1/runs")) return jsonResponse({ flowRun: { id: "run-guided-1", status: "queued" } }, 201);
      throw new Error(`unexpected fetch ${url}`);
    }));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(<CreateWorkspace />));
    const provider = container.querySelector<HTMLSelectElement>('[aria-label="Provider da receita"]');
    expect(provider).not.toBeNull();

    await act(async () => {
      provider!.value = "openai";
      provider!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const connection = container.querySelector<HTMLSelectElement>('[aria-label="Conexão da receita"]');
    const model = container.querySelector<HTMLSelectElement>('[aria-label="Modelo da receita"]');
    expect(connection?.tagName).toBe("SELECT");
    expect(model?.tagName).toBe("SELECT");
    expect(Array.from(connection?.options ?? []).map((option) => option.value)).toContain("pc-authenticated");

    await act(async () => {
      connection!.value = "pc-authenticated";
      connection!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(model!.value).toBe("gpt-image-approved");

    const intent = container.querySelector<HTMLTextAreaElement>('[aria-label="Intenção da criação"]');
    await act(async () => {
      setPublicInputValue(intent!, "Preservar o prompt atual");
    });
    await act(async () => {
      (container.querySelector('[data-id="review-recipe"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(calls.some((call) => call.url.endsWith("/api/flows") && call.init?.method === "POST")).toBe(true);
    expect(calls.some((call) => call.url.endsWith("/api/flows/flow-guided-1/cost"))).toBe(true);
    const updateCall = calls.find((call) => call.url.endsWith("/api/flows/flow-guided-1") && call.init?.method === "PUT");
    const updateBody = JSON.parse(String(updateCall?.init?.body)) as { graph?: { nodes?: Array<{ data?: { params?: Record<string, unknown> } }> } };
    expect(updateBody.graph?.nodes?.find((node) => node.data?.params?.providerId === "openai")?.data?.params).toMatchObject({
      connectionId: "pc-authenticated",
      model: "gpt-image-approved",
      prompt: "Preservar o prompt atual",
    });
    expect(container.textContent).toContain("Cota indisponível");
    expect(container.querySelector('[data-id="generate-one-image"]')).not.toBeNull();
    expect(container.querySelector('[data-id="review-recipe"]')).toBeNull();

    await act(async () => {
      const generate = container.querySelector('[data-id="generate-one-image"]') as HTMLButtonElement;
      generate.click();
      generate.click();
      await Promise.resolve();
    });
    const runCalls = calls.filter((call) => call.url.endsWith("/api/flows/flow-guided-1/runs"));
    expect(runCalls).toHaveLength(1);
    expect(JSON.parse(String(runCalls[0].init?.body))).toMatchObject({
      targetNodeId: "guided-image",
      confirmationToken: "signed-confirmation",
    });
    expect(container.querySelector('a[href="/biblioteca"]')).not.toBeNull();

    await act(async () => root.unmount());
  });
});
