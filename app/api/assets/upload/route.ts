import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultImageWorkspace } from "@/lib/providers/image-generation-job";
import { uploadBufferAssetToSupabase } from "@/lib/providers/asset-storage";

export const dynamic = "force-dynamic";

const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/aac",
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-m4a",
  "audio/x-wav",
]);

function isValidAudioFile(file: File) {
  const contentType = file.type.toLowerCase();

  return (
    ALLOWED_AUDIO_TYPES.has(contentType) ||
    /\.(aac|m4a|mp3|ogg|wav)$/i.test(file.name)
  );
}

export async function POST(request: Request) {
  if (!hasDatabaseEnv()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL e DIRECT_URL não estão configuradas. Preencha .env.local e rode as migrations do Prisma.",
      },
      { status: 503 },
    );
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Envie um formulário multipart/form-data com um arquivo de áudio." },
      { status: 400 },
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Arquivo de áudio obrigatório." },
      { status: 400 },
    );
  }

  if (file.size <= 0) {
    return NextResponse.json(
      { error: "O arquivo de áudio está vazio." },
      { status: 400 },
    );
  }

  if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "O áudio precisa ter no máximo 25 MB." },
      { status: 413 },
    );
  }

  if (!isValidAudioFile(file)) {
    return NextResponse.json(
      { error: "Formato de áudio inválido. Envie MP3, WAV, M4A, AAC ou OGG." },
      { status: 415 },
    );
  }

  try {
    const workspace = await ensureDefaultImageWorkspace();
    const contentType = file.type || "application/octet-stream";
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBufferAssetToSupabase({
      bytes,
      workspaceId: workspace.id,
      keyPrefix: `workspaces/${workspace.id}/uploads`,
      contentType,
      fileName: file.name,
    });
    const asset = await prisma.asset.create({
      data: {
        workspaceId: workspace.id,
        generationId: null,
        type: "AUDIO",
        origin: "UPLOADED",
        url: uploaded.url,
        storageBucket: uploaded.bucket,
        storagePath: uploaded.path,
        contentType: uploaded.contentType,
        sizeBytes: uploaded.sizeBytes,
        metadata: {
          originalFileName: file.name,
        },
      },
    });

    return NextResponse.json({
      assetId: asset.id,
      url: uploaded.url,
      contentType: uploaded.contentType,
    });
  } catch (error) {
    console.error("Failed to upload audio asset", error);

    return NextResponse.json(
      {
        error:
          "Não foi possível enviar o áudio. Verifique a conexão com Supabase e tente novamente.",
      },
      { status: 503 },
    );
  }
}
