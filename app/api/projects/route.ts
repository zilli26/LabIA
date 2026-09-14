import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { getOwnedExecutionScope } from "@/lib/flows/ownership";
import { createProject, listProjects, PROJECT_STATUSES, PROJECT_TYPES, type ProjectStatus, type ProjectType } from "@/lib/projects";

export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parsePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Payload de Projeto inválido." } as const;
  const body = value as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const objective = typeof body.objective === "string" ? body.objective.trim() : "";
  const type = body.type;
  const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio.trim() : "";
  const status = body.status === undefined ? "DRAFT" : body.status;
  const duration = body.durationSeconds;

  if (!name || name.length > 160) return { error: "Nome do Projeto é obrigatório e deve ter até 160 caracteres." } as const;
  if (!objective || objective.length > 5000) return { error: "Objetivo do Projeto é obrigatório e deve ter até 5.000 caracteres." } as const;
  if (!PROJECT_TYPES.includes(type as ProjectType)) return { error: "Tipo do Projeto deve ser IMAGE ou VIDEO." } as const;
  if (!/^\d{1,2}:\d{1,2}$/.test(aspectRatio)) return { error: "Proporção inválida. Use, por exemplo, 9:16." } as const;
  if (!PROJECT_STATUSES.includes(status as ProjectStatus)) return { error: "Status do Projeto inválido." } as const;

  if (type === "VIDEO") {
    if (typeof duration !== "number" || !Number.isInteger(duration) || duration < 1 || duration > 3600) {
      return { error: "Duração em segundos é obrigatória para vídeo." } as const;
    }
  } else if (duration !== undefined && duration !== null) {
    return { error: "Imagem não pode ter duração em segundos." } as const;
  }

  return {
    value: {
      name,
      objective,
      type: type as ProjectType,
      aspectRatio,
      status: status as ProjectStatus,
      durationSeconds: type === "VIDEO" ? duration as number : null,
    },
  } as const;
}

export async function GET() {
  if (!hasDatabaseEnv()) return errorResponse("DATABASE_URL e DIRECT_URL não estão configuradas.", 503);

  try {
    const scope = await getOwnedExecutionScope();
    return NextResponse.json({ projects: await listProjects(scope) });
  } catch (error) {
    console.error("Failed to list projects", error);
    return errorResponse("Não foi possível carregar os Projetos.", 503);
  }
}

export async function POST(request: Request) {
  if (!hasDatabaseEnv()) return errorResponse("DATABASE_URL e DIRECT_URL não estão configuradas.", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("JSON do Projeto inválido.");
  }

  const parsed = parsePayload(body);
  if (!("value" in parsed)) return errorResponse(parsed.error ?? "Payload de Projeto inválido.");
  const payload = parsed.value;
  if (!payload) return errorResponse("Payload de Projeto inválido.");

  try {
    const scope = await getOwnedExecutionScope();
    const project = await createProject({
      ...scope,
      name: payload.name,
      type: payload.type,
      objective: payload.objective,
      aspectRatio: payload.aspectRatio,
      durationSeconds: payload.durationSeconds,
      status: payload.status,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project", error);
    return errorResponse("Não foi possível criar o Projeto.", 503);
  }
}
