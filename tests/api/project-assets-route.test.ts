import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabaseEnv: vi.fn(),
  getOwnedExecutionScope: vi.fn(),
  listProjectAssets: vi.fn(),
  createProjectAsset: vi.fn(),
}));

vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: mocks.hasDatabaseEnv }));
vi.mock("@/lib/flows/ownership", () => ({ getOwnedExecutionScope: mocks.getOwnedExecutionScope }));
vi.mock("@/lib/assets/project-assets", () => ({
  listProjectAssets: mocks.listProjectAssets,
  createProjectAsset: mocks.createProjectAsset,
}));

import { GET, POST } from "@/app/api/projects/[projectId]/assets/route";

const context = { params: Promise.resolve({ projectId: "project-a" }) };

function requestWithForm(file?: File, role?: string) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  if (role) formData.append("role", role);
  return new Request("http://localhost/api/projects/project-a/assets", {
    method: "POST",
    body: formData,
  });
}

describe("/api/projects/[projectId]/assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseEnv.mockReturnValue(true);
    mocks.getOwnedExecutionScope.mockResolvedValue({ ownerId: "owner-a", workspaceId: "workspace-a" });
    mocks.listProjectAssets.mockResolvedValue([{
      assetId: "asset-a",
      url: "https://assets.example.com/produto.jpg",
      type: "IMAGE",
      origin: "UPLOADED",
      projectRole: "source",
      contentType: "image/jpeg",
      sizeBytes: 3,
      width: null,
      height: null,
    }]);
    mocks.createProjectAsset.mockResolvedValue({
      assetId: "asset-a",
      url: "https://assets.example.com/produto.jpg",
      type: "IMAGE",
      origin: "UPLOADED",
      projectRole: "source",
      contentType: "image/jpeg",
      sizeBytes: 3,
      width: null,
      height: null,
    });
  });

  it("lists only Assets from the authorized Project", async () => {
    const response = await GET(new Request("http://localhost/api/projects/project-a/assets"), context);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listProjectAssets).toHaveBeenCalledWith("project-a", {
      ownerId: "owner-a",
      workspaceId: "workspace-a",
    });
    expect(payload.assets[0]).toEqual(expect.objectContaining({ assetId: "asset-a", projectRole: "source" }));
    expect(payload.assets[0]).not.toHaveProperty("storageBucket");
    expect(payload.assets[0]).not.toHaveProperty("storagePath");
  });

  it("does not reveal a Project from another workspace", async () => {
    mocks.listProjectAssets.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/projects/foreign/assets"), {
      params: Promise.resolve({ projectId: "foreign" }),
    });

    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatch(/Projeto não encontrado/i);
  });

  it("imports an image with an explicit project role and does not execute generation", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "produto.jpg", { type: "image/jpeg" });
    const response = await POST(requestWithForm(file, "source"), context);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ asset: expect.objectContaining({
      assetId: "asset-a",
      type: "IMAGE",
      origin: "UPLOADED",
      projectRole: "source",
    }) });
    expect(mocks.createProjectAsset).toHaveBeenCalledWith({
      projectId: "project-a",
      scope: { ownerId: "owner-a", workspaceId: "workspace-a" },
      file: expect.any(File),
      role: "source",
    });
  });

  it("rejects invalid role before calling the persistence service", async () => {
    const file = new File([new Uint8Array([1])], "produto.jpg", { type: "image/jpeg" });
    const response = await POST(requestWithForm(file, "director"), context);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Papel de Asset inválido/i);
    expect(mocks.createProjectAsset).not.toHaveBeenCalled();
  });

  it("rejects an empty file before the persistence service", async () => {
    const file = new File([], "produto.jpg", { type: "image/jpeg" });
    const response = await POST(requestWithForm(file, "source"), context);

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/vazio/i);
    expect(mocks.createProjectAsset).not.toHaveBeenCalled();
  });
});
