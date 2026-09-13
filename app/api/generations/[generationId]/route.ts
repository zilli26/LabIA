import { NextResponse } from "next/server";

import { hasDatabaseEnv } from "@/lib/db/env";
import { getOwnedGeneration } from "@/lib/flows/ownership";
import { normalizeBillingMode } from "@/lib/providers/model-provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    generationId: string;
  }>;
};

function decimalToNumber(value: { toString(): string } | null) {
  return value ? Number(value.toString()) : null;
}

export async function GET(_request: Request, context: RouteContext) {
  if (!hasDatabaseEnv()) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL e DIRECT_URL nao estao configuradas. Preencha .env.local e rode as migrations do Prisma.",
      },
      { status: 503 },
    );
  }

  const { generationId } = await context.params;
  const generation = await getOwnedGeneration(generationId);

  if (!generation) {
    return NextResponse.json(
      { error: "Generation nao encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    generation: {
      id: generation.id,
      status: generation.status,
      provider: generation.provider,
      model: generation.model,
      prompt: generation.prompt,
      estimatedCostBrl: decimalToNumber(generation.estimatedCostBrl),
      actualCostBrl: decimalToNumber(generation.actualCostBrl),
      billingMode: normalizeBillingMode(generation.billingMode, generation.provider),
      currency: generation.currency,
      errorMessage: generation.errorMessage,
      assets: generation.assets.map((asset) => ({
        id: asset.id,
        url: asset.url,
        width: asset.width,
        height: asset.height,
      })),
    },
  });
}
