import { getStagingReadiness } from "@/lib/provider-connections/staging-readiness";
import { noStoreJson } from "@/lib/provider-connections/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return noStoreJson(await getStagingReadiness());
  } catch {
    return noStoreJson(
      {
        executionAllowed: false,
        overall: "unavailable",
        message: "Não foi possível consultar a prontidão de staging.",
      },
      { status: 503 },
    );
  }
}
