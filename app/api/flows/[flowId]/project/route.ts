import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { getOwnedExecutionScope } from "@/lib/flows/ownership";
import { createProjectForFlow } from "@/lib/projects";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ flowId: string }> };

function parsePayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Payload de Projeto inválido." } as const;
  }

  const body = value as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const objective = typeof body.objective === "string" ? body.objective.trim() : "";

  if (!name || name.length > 160) {
    return { error: "Nome do Projeto é obrigatório e deve ter até 160 caracteres." } as const;
  }
  if (objective.length > 5000) {
    return { error: "Objetivo do Projeto deve ter até 5.000 caracteres." } as const;
  }

  return { value: { name, objective } } as const;
}

export async function POST(request: Request, context: RouteContext) {
  if (!hasDatabaseEnv()) {
    return NextResponse.json(
      { error: "DATABASE_URL e DIRECT_URL não estão configuradas." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON do Projeto inválido." }, { status: 400 });
  }

  const parsed = parsePayload(body);
  if (!("value" in parsed) || !parsed.value) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { flowId } = await context.params;
    const scope = await getOwnedExecutionScope();
    const result = await createProjectForFlow({
      flowId,
      scope,
      name: parsed.value.name,
      objective: parsed.value.objective,
    });

    if (!result) {
      return NextResponse.json({ error: "Flow não encontrado." }, { status: 404 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create Project for Flow", error);
    return NextResponse.json(
      { error: "Não foi possível criar o Projeto para este Flow." },
      { status: 503 },
    );
  }
}
