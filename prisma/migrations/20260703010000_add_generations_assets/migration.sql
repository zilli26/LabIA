-- CreateEnum
CREATE TYPE "asset_type" AS ENUM ('image', 'video', 'audio');

-- CreateEnum
CREATE TYPE "asset_origin" AS ENUM ('generated', 'uploaded');

-- CreateEnum
CREATE TYPE "generation_status" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "generations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "brand_id" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "status" "generation_status" NOT NULL DEFAULT 'queued',
    "estimated_cost_usd" DECIMAL(12,6) NOT NULL,
    "estimated_cost_brl" DECIMAL(12,4) NOT NULL,
    "actual_cost_usd" DECIMAL(12,6),
    "actual_cost_brl" DECIMAL(12,4),
    "queue_job_id" TEXT,
    "provider_job_id" TEXT,
    "flow_run_id" TEXT,
    "flow_node_id" TEXT,
    "error_message" TEXT,
    "result" JSONB,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "brand_id" TEXT,
    "generation_id" TEXT,
    "type" "asset_type" NOT NULL,
    "origin" "asset_origin" NOT NULL,
    "url" TEXT NOT NULL,
    "storage_bucket" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "content_type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "size_bytes" INTEGER,
    "prompt" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "tags" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generations_workspace_id_created_at_idx" ON "generations"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "generations_brand_id_idx" ON "generations"("brand_id");

-- CreateIndex
CREATE INDEX "generations_status_idx" ON "generations"("status");

-- CreateIndex
CREATE INDEX "generations_provider_model_idx" ON "generations"("provider", "model");

-- CreateIndex
CREATE INDEX "assets_workspace_id_created_at_idx" ON "assets"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "assets_brand_id_idx" ON "assets"("brand_id");

-- CreateIndex
CREATE INDEX "assets_generation_id_idx" ON "assets"("generation_id");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
