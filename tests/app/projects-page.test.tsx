import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListProjects = vi.hoisted(() => vi.fn());

vi.mock("@/lib/projects", () => ({ listProjects: mockListProjects }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/flows/ownership", () => ({
  getOwnedExecutionScope: vi.fn().mockResolvedValue({ ownerId: "owner-a", workspaceId: "workspace-a" }),
}));

import ProjectsPage from "@/app/(studio)/projetos/page";

describe("Página Projetos", () => {
  beforeEach(() => {
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
    expect(markup).toContain('href="/fluxos/flow-a"');
  });
});
