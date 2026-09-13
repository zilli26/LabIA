-- O5-P0: pareamento limitado para heartbeat outbound; o segredo nunca é armazenado em claro.
CREATE TABLE "executor_pairings" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "executor_version" TEXT,
    "state" TEXT NOT NULL DEFAULT 'offline',
    "last_seen_at" TIMESTAMP(3),
    "last_sequence" BIGINT NOT NULL DEFAULT 0,
    "snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "executor_pairings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "executor_pairings_workspace_id_owner_id_idx" ON "executor_pairings"("workspace_id", "owner_id");
CREATE INDEX "executor_pairings_status_last_seen_at_idx" ON "executor_pairings"("status", "last_seen_at");

ALTER TABLE "executor_pairings" ADD CONSTRAINT "executor_pairings_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "executor_pairings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "executor_pairings" FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "executor_pairings" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE "executor_pairings" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE "executor_pairings" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL PRIVILEGES ON TABLE "executor_pairings" FROM service_role;
  END IF;
END
$$;

-- Nenhuma policy é criada: o control-plane usa Prisma server-side e verifica o escopo.
