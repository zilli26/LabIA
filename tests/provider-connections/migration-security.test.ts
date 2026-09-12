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
});
