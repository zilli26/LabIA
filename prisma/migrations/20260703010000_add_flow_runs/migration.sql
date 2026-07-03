-- CreateTable
CREATE TABLE "flow_runs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "flow_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "graph" JSONB NOT NULL,
    "node_order" JSONB NOT NULL,
    "target_node_id" TEXT,
    "total_estimated_cost_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "total_estimated_cost_brl" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "total_actual_cost_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "total_actual_cost_brl" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "outputs" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_run_nodes" (
    "id" TEXT NOT NULL,
    "flow_run_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "dependency_node_ids" JSONB NOT NULL,
    "params" JSONB,
    "inputs" JSONB,
    "outputs" JSONB,
    "error" TEXT,
    "pg_boss_job_id" TEXT,
    "estimated_cost_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "estimated_cost_brl" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "actual_cost_usd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "actual_cost_brl" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_run_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flow_runs_workspace_id_status_idx" ON "flow_runs"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "flow_runs_flow_id_created_at_idx" ON "flow_runs"("flow_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "flow_run_nodes_flow_run_id_node_id_key" ON "flow_run_nodes"("flow_run_id", "node_id");

-- CreateIndex
CREATE INDEX "flow_run_nodes_flow_run_id_status_idx" ON "flow_run_nodes"("flow_run_id", "status");

-- AddForeignKey
ALTER TABLE "flow_runs" ADD CONSTRAINT "flow_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_runs" ADD CONSTRAINT "flow_runs_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_run_nodes" ADD CONSTRAINT "flow_run_nodes_flow_run_id_fkey" FOREIGN KEY ("flow_run_id") REFERENCES "flow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase Realtime sends row updates from these tables to subscribers.
ALTER TABLE "flow_runs" REPLICA IDENTITY FULL;
ALTER TABLE "flow_run_nodes" REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION "supabase_realtime" ADD TABLE "flow_runs";
    ALTER PUBLICATION "supabase_realtime" ADD TABLE "flow_run_nodes";
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
