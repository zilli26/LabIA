import { NextResponse } from "next/server";

import { AssetInputValidationError, validateProjectAssetFile } from "@/lib/assets/asset-input";
import { hasDatabaseEnv } from "@/lib/db/env";
import { getOwnedExecutionScope } from "@/lib/flows/ownership";
import { createProjectAsset, listProjectAssets } from "@/lib/assets/project-assets";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

function failure(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function validationFailure(error: unknown) {
  if (error instanceof AssetInputValidationError) {
    return failure(error.message, error.status);
  }

  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  if (!hasDatabaseEnv()) return failure("DATABASE_URL e DIRECT_URL não estão configuradas.", 503);

  const { projectId } = await context.params;

  try {
    const scope = await getOwnedExecutionScope();
    const assets = await listProjectAssets(projectId, scope);
    return assets ? NextResponse.json({ assets }) : failure("Projeto não encontrado.", 404);
  } catch (error) {
    console.error("Failed to list project assets", error);
    return failure("Não foi possível carregar os Assets do Projeto.", 503);
  }
}

export async function POST(request: Request, context: RouteContext) {
  if (!hasDatabaseEnv()) return failure("DATABASE_URL e DIRECT_URL não estão configuradas.", 503);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return failure("Envie um formulário multipart/form-data com arquivo e papel do Asset.", 400);
  }

  const file = formData.get("file");
  const role = formData.get("role");
  if (!(file instanceof File)) return failure("Arquivo obrigatório.", 400);
  if (typeof role !== "string") return failure("Papel de Asset obrigatório.", 400);

  try {
    validateProjectAssetFile(file, role);
    const { projectId } = await context.params;
    const scope = await getOwnedExecutionScope();
    const asset = await createProjectAsset({ projectId, scope, file, role });
    return asset ? NextResponse.json({ asset }, { status: 201 }) : failure("Projeto não encontrado.", 404);
  } catch (error) {
    const validation = validationFailure(error);
    if (validation) return validation;

    console.error("Failed to create project asset", error);
    return failure("Não foi possível importar o Asset do Projeto.", 503);
  }
}
