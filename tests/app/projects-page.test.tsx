// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListProjects = vi.hoisted(() => vi.fn());
const mockRouterPush = vi.hoisted(() => vi.fn());

vi.mock("@/lib/projects", () => ({ listProjects: mockListProjects }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockRouterPush }) }));
vi.mock("@/lib/flows/ownership", () => ({
  getOwnedExecutionScope: vi.fn().mockResolvedValue({ ownerId: "owner-a", workspaceId: "workspace-a" }),
}));

import ProjectsPage from "@/app/(studio)/projetos/page";
import { ProjectOnboarding } from "@/components/projects/project-onboarding";

describe("Página Projetos", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    mockRouterPush.mockReset();
    mockListProjects.mockResolvedValue([{
      id: "project-a",
      name: "Campanha A",
      type: "VIDEO",
      objective: "Mostrar produto",
      aspectRatio: "9:16",
      status: "DRAFT",
      durationSeconds: 5,
      primaryFlow: { id: "flow-a", name: "Campanha A · Flow principal" },
    }]);
  });

  it("oferece onboarding mínimo e abertura do Flow principal", async () => {
    const markup = renderToStaticMarkup(await ProjectsPage());

    expect(markup).toContain("Novo Projeto");
    expect(markup).toContain('name="name"');
    expect(markup).toContain('name="type"');
    expect(markup).toContain('name="objective"');
    expect(markup).toContain('name="aspectRatio"');
    expect(markup).toContain("Campanha A");
    expect(markup).toContain('href="/projetos/project-a"');
    expect(markup).not.toContain('href="/fluxos/flow-a"');
  });

  it("leva o usuário para o Projeto criado, não direto para o Flow", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      project: { id: "project-new", primaryFlow: { id: "flow-new" } },
    }), { status: 201, headers: { "content-type": "application/json" } })));

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<ProjectOnboarding />));

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      const name = container.querySelector<HTMLInputElement>('input[name="name"]')!;
      const objective = container.querySelector<HTMLTextAreaElement>('textarea[name="objective"]')!;
      name.value = "Projeto novo";
      objective.value = "Demonstrar o produto";
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRouterPush).toHaveBeenCalledWith("/projetos/project-new");
    expect(mockRouterPush).not.toHaveBeenCalledWith("/fluxos/flow-new");
    await act(async () => root.unmount());
  });
});
