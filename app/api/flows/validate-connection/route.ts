import { NextResponse, type NextRequest } from "next/server";

import { isFlowGraph } from "@/lib/flows/graph";
import type { ConnectionValidationRequest } from "@/lib/flows/types";
import { validateConnection } from "@/lib/flows/validation";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    graph?: unknown;
    connection?: Partial<ConnectionValidationRequest>;
  };

  if (!isFlowGraph(body.graph)) {
    return NextResponse.json(
      { error: "Grafo do fluxo inválido." },
      { status: 400 },
    );
  }

  if (
    typeof body.connection?.sourceNodeId !== "string" ||
    typeof body.connection?.targetNodeId !== "string"
  ) {
    return NextResponse.json(
      { error: "Conexão incompleta." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    validation: validateConnection(body.graph, {
      sourceNodeId: body.connection.sourceNodeId,
      targetNodeId: body.connection.targetNodeId,
      sourceHandle: body.connection.sourceHandle ?? null,
      targetHandle: body.connection.targetHandle ?? null,
    }),
  });
}
