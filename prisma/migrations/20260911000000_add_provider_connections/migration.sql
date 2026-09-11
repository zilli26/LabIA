-- O1: conexões de provider são independentes das filas de geração.
CREATE TABLE "provider_connections" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "auth_method" TEXT NOT NULL,
    "session_ref" TEXT NOT NULL,
    "auth_status" TEXT NOT NULL DEFAULT 'disconnected',
    "executor_status" TEXT NOT NULL DEFAULT 'offline',
    "generation_validation_status" TEXT NOT NULL DEFAULT 'unvalidated',
    "account_label" TEXT,
    "plan_type" TEXT,
    "login_id" TEXT,
    "login_expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_capabilities" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unverified',
    "evidence" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_capabilities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_connections_session_ref_key" ON "provider_connections"("session_ref");
CREATE INDEX "provider_connections_workspace_id_owner_id_idx" ON "provider_connections"("workspace_id", "owner_id");
CREATE INDEX "provider_connections_provider_auth_status_idx" ON "provider_connections"("provider", "auth_status");
CREATE UNIQUE INDEX "provider_capabilities_connection_id_key_key" ON "provider_capabilities"("connection_id", "key");
CREATE INDEX "provider_capabilities_key_status_idx" ON "provider_capabilities"("key", "status");

ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_capabilities" ADD CONSTRAINT "provider_capabilities_connection_id_fkey"
  FOREIGN KEY ("connection_id") REFERENCES "provider_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Estas tabelas contêm referências de sessão e estados de autenticação pessoais.
-- O1 usa apenas Prisma/server-side; não existe leitura direta legítima pelo client Supabase.
ALTER TABLE "provider_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_connections" FORCE ROW LEVEL SECURITY;
ALTER TABLE "provider_capabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_capabilities" FORCE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "provider_connections" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE "provider_capabilities" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE "provider_connections" FROM anon;
    REVOKE ALL PRIVILEGES ON TABLE "provider_capabilities" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE "provider_connections" FROM authenticated;
    REVOKE ALL PRIVILEGES ON TABLE "provider_capabilities" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL PRIVILEGES ON TABLE "provider_connections" FROM service_role;
    REVOKE ALL PRIVILEGES ON TABLE "provider_capabilities" FROM service_role;
  END IF;
END
$$;

-- Nenhuma policy é criada de propósito. A API do Supabase não deve expor estas tabelas.
