import { NextResponse } from "next/server";

import { listSerializableNodeDefinitions } from "@/lib/flows/registry";

export function GET() {
  return NextResponse.json({
    nodeDefinitions: listSerializableNodeDefinitions(),
  });
}
