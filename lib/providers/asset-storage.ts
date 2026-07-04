import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const DEFAULT_ASSETS_BUCKET = "assets";

export type UploadRemoteAssetInput = {
  sourceUrl: string;
  workspaceId: string;
  generationId: string;
  contentType?: string;
  fileName?: string;
};

export type UploadBufferAssetInput = {
  bytes: Buffer;
  workspaceId: string;
  generationId?: string;
  keyPrefix?: string;
  contentType: string;
  fileName?: string;
  sourceUrl?: string;
};

export type UploadedAsset = {
  bucket: string;
  path: string;
  url: string;
  contentType: string;
  sizeBytes: number;
};

function createSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    return "jpg";
  }

  if (contentType.includes("png")) {
    return "png";
  }

  if (contentType.includes("webp")) {
    return "webp";
  }

  if (contentType.includes("gif")) {
    return "gif";
  }

  return undefined;
}

function extensionFromName(name?: string) {
  const match = name?.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
  return match?.[1]?.toLowerCase();
}

function getAssetExtension({
  contentType,
  fileName,
  sourceUrl,
}: {
  contentType: string;
  fileName?: string;
  sourceUrl?: string;
}) {
  return (
    extensionFromContentType(contentType) ??
    extensionFromName(fileName) ??
    extensionFromName(sourceUrl) ??
    "bin"
  );
}

export async function uploadRemoteAssetToSupabase({
  sourceUrl,
  workspaceId,
  generationId,
  contentType,
  fileName,
}: UploadRemoteAssetInput): Promise<UploadedAsset> {
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(`Falha ao baixar asset remoto (${response.status}): ${sourceUrl}`);
  }

  const responseContentType =
    response.headers.get("content-type") ?? contentType ?? "application/octet-stream";
  const bytes = Buffer.from(await response.arrayBuffer());

  return uploadBufferAssetToSupabase({
    bytes,
    workspaceId,
    generationId,
    contentType: responseContentType,
    fileName,
    sourceUrl,
  });
}

export async function uploadBufferAssetToSupabase({
  bytes,
  workspaceId,
  generationId,
  keyPrefix,
  contentType,
  fileName,
  sourceUrl,
}: UploadBufferAssetInput): Promise<UploadedAsset> {
  const extension = getAssetExtension({
    contentType,
    fileName,
    sourceUrl,
  });
  const bucket = process.env.SUPABASE_ASSETS_BUCKET ?? DEFAULT_ASSETS_BUCKET;
  const prefix =
    keyPrefix?.replace(/^\/+|\/+$/g, "") ??
    (generationId ? `workspaces/${workspaceId}/generations/${generationId}` : undefined);

  if (!prefix) {
    throw new Error("Upload de asset exige generationId ou keyPrefix.");
  }

  const path = `${prefix}/${randomUUID()}.${extension}`;
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Falha no upload para Supabase Storage: ${error.message}`);
  }

  const publicUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

  return {
    bucket,
    path,
    url: publicUrl,
    contentType,
    sizeBytes: bytes.byteLength,
  };
}
