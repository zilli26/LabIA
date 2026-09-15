import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  parseProjectAssetMetadata,
  safeOriginalFileName,
  validateProjectAssetFile,
  type ProjectAssetRole,
} from "@/lib/assets/asset-input";
import { uploadBufferAssetToSupabase } from "@/lib/providers/asset-storage";

export type ProjectAssetScope = {
  ownerId: string;
  workspaceId: string;
};

export type CreateProjectAssetInput = {
  projectId: string;
  scope: ProjectAssetScope;
  file: File;
  role: ProjectAssetRole | string;
};

export type PublicProjectAsset = {
  assetId: string;
  url: string;
  type: string;
  origin: string;
  projectRole?: ProjectAssetRole;
  contentType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
};

async function findScopedProject(projectId: string, scope: ProjectAssetScope) {
  return prisma.project.findFirst({
    where: { id: projectId, workspaceId: scope.workspaceId },
    select: { id: true, workspaceId: true },
  });
}

function readProjectRole(metadata: Prisma.JsonValue | null | undefined) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;

  try {
    return parseProjectAssetMetadata(metadata).projectRole;
  } catch {
    return undefined;
  }
}

export function toPublicProjectAsset(asset: {
  id: string;
  url: string;
  type: string;
  origin: string;
  contentType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  metadata?: Prisma.JsonValue | null;
}): PublicProjectAsset {
  const projectRole = readProjectRole(asset.metadata);

  return {
    assetId: asset.id,
    url: asset.url,
    type: asset.type,
    origin: asset.origin,
    ...(projectRole ? { projectRole } : {}),
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
  };
}

export async function createProjectAsset({ projectId, scope, file, role }: CreateProjectAssetInput) {
  const project = await findScopedProject(projectId, scope);
  if (!project) return null;

  const validated = validateProjectAssetFile(file, role);
  const originalFileName = safeOriginalFileName(file.name);
  const bytes = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadBufferAssetToSupabase({
    bytes,
    workspaceId: scope.workspaceId,
    keyPrefix: `workspaces/${scope.workspaceId}/projects/${projectId}`,
    contentType: validated.contentType,
    fileName: originalFileName,
  });

  const asset = await prisma.asset.create({
    data: {
      assetKey: `upload:${randomUUID()}`,
      outputIndex: 0,
      workspaceId: scope.workspaceId,
      projectId,
      generationId: null,
      type: validated.type,
      origin: "UPLOADED",
      url: uploaded.url,
      storageBucket: uploaded.bucket,
      storagePath: uploaded.path,
      contentType: uploaded.contentType,
      sizeBytes: uploaded.sizeBytes,
      metadata: {
        originalFileName,
        projectRole: validated.projectRole,
      },
    },
  });

  return toPublicProjectAsset(asset);
}

export async function listProjectAssets(projectId: string, scope: ProjectAssetScope) {
  const project = await findScopedProject(projectId, scope);
  if (!project) return null;

  const assets = await prisma.asset.findMany({
    where: { projectId, workspaceId: scope.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return assets.map(toPublicProjectAsset);
}
