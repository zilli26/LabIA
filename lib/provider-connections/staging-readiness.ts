import { prisma } from "@/lib/db/prisma";
import { executorHeartbeatTtlMs, isExecutorHeartbeatFresh } from "@/lib/provider-connections/heartbeat";
import { getLocalOwnerId } from "@/lib/provider-connections/security";

function defaultWorkspaceSlug() {
  return process.env.DEFAULT_WORKSPACE_SLUG ?? "felipe-labia";
}

export type StagingReadiness = {
  executionAllowed: false;
  overall: "not_ready" | "unavailable";
  environment: {
    databaseUrl: { configured: boolean };
    directUrl: { configured: boolean };
    ownerId: { configured: boolean };
    storage: {
      supabaseUrl: { configured: boolean };
      serviceRoleKey: { configured: boolean };
      assetsBucket: { configured: boolean };
    };
  };
  database: {
    status: "not_configured" | "env_not_configured" | "available" | "unavailable" | "migration_missing";
    executorPairingTable: "not_checked" | "available" | "unknown" | "missing";
    message: string;
  };
  executor: {
    status: "not_configured" | "online" | "offline" | "unavailable";
    ttlMs: number;
    lastSeenAt: string | null;
    message: string;
  };
  worker: {
    status: "not_proven";
    message: string;
  };
};

const WORKER_NOT_PROVEN_MESSAGE =
  "Worker não comprovado por esta leitura segura; valide o processo de staging separadamente antes do teste.";
const OFFLINE_MESSAGE = "Executor pareado offline: heartbeat ausente ou fora do TTL.";
const UNAVAILABLE_MESSAGE = "Não foi possível consultar o banco de staging.";
const MIGRATION_MESSAGE = "A tabela ExecutorPairing não está disponível; confira a migration no staging.";

function isConfigured(value: string | undefined) {
  return Boolean(value?.trim());
}

function environmentStatus(): StagingReadiness["environment"] {
  return {
    databaseUrl: { configured: isConfigured(process.env.DATABASE_URL) },
    directUrl: { configured: isConfigured(process.env.DIRECT_URL) },
    ownerId: { configured: isConfigured(process.env.LABIA_LOCAL_OWNER_ID) },
    storage: {
      supabaseUrl: { configured: isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL) },
      serviceRoleKey: { configured: isConfigured(process.env.SUPABASE_SERVICE_ROLE_KEY) },
      assetsBucket: { configured: isConfigured(process.env.SUPABASE_ASSETS_BUCKET) },
    },
  };
}

function emptyExecutor(status: StagingReadiness["executor"]["status"], message: string): StagingReadiness["executor"] {
  return { status, ttlMs: executorHeartbeatTtlMs(), lastSeenAt: null, message };
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate.message !== "string" || !/executor.?pairing|executor_pairings/i.test(candidate.message)) return false;
  return candidate.code === "P2021" || /does not exist/i.test(candidate.message);
}

function isOwnerConfigurationError(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "owner_not_configured");
}

function baseResult(environment: StagingReadiness["environment"]): StagingReadiness {
  return {
    executionAllowed: false,
    overall: "not_ready",
    environment,
    database: {
      status: "not_configured",
      executorPairingTable: "not_checked",
      message: "Configure DATABASE_URL e DIRECT_URL para consultar o staging.",
    },
    executor: emptyExecutor("not_configured", "Nenhum executor pareado foi comprovado neste owner/workspace."),
    worker: { status: "not_proven", message: WORKER_NOT_PROVEN_MESSAGE },
  };
}

export async function getStagingReadiness(now = new Date()): Promise<StagingReadiness> {
  const environment = environmentStatus();
  const result = baseResult(environment);

  if (!environment.ownerId.configured) {
    result.database = {
      status: "env_not_configured",
      executorPairingTable: "not_checked",
      message: "Configure LABIA_LOCAL_OWNER_ID para consultar o staging.",
    };
    return result;
  }

  if (!environment.databaseUrl.configured || !environment.directUrl.configured) {
    return result;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    result.database = {
      status: "unavailable",
      executorPairingTable: "unknown",
      message: UNAVAILABLE_MESSAGE,
    };
    result.executor = emptyExecutor("unavailable", "O executor não pode ser consultado enquanto o banco está indisponível.");
    return result;
  }

  result.database = {
    status: "available",
    executorPairingTable: "available",
    message: "Banco de staging acessível.",
  };

  try {
    const workspace = await prisma.workspace.findUnique({
      where: { slug: defaultWorkspaceSlug() },
      select: { id: true },
    });
    const ownerId = getLocalOwnerId();
    const pairing = workspace
      ? await prisma.executorPairing.findFirst({
          where: { ownerId, workspaceId: workspace.id, status: "active" },
          orderBy: { lastSeenAt: "desc" },
          select: { state: true, lastSeenAt: true },
        })
      : null;

    if (!pairing) {
      result.executor = emptyExecutor("not_configured", "Nenhum executor pareado foi comprovado neste owner/workspace.");
      return result;
    }

    const lastSeenAt = pairing.lastSeenAt instanceof Date ? pairing.lastSeenAt : null;
    const fresh = isExecutorHeartbeatFresh(lastSeenAt, now, executorHeartbeatTtlMs());
    result.executor = {
      status: pairing.state === "online" && fresh ? "online" : "offline",
      ttlMs: executorHeartbeatTtlMs(),
      lastSeenAt: lastSeenAt?.toISOString() ?? null,
      message: pairing.state === "online" && fresh
        ? "Executor pareado online e dentro do TTL."
        : OFFLINE_MESSAGE,
    };
  } catch (error) {
    if (isOwnerConfigurationError(error)) {
      result.database = {
        status: "env_not_configured",
        executorPairingTable: "not_checked",
        message: "Configure LABIA_LOCAL_OWNER_ID para consultar o staging.",
      };
      result.executor = emptyExecutor("not_configured", "O owner do staging não está configurado.");
      return result;
    }
    if (isMissingTableError(error)) {
      result.database = {
        status: "migration_missing",
        executorPairingTable: "missing",
        message: MIGRATION_MESSAGE,
      };
      result.executor = emptyExecutor("unavailable", "A tabela de pareamento não está disponível no staging.");
      return result;
    }

    result.database = {
      status: "unavailable",
      executorPairingTable: "unknown",
      message: UNAVAILABLE_MESSAGE,
    };
    result.executor = emptyExecutor("unavailable", "Não foi possível consultar o executor pareado.");
  }

  return result;
}
