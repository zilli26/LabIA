export const PROJECT_ASSET_ROLES = ["source", "reference", "audio"] as const;

export type ProjectAssetRole = (typeof PROJECT_ASSET_ROLES)[number];
export type ProjectAssetType = "IMAGE" | "VIDEO" | "AUDIO";

export const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024;
export const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;

const FILE_RULES = [
  {
    type: "IMAGE" as const,
    extensions: ["jpg", "jpeg", "png", "webp"],
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: MAX_IMAGE_UPLOAD_BYTES,
  },
  {
    type: "VIDEO" as const,
    extensions: ["mp4", "mov", "webm"],
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    maxBytes: MAX_VIDEO_UPLOAD_BYTES,
  },
  {
    type: "AUDIO" as const,
    extensions: ["aac", "m4a", "mp3", "ogg", "wav"],
    mimeTypes: [
      "audio/aac",
      "audio/mp3",
      "audio/mpeg",
      "audio/mp4",
      "audio/m4a",
      "audio/ogg",
      "audio/wav",
      "audio/wave",
      "audio/x-m4a",
      "audio/x-wav",
    ],
    maxBytes: MAX_AUDIO_UPLOAD_BYTES,
  },
] as const;

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "video/mp4": ["mp4"],
  "video/quicktime": ["mov"],
  "video/webm": ["webm"],
  "audio/aac": ["aac"],
  "audio/mp3": ["mp3"],
  "audio/mpeg": ["mp3"],
  "audio/mp4": ["m4a", "mp4"],
  "audio/m4a": ["m4a"],
  "audio/ogg": ["ogg"],
  "audio/wav": ["wav"],
  "audio/wave": ["wav"],
  "audio/x-m4a": ["m4a"],
  "audio/x-wav": ["wav"],
};

export type ProjectAssetMetadata = {
  originalFileName: string;
  projectRole?: ProjectAssetRole;
};

export class AssetInputValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AssetInputValidationError";
    this.status = status;
  }
}

function fileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function canonicalContentType(type: ProjectAssetType, extension: string) {
  if (type === "IMAGE") {
    return extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;
  }

  if (type === "VIDEO") {
    return extension === "mov" ? "video/quicktime" : `video/${extension}`;
  }

  if (extension === "mp3") return "audio/mpeg";
  if (extension === "m4a") return "audio/mp4";
  if (extension === "wav") return "audio/wav";
  return `audio/${extension}`;
}

function maxSizeLabel(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function safeOriginalFileName(fileName: string) {
  const baseName = fileName.split(/[\\/]/).pop()?.trim() ?? "";
  return baseName.slice(0, 255) || "upload";
}

export function validateProjectAssetFile(file: File, role: ProjectAssetRole | string) {
  if (!(file instanceof File)) {
    throw new AssetInputValidationError("Arquivo obrigatório.");
  }

  if (file.size <= 0) {
    throw new AssetInputValidationError("O arquivo está vazio.");
  }

  if (!PROJECT_ASSET_ROLES.includes(role as ProjectAssetRole)) {
    throw new AssetInputValidationError("Papel de Asset inválido. Use source, reference ou audio.");
  }

  const extension = fileExtension(file.name);
  const contentType = file.type.trim().toLowerCase();
  const hasKnownMime = Boolean(contentType && contentType !== "application/octet-stream");
  const rule = FILE_RULES.find((candidate) =>
    candidate.extensions.includes(extension as never) || candidate.mimeTypes.includes(contentType as never),
  );

  if (
    !rule ||
    !rule.extensions.includes(extension as never) ||
    (rule.type !== "AUDIO" && !hasKnownMime) ||
    (hasKnownMime && !rule.mimeTypes.includes(contentType as never)) ||
    (hasKnownMime && !MIME_EXTENSIONS[contentType]?.includes(extension))
  ) {
    throw new AssetInputValidationError(
      "Formato de arquivo inválido. Verifique o tipo MIME e a extensão permitidos.",
      415,
    );
  }

  if (file.size > rule.maxBytes) {
    throw new AssetInputValidationError(
      `O arquivo precisa ter no máximo ${maxSizeLabel(rule.maxBytes)}.`,
      413,
    );
  }

  const validRole = rule.type === "AUDIO" ? role === "audio" : role === "source" || role === "reference";
  if (!validRole) {
    throw new AssetInputValidationError(
      rule.type === "AUDIO"
        ? "Áudio deve usar o papel audio."
        : "Imagem ou vídeo deve usar o papel source ou reference.",
    );
  }

  return {
    type: rule.type,
    projectRole: role as ProjectAssetRole,
    extension,
    contentType: hasKnownMime ? contentType : canonicalContentType(rule.type, extension),
    maxBytes: rule.maxBytes,
  };
}

export function parseProjectAssetMetadata(value: unknown): ProjectAssetMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AssetInputValidationError("Metadata de Asset inválida.");
  }

  const source = value as Record<string, unknown>;
  const keys = Object.keys(source);
  if (keys.some((key) => key !== "originalFileName" && key !== "projectRole")) {
    throw new AssetInputValidationError("Metadata de Asset contém campos não permitidos.");
  }

  if (typeof source.originalFileName !== "string" || !source.originalFileName.trim() || source.originalFileName.length > 255) {
    throw new AssetInputValidationError("Nome original do Asset inválido.");
  }

  if (source.projectRole !== undefined && !PROJECT_ASSET_ROLES.includes(source.projectRole as ProjectAssetRole)) {
    throw new AssetInputValidationError("Papel de Asset inválido.");
  }

  return {
    originalFileName: source.originalFileName,
    ...(source.projectRole === undefined ? {} : { projectRole: source.projectRole as ProjectAssetRole }),
  };
}
