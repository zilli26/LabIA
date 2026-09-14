import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { getOwnedExecutionScope } from "@/lib/flows/ownership";
import { archiveProject, getProject, updateProject } from "@/lib/projects";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, context: RouteContext) {
  if (!hasDatabaseEnv()) return failure("DATABASE_URL e DIRECT_URL não estão configuradas.", 503);
  const { projectId } = await context.params;

  try {
    const scope = await getOwnedExecutionScope();
    const project = await getProject(projectId, scope);
    return project ? NextResponse.json({ project }) : failure("Projeto não encontrado.", 404);
  } catch (error) {
    console.error("Failed to load project", error);
    return failure("Não foi possível carregar o Projeto.", 503);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!hasDatabaseEnv()) return failure("DATABASE_URL e DIRECT_URL não estão configuradas.", 503);
  const { projectId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("JSON do Projeto inválido.", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return failure("Payload de Projeto inválido.", 400);

  const source = body as Record<string, unknown>;
  const data: Record<string, unknown> = {};
  if (source.name !== undefined) {
    if (typeof source.name !== "string" || !source.name.trim() || source.name.trim().length > 160) return failure("Nome do Projeto inválido.", 400);
    data.name = source.name.trim();
  }
  if (source.objective !== undefined) {
    if (typeof source.objective !== "string" || !source.objective.trim() || source.objective.trim().length > 5000) return failure("Objetivo do Projeto inválido.", 400);
    data.objective = source.objective.trim();
  }
  if (source.aspectRatio !== undefined) {
    if (typeof source.aspectRatio !== "string" || !/^\d{1,2}:\d{1,2}$/.test(source.aspectRatio.trim())) return failure("Proporção inválida.", 400);
    data.aspectRatio = source.aspectRatio.trim();
  }
  if (source.status !== undefined) {
    if (![
      "DRAFT", "IN_PROGRESS", "REVIEW", "APPROVED", "ARCHIVED",
    ].includes(source.status as string)) return failure("Status do Projeto inválido.", 400);
    data.status = source.status;
  }
  if (source.durationSeconds !== undefined) {
    if (source.durationSeconds !== null && (typeof source.durationSeconds !== "number" || !Number.isInteger(source.durationSeconds) || source.durationSeconds < 1 || source.durationSeconds > 3600)) return failure("Duração inválida.", 400);
    data.durationSeconds = source.durationSeconds;
  }
  if (Object.keys(data).length === 0) return failure("Nenhuma alteração de Projeto informada.", 400);

  try {
    const scope = await getOwnedExecutionScope();
    const project = await updateProject(projectId, scope, data as never);
    return project ? NextResponse.json({ project }) : failure("Projeto não encontrado.", 404);
  } catch (error) {
    console.error("Failed to update project", error);
    return failure("Não foi possível atualizar o Projeto.", 503);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!hasDatabaseEnv()) return failure("DATABASE_URL e DIRECT_URL não estão configuradas.", 503);
  const { projectId } = await context.params;

  try {
    const scope = await getOwnedExecutionScope();
    const project = await archiveProject(projectId, scope);
    return project ? NextResponse.json({ project }) : failure("Projeto não encontrado.", 404);
  } catch (error) {
    console.error("Failed to archive project", error);
    return failure("Não foi possível arquivar o Projeto.", 503);
  }
}
