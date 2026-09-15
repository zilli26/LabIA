import { beforeEach, describe, expect, it, vi } from "vitest";

const mockHasDatabaseEnv = vi.hoisted(() => vi.fn());
const mockEnsureDefaultImageWorkspace = vi.hoisted(() => vi.fn());
const mockUploadBufferAssetToSupabase = vi.hoisted(() => vi.fn());
const mockGetOwnedExecutionScope = vi.hoisted(() => vi.fn());
const mockCreateProjectAsset = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  asset: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db/env", () => ({
  hasDatabaseEnv: mockHasDatabaseEnv,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/providers/image-generation-job", () => ({
  ensureDefaultImageWorkspace: mockEnsureDefaultImageWorkspace,
}));

vi.mock("@/lib/providers/asset-storage", () => ({
  uploadBufferAssetToSupabase: mockUploadBufferAssetToSupabase,
}));

vi.mock("@/lib/flows/ownership", () => ({
  getOwnedExecutionScope: mockGetOwnedExecutionScope,
}));

vi.mock("@/lib/assets/project-assets", () => ({
  createProjectAsset: mockCreateProjectAsset,
}));

import { POST } from "@/app/api/assets/upload/route";

function makeMultipartRequest(file?: File, fields: Record<string, string> = {}) {
  const formData = new FormData();

  if (file) {
    formData.append("file", file);
  }
  for (const [key, value] of Object.entries(fields)) formData.append(key, value);

  return new Request("http://localhost/api/assets/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/assets/upload", () => {
  beforeEach(() => {
    mockHasDatabaseEnv.mockReset();
    mockEnsureDefaultImageWorkspace.mockReset();
    mockUploadBufferAssetToSupabase.mockReset();
    mockGetOwnedExecutionScope.mockReset();
    mockCreateProjectAsset.mockReset();
    mockPrisma.asset.create.mockReset();
    mockHasDatabaseEnv.mockReturnValue(true);
    mockEnsureDefaultImageWorkspace.mockResolvedValue({
      id: "workspace-id",
    });
    mockUploadBufferAssetToSupabase.mockResolvedValue({
      bucket: "assets",
      path: "workspaces/workspace-id/uploads/audio.mp3",
      url: "https://assets.example.com/audio.mp3",
      contentType: "audio/mpeg",
      sizeBytes: 3,
    });
    mockPrisma.asset.create.mockResolvedValue({
      id: "audio-asset-id",
    });
    mockGetOwnedExecutionScope.mockResolvedValue({ ownerId: "owner-a", workspaceId: "workspace-a" });
    mockCreateProjectAsset.mockResolvedValue({
      assetId: "image-asset-id",
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

  it("uploads a valid audio file and creates an AUDIO/UPLOADED Asset", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "trilha.mp3", {
      type: "audio/mpeg",
    });
    const response = await POST(makeMultipartRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      assetId: "audio-asset-id",
      url: "https://assets.example.com/audio.mp3",
      contentType: "audio/mpeg",
    });
    expect(mockUploadBufferAssetToSupabase).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-id",
        keyPrefix: "workspaces/workspace-id/uploads",
        contentType: "audio/mpeg",
        fileName: "trilha.mp3",
      }),
    );
    expect(mockPrisma.asset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-id",
        generationId: null,
        type: "AUDIO",
        origin: "UPLOADED",
        url: "https://assets.example.com/audio.mp3",
        storageBucket: "assets",
        storagePath: "workspaces/workspace-id/uploads/audio.mp3",
        contentType: "audio/mpeg",
        sizeBytes: 3,
      }),
    });
  });

  it("preserves extension-only audio compatibility with a canonical MIME", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "trilha.mp3", { type: "" });
    const response = await POST(makeMultipartRequest(file));

    expect(response.status).toBe(200);
    expect(mockUploadBufferAssetToSupabase).toHaveBeenCalledWith(expect.objectContaining({
      contentType: "audio/mpeg",
    }));
  });

  it("returns a readable error when the file is missing", async () => {
    const response = await POST(makeMultipartRequest());
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/Arquivo de áudio obrigatório/);
    expect(mockUploadBufferAssetToSupabase).not.toHaveBeenCalled();
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
  });

  it("returns a readable error when the file type is invalid", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "texto.txt", {
      type: "text/plain",
    });
    const response = await POST(makeMultipartRequest(file));
    const payload = await response.json();

    expect(response.status).toBe(415);
    expect(payload.error).toMatch(/Formato de áudio inválido/);
    expect(mockUploadBufferAssetToSupabase).not.toHaveBeenCalled();
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
  });

  it("uploads a project image through the scoped Asset service", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "produto.jpg", {
      type: "image/jpeg",
    });
    const response = await POST(makeMultipartRequest(file, {
      projectId: "project-a",
      role: "source",
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toEqual({ asset: expect.objectContaining({
      assetId: "image-asset-id",
      type: "IMAGE",
      projectRole: "source",
    }) });
    expect(payload.asset).not.toHaveProperty("storagePath");
    expect(mockGetOwnedExecutionScope).toHaveBeenCalledTimes(1);
    expect(mockCreateProjectAsset).toHaveBeenCalledWith({
      projectId: "project-a",
      scope: { ownerId: "owner-a", workspaceId: "workspace-a" },
      file: expect.any(File),
      role: "source",
    });
    expect(mockUploadBufferAssetToSupabase).not.toHaveBeenCalled();
    expect(mockPrisma.asset.create).not.toHaveBeenCalled();
  });

  it("requires a role for a project upload", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "produto.jpg", {
      type: "image/jpeg",
    });
    const response = await POST(makeMultipartRequest(file, { projectId: "project-a" }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Papel de Asset obrigatório/i);
    expect(mockCreateProjectAsset).not.toHaveBeenCalled();
  });

  it("rejects a project file with mismatched MIME and extension before upload", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "produto.jpg", {
      type: "image/png",
    });
    const response = await POST(makeMultipartRequest(file, {
      projectId: "project-a",
      role: "source",
    }));

    expect(response.status).toBe(415);
    expect((await response.json()).error).toMatch(/Formato de arquivo inválido/i);
    expect(mockCreateProjectAsset).not.toHaveBeenCalled();
    expect(mockUploadBufferAssetToSupabase).not.toHaveBeenCalled();
  });
});
