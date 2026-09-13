import { randomBytes } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  createExecutorPairingWithClient,
  type ExecutorPairingStatus,
} from "@/lib/provider-connections/pairing";
import { getLocalOwnerId } from "@/lib/provider-connections/security";

export const PROVISION_CONFIRMATION = "PROVISION_EXECUTOR_PAIRING_FOR_STAGING";
const DEFAULT_LABEL = "LabIA staging executor";

export class ProvisionExecutorPairingError extends Error {
  constructor(public readonly code: "confirmation_required" | "invalid_arguments" | "owner_not_configured" | "workspace_not_found" | "existing_pairing" | "migration_required" | "database_unavailable", message: string) {
    super(message);
    this.name = "ProvisionExecutorPairingError";
  }
}

export type ProvisionExecutorPairingOptions = {
  confirmation: string;
  label?: string;
  allowExistingPairing?: boolean;
};

export type ProvisionedPairing = {
  pairingId: string;
  secret: string;
};

type ProvisionDependencies = {
  getOwnerId: typeof getLocalOwnerId;
  findWorkspace: typeof prisma.workspace.findUnique;
  transaction: <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
  createPairing: (
    client: Pick<Prisma.TransactionClient, "executorPairing">,
    input: { workspaceId: string; ownerId: string; label: string; secret: string },
  ) => Promise<ExecutorPairingStatus>;
  generateSecret: () => string;
};

function dependencies(): ProvisionDependencies {
  return {
    getOwnerId: getLocalOwnerId,
    findWorkspace: prisma.workspace.findUnique,
    transaction: <T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) => prisma.$transaction(callback),
    createPairing: createExecutorPairingWithClient,
    generateSecret: () => randomBytes(32).toString("base64url"),
  };
}

function argumentValue(argument: string, name: string, next: string | undefined) {
  if (argument.startsWith(`${name}=`)) return argument.slice(name.length + 1);
  if (argument === name && next !== undefined) return next;
  throw new ProvisionExecutorPairingError("invalid_arguments", `Use ${name} com um valor.`);
}

export function parseProvisionArgs(argv: readonly string[]): ProvisionExecutorPairingOptions {
  const options: ProvisionExecutorPairingOptions = { confirmation: "", allowExistingPairing: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--allow-existing-pairing") {
      options.allowExistingPairing = true;
      continue;
    }
    if (argument === "--confirm" || argument.startsWith("--confirm=")) {
      options.confirmation = argumentValue(argument, "--confirm", argv[index + 1]);
      if (argument === "--confirm") index += 1;
      continue;
    }
    if (argument === "--label" || argument.startsWith("--label=")) {
      options.label = argumentValue(argument, "--label", argv[index + 1]);
      if (argument === "--label") index += 1;
      continue;
    }
    throw new ProvisionExecutorPairingError("invalid_arguments", "Argumento desconhecido.");
  }
  return options;
}

function assertSafeLabel(label: string) {
  if (!label || label.length > 80 || /[\r\n]/.test(label)) {
    throw new ProvisionExecutorPairingError("invalid_arguments", "Label invalido.");
  }
}

function isMissingPairingTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "P2021" || (typeof candidate.message === "string" && /executor.?pairing|executor_pairings/i.test(candidate.message) && /does not exist|no existe/i.test(candidate.message));
}

export async function provisionExecutorPairing(
  options: ProvisionExecutorPairingOptions,
  injected: Partial<ProvisionDependencies> = {},
): Promise<ProvisionedPairing> {
  if (options.confirmation !== PROVISION_CONFIRMATION) {
    throw new ProvisionExecutorPairingError("confirmation_required", `Confirmacao obrigatoria: use --confirm ${PROVISION_CONFIRMATION}.`);
  }
  const deps = { ...dependencies(), ...injected };
  const label = options.label?.trim() || DEFAULT_LABEL;
  assertSafeLabel(label);

  let ownerId: string;
  try {
    ownerId = deps.getOwnerId();
  } catch {
    throw new ProvisionExecutorPairingError("owner_not_configured", "LABIA_LOCAL_OWNER_ID nao esta configurado.");
  }

  const workspaceSlug = process.env.DEFAULT_WORKSPACE_SLUG?.trim() || "felipe-labia";
  let workspace: { id: string } | null;
  try {
    workspace = await deps.findWorkspace({ where: { slug: workspaceSlug }, select: { id: true } });
  } catch {
    throw new ProvisionExecutorPairingError("database_unavailable", "Nao foi possivel consultar o workspace local.");
  }
  if (!workspace) throw new ProvisionExecutorPairingError("workspace_not_found", "Workspace local nao encontrado.");

  try {
    return await deps.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}), hashtext(${workspace.id}))`;
      let existing: { id: string; label: string } | null;
      try {
        existing = await tx.executorPairing.findFirst({
          where: { ownerId, workspaceId: workspace.id, status: "active" },
          select: { id: true, label: true },
        });
      } catch (error) {
        throw new ProvisionExecutorPairingError(
          isMissingPairingTable(error) ? "migration_required" : "database_unavailable",
          isMissingPairingTable(error) ? "A migration de ExecutorPairing precisa estar aplicada no staging." : "Nao foi possivel consultar os pairings existentes.",
        );
      }
      if (existing && !options.allowExistingPairing) {
        throw new ProvisionExecutorPairingError("existing_pairing", "Ja existe um pairing ativo; use --allow-existing-pairing para criar outro. Nada foi sobrescrito.");
      }

      const secret = deps.generateSecret();
      try {
        const status = await deps.createPairing(tx, { workspaceId: workspace.id, ownerId, label, secret });
        if (!status.pairingId) throw new Error("pairing_id_missing");
        return { pairingId: status.pairingId, secret };
      } catch (error) {
        throw new ProvisionExecutorPairingError(
          isMissingPairingTable(error) ? "migration_required" : "database_unavailable",
          isMissingPairingTable(error) ? "A migration de ExecutorPairing precisa estar aplicada no staging." : "Nao foi possivel criar o pairing no banco.",
        );
      }
    });
  } catch (error) {
    if (error instanceof ProvisionExecutorPairingError) throw error;
    throw new ProvisionExecutorPairingError("database_unavailable", "Nao foi possivel concluir o provisionamento no banco.");
  }
}

export function formatProvisionedPairing(pairing: ProvisionedPairing) {
  return [
    `LABIA_EXECUTOR_PAIRING_ID=${pairing.pairingId}`,
    `LABIA_EXECUTOR_PAIRING_SECRET=${pairing.secret}`,
    "",
    "Proximo passo: configure esses dois nomes somente no ambiente local do executor; nao salve o segredo no repositorio, docs ou logs.",
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  loadEnvConfig(process.cwd());
  try {
    const pairing = await provisionExecutorPairing(parseProvisionArgs(argv));
    process.stdout.write(`${formatProvisionedPairing(pairing)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof ProvisionExecutorPairingError ? error.message : "Falha segura no provisionamento do pairing.";
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/provision-executor-pairing.ts")) {
  void main().then((exitCode) => {
    if (exitCode !== 0) process.exitCode = exitCode;
  });
}
