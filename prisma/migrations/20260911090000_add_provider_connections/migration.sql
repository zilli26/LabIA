CREATE TABLE "provider_connections" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "owner_key" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "auth_method" TEXT NOT NULL,
  "credential_ref" TEXT NOT NULL,
  "connection_state" TEXT NOT NULL DEFAULT 'disconnected',
  "executor_state" TEXT NOT NULL DEFAULT 'stopped',
  "capability_state" TEXT NOT NULL DEFAULT 'unverified',
  "capabilities" JSONB,
  "account_label" TEXT,
  "pending_login_id" TEXT,
  "pending_login_type" TEXT,
  "pending_login_expires_at" TIMESTAMP(3),
  "connected_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "disconnected_at" TIMESTAMP(3),
  "last_checked_at" TIMESTAMP(3),
  "last_error_code" TEXT,
  "last_error_at" TIMESTAMP(3),
  "generation_validated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "provider_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_connections_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "provider_connections_connection_state_check"
    CHECK ("connection_state" IN ('disconnected', 'connecting', 'connected', 'expired', 'error')),
  CONSTRAINT "provider_connections_executor_state_check"
    CHECK ("executor_state" IN ('stopped', 'starting', 'ready', 'error')),
  CONSTRAINT "provider_connections_capability_state_check"
    CHECK ("capability_state" IN ('unverified', 'verified', 'unavailable', 'error'))
);

CREATE UNIQUE INDEX "provider_connections_credential_ref_key"
  ON "provider_connections"("credential_ref");
CREATE INDEX "provider_connections_workspace_id_owner_key_idx"
  ON "provider_connections"("workspace_id", "owner_key");
CREATE INDEX "provider_connections_provider_connection_state_idx"
  ON "provider_connections"("provider", "connection_state");
