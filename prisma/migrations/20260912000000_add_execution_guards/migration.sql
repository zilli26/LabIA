ALTER TABLE "generations"
  ADD COLUMN "connection_id" TEXT,
  ADD COLUMN "operation_key" TEXT,
  ADD COLUMN "submission_state" TEXT NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN "billing_mode" TEXT NOT NULL DEFAULT 'api',
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BRL';

UPDATE "generations"
SET "operation_key" = 'legacy:' || "id"
WHERE "operation_key" IS NULL;

ALTER TABLE "generations"
  ALTER COLUMN "operation_key" SET NOT NULL;

CREATE UNIQUE INDEX "generations_operation_key_key"
  ON "generations" ("operation_key");

ALTER TABLE "assets"
  ADD COLUMN "output_index" INTEGER;

WITH ranked_assets AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "generation_id"
      ORDER BY "created_at", "id"
    ) - 1 AS "ranked_index"
  FROM "assets"
)
UPDATE "assets" AS asset
SET "output_index" = ranked_assets."ranked_index"
FROM ranked_assets
WHERE asset."id" = ranked_assets."id";

ALTER TABLE "assets"
  ALTER COLUMN "output_index" SET NOT NULL,
  ADD COLUMN "asset_key" TEXT;

UPDATE "assets"
SET "asset_key" = COALESCE("generation_id", 'legacy:' || "id") || ':' || "output_index";

ALTER TABLE "assets"
  ALTER COLUMN "asset_key" SET NOT NULL;

CREATE UNIQUE INDEX "assets_asset_key_key" ON "assets" ("asset_key");
CREATE UNIQUE INDEX "assets_generation_id_output_index_key"
  ON "assets" ("generation_id", "output_index");

CREATE TABLE "execution_confirmations" (
  "id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "flow_id" TEXT NOT NULL,
  "snapshot_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "execution_confirmations_owner_id_workspace_id_flow_id_expires_at_idx"
  ON "execution_confirmations" ("owner_id", "workspace_id", "flow_id", "expires_at");
