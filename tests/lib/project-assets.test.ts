import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  assetFindMany: vi.fn(),
  assetCreate: vi.fn(),
  uploadBufferAssetToSupabase: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    project: { findFirst: mocks.projectFindFirst },
    asset: {
      findMany: mocks.assetFindMany,
      create: mocks.assetCreate,
    },
  },
}));

vi.mock("@/lib/providers/asset-storage", () => ({
  uploadBufferAssetToSupabase: mocks.uploadBufferAssetToSupabase,
}));

import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  parseProjectAssetMetadata,
  validateProjectAssetFile,
} from "@/lib/assets/asset-input";
import { createProjectAsset, listProjectAssets } from "@/lib/assets/project-assets";

const scope = { ownerId: "owner-a", workspaceId: "workspace-a" };

function file(name: string, type: string, bytes = [1, 2, 3]) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("project asset input", () => {
  it.each([
    ["produto.jpg", "image/jpeg", "IMAGE", "source"],
    ["produto.png", "image/png", "IMAGE", "reference"],
    ["produto.webp", "image/webp", "IMAGE", "source"],
    ["demo.mp4", "video/mp4", "VIDEO", "source"],
    ["demo.mov", "video/quicktime", "VIDEO", "reference"],
    ["demo.webm", "video/webm", "VIDEO", "source"],
    ["trilha.mp3", "audio/mpeg", "AUDIO", "audio"],
  ] as const)("accepts %s as %s/%s", (name, type, expectedType, role) => {
    expect(validateProjectAssetFile(file(name, type), role)).toMatchObject({
      type: expectedType,
      contentType: type,
      projectRole: role,
    });
  });

  it.each([
    ["arquivo.txt", "text/plain", "source"],
    ["produto.jpg", "image/png", "source"],
    ["produto.png", "image/png", "audio"],
    ["trilha.mp3", "audio/mpeg", "reference"],
    ["produto", "image/jpeg", "source"],
  ] as const)("rejects invalid type, extension or role: %s", (name, type, role) => {
    expect(() => validateProjectAssetFile(file(name, type), role)).toThrow();
  });

  it("rejects empty files and files above the category limit", () => {
    expect(() => validateProjectAssetFile(file("produto.jpg", "image/jpeg", []), "source")).toThrow(/vazio/i);

    const oversized = new File([new Uint8Array(1)], "produto.jpg", { type: "image/jpeg" });
    Object.defineProperty(oversized, "size", { value: MAX_IMAGE_UPLOAD_BYTES + 1 });
    expect(() => validateProjectAssetFile(oversized, "source")).toThrow(/25 MB/i);

    expect(MAX_VIDEO_UPLOAD_BYTES).toBeGreaterThan(MAX_IMAGE_UPLOAD_BYTES);
    expect(MAX_AUDIO_UPLOAD_BYTES).toBeGreaterThan(0);
  });

  it("parses only allowlisted metadata", () => {
    expect(parseProjectAssetMetadata({
      originalFileName: "produto.jpg",
      projectRole: "source",
    })).toEqual({
      originalFileName: "produto.jpg",
      projectRole: "source",
    });

    expect(() => parseProjectAssetMetadata({
      originalFileName: "produto.jpg",
      projectRole: "source",
      secret: "não deve sair",
    })).toThrow(/metadata/i);
  });
});

describe("project asset persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.projectFindFirst.mockResolvedValue({ id: "project-a", workspaceId: "workspace-a" });
    mocks.uploadBufferAssetToSupabase.mockResolvedValue({
      bucket: "assets",
      path: "workspaces/workspace-a/projects/project-a/produto.jpg",
      url: "https://assets.example.com/produto.jpg",
      contentType: "image/jpeg",
      sizeBytes: 3,
    });
    mocks.assetCreate.mockResolvedValue({
      id: "asset-a",
      type: "IMAGE",
      origin: "UPLOADED",
      url: "https://assets.example.com/produto.jpg",
      contentType: "image/jpeg",
      sizeBytes: 3,
      width: null,
      height: null,
      metadata: { originalFileName: "produto.jpg", projectRole: "source" },
    });
  });

  it("verifies the project scope before Storage and creates an UPLOADED Asset linked to it", async () => {
    const result = await createProjectAsset({
      projectId: "project-a",
      scope,
      file: file("produto.jpg", "image/jpeg"),
      role: "source",
    });

    expect(mocks.projectFindFirst).toHaveBeenCalledWith({
      where: { id: "project-a", workspaceId: "workspace-a" },
      select: { id: true, workspaceId: true },
    });
    expect(mocks.uploadBufferAssetToSupabase).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "workspace-a",
      keyPrefix: "workspaces/workspace-a/projects/project-a",
      contentType: "image/jpeg",
      fileName: "produto.jpg",
    }));
    expect(mocks.assetCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: "workspace-a",
        projectId: "project-a",
        generationId: null,
        type: "IMAGE",
        origin: "UPLOADED",
        metadata: { originalFileName: "produto.jpg", projectRole: "source" },
      }),
    });
    expect(result).toEqual(expect.objectContaining({
      assetId: "asset-a",
      type: "IMAGE",
      projectRole: "source",
      origin: "UPLOADED",
    }));
    expect(result).not.toHaveProperty("storageBucket");
    expect(result).not.toHaveProperty("storagePath");
  });

  it("does not upload a project from another workspace", async () => {
    mocks.projectFindFirst.mockResolvedValue(null);

    await expect(createProjectAsset({
      projectId: "foreign-project",
      scope,
      file: file("produto.jpg", "image/jpeg"),
      role: "source",
    })).resolves.toBeNull();

    expect(mocks.uploadBufferAssetToSupabase).not.toHaveBeenCalled();
    expect(mocks.assetCreate).not.toHaveBeenCalled();
  });

  it("lists only assets of the scoped project and returns no Storage secrets", async () => {
    mocks.assetFindMany.mockResolvedValue([{
      id: "asset-a",
      type: "IMAGE",
      origin: "UPLOADED",
      url: "https://assets.example.com/produto.jpg",
      contentType: "image/jpeg",
      sizeBytes: 3,
      width: 1080,
      height: 1920,
      metadata: { originalFileName: "produto.jpg", projectRole: "reference" },
      storageBucket: "assets",
      storagePath: "private/path",
    }]);

    const result = await listProjectAssets("project-a", scope);

    expect(mocks.assetFindMany).toHaveBeenCalledWith({
      where: { projectId: "project-a", workspaceId: "workspace-a" },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual([expect.objectContaining({
      assetId: "asset-a",
      projectRole: "reference",
      width: 1080,
      height: 1920,
    })]);
    expect(result?.[0]).not.toHaveProperty("storageBucket");
    expect(result?.[0]).not.toHaveProperty("storagePath");
  });
});
