import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabaseEnv: vi.fn(),
  getOwnedExecutionScope: vi.fn(),
  createProject: vi.fn(),
  listProjects: vi.fn(),
}));

vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: mocks.hasDatabaseEnv }));
vi.mock("@/lib/flows/ownership", () => ({ getOwnedExecutionScope: mocks.getOwnedExecutionScope }));
vi.mock("@/lib/projects", () => ({
  createProject: mocks.createProject,
  listProjects: mocks.listProjects,
  PROJECT_TYPES: ["IMAGE", "VIDEO"],
  PROJECT_STATUSES: ["DRAFT", "IN_PROGRESS", "REVIEW", "APPROVED", "ARCHIVED"],
}));

import { GET, POST } from "@/app/api/projects/route";

describe("/api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseEnv.mockReturnValue(true);
    mocks.getOwnedExecutionScope.mockResolvedValue({ ownerId: "owner-a", workspaceId: "workspace-a" });
    mocks.listProjects.mockResolvedValue([]);
    mocks.createProject.mockResolvedValue({
      id: "project-a",
      name: "Vídeo A",
      type: "VIDEO",
      status: "DRAFT",
      primaryFlow: { id: "flow-a", name: "Vídeo A · Flow principal" },
    });
  });

  it("lista somente o workspace resolvido pelo owner local", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.listProjects).toHaveBeenCalledWith({ ownerId: "owner-a", workspaceId: "workspace-a" });
  });

  it("cria Projeto VIDEO e retorna o Flow principal sem iniciar geração", async () => {
    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: "Vídeo A",
        type: "VIDEO",
        objective: "Mostrar o produto",
        aspectRatio: "9:16",
        durationSeconds: 5,
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.createProject).toHaveBeenCalledWith({
      ownerId: "owner-a",
      workspaceId: "workspace-a",
      name: "Vídeo A",
      type: "VIDEO",
      objective: "Mostrar o produto",
      aspectRatio: "9:16",
      durationSeconds: 5,
      status: "DRAFT",
    });
  });

  it.each([
    [{ name: "Sem tipo", objective: "x", aspectRatio: "9:16" }, /tipo/i],
    [{ name: "Vídeo", type: "VIDEO", objective: "x", aspectRatio: "9:16" }, /duração/i],
    [{ name: "Imagem", type: "IMAGE", objective: "x", aspectRatio: "9:16", durationSeconds: 4 }, /duração/i],
  ])("rejeita payload inválido ($1)", async (body, message) => {
    const response = await POST(new Request("http://localhost/api/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(message);
    expect(mocks.createProject).not.toHaveBeenCalled();
  });
});
