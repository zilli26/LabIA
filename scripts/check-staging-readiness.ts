import { loadEnvConfig } from "@next/env";

import { getStagingReadiness, type StagingReadiness } from "@/lib/provider-connections/staging-readiness";

loadEnvConfig(process.cwd());

function label(configured: boolean) {
  return configured ? "configurada" : "ausente";
}

export function formatStagingReadinessReport(readiness: StagingReadiness) {
  return [
    `Resultado: ${readiness.overall}`,
    `DATABASE_URL: ${label(readiness.environment.databaseUrl.configured)}`,
    `DIRECT_URL: ${label(readiness.environment.directUrl.configured)}`,
    `Storage URL: ${label(readiness.environment.storage.supabaseUrl.configured)}`,
    `Storage service key: ${label(readiness.environment.storage.serviceRoleKey.configured)}`,
    `Storage bucket: ${label(readiness.environment.storage.assetsBucket.configured)}`,
    `Banco: ${readiness.database.status}`,
    `Tabela ExecutorPairing: ${readiness.database.executorPairingTable}`,
    `Executor: ${readiness.executor.status} (TTL ${readiness.executor.ttlMs} ms)`,
    `Worker: ${readiness.worker.status}`,
    `Instrução: ${readiness.worker.message}`,
    "Execução permitida por este check: não",
  ].join("\n");
}

export async function main() {
  const readiness = await getStagingReadiness();
  process.stdout.write(`${formatStagingReadinessReport(readiness)}\n`);
  if (!readiness.executionAllowed) process.exitCode = 1;
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/check-staging-readiness.ts")) {
  void main();
}
