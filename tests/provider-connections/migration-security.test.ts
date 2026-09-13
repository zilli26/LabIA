import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260911000000_add_provider_connections",
  "migration.sql",
);
const executorPairingMigrationPath = path.join(
  process.cwd(),
  "prisma",
  "migrations",
  "20260913000000_add_executor_pairings",
  "migration.sql",
);

describe("provider connection migration security", () => {
  it("habilita e força RLS nas duas tabelas", async () => {
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toContain('ALTER TABLE "provider_connections" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "provider_connections" FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "provider_capabilities" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "provider_capabilities" FORCE ROW LEVEL SECURITY');
  });

  it("revoga acesso dos papéis expostos pela API do Supabase", async () => {
    const sql = await readFile(migrationPath, "utf8");
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(sql).toContain(`rolname = '${role}'`);
    }
    expect(sql).toContain('REVOKE ALL PRIVILEGES ON TABLE "provider_connections" FROM PUBLIC');
    expect(sql).toContain('REVOKE ALL PRIVILEGES ON TABLE "provider_capabilities" FROM PUBLIC');
  });

  it("protege o pareamento com RLS e revoga acesso da Data API", async () => {
    const sql = await readFile(executorPairingMigrationPath, "utf8");
    expect(sql).toContain('"secret_hash" TEXT NOT NULL');
    expect(sql).toContain('"last_sequence" BIGINT NOT NULL DEFAULT 0');
    expect(sql).toContain('ALTER TABLE "executor_pairings" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE "executor_pairings" FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL PRIVILEGES ON TABLE "executor_pairings" FROM PUBLIC');
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect(sql).toContain(`rolname = '${role}'`);
    }
  });
});
