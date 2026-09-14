-- Projeto vertical: estrutura aditiva; aplicar somente no ambiente autorizado.
CREATE TYPE "project_type" AS ENUM ('image', 'video');
CREATE TYPE "project_status" AS ENUM ('draft', 'in_progress', 'review', 'approved', 'archived');

ALTER TABLE "flows" ADD COLUMN "project_id" TEXT;
ALTER TABLE "assets" ADD COLUMN "project_id" TEXT;

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "project_type" NOT NULL,
    "objective" TEXT NOT NULL,
    "aspect_ratio" TEXT NOT NULL,
    "status" "project_status" NOT NULL DEFAULT 'draft',
    "duration_seconds" INTEGER,
    "primary_flow_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_primary_flow_id_key" ON "projects"("primary_flow_id");
CREATE INDEX "projects_workspace_id_updated_at_idx" ON "projects"("workspace_id", "updated_at");
CREATE INDEX "projects_workspace_id_status_idx" ON "projects"("workspace_id", "status");
CREATE INDEX "flows_workspace_id_project_id_idx" ON "flows"("workspace_id", "project_id");
CREATE INDEX "assets_workspace_id_project_id_created_at_idx" ON "assets"("workspace_id", "project_id", "created_at");

ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_primary_flow_id_fkey"
  FOREIGN KEY ("primary_flow_id") REFERENCES "flows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flows" ADD CONSTRAINT "flows_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "projects" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE "projects" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE "projects" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL PRIVILEGES ON TABLE "projects" FROM service_role;
  END IF;
END
$$;

-- Sem policy pública: o control-plane Prisma aplica owner/workspace scope no servidor.
