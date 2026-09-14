import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabaseEnv: vi.fn(),
  getLatestFlowRun: vi.fn(),
}));

vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: mocks.hasDatabaseEnv }));
vi.mock("@/lib/flows/runner", () => ({ getLatestFlowRun: mocks.getLatestFlowRun }));

import { GET } from "@/app/api/flows/[flowId]/runs/latest/route";

describe("GET /api/flows/[flowId]/runs/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseEnv.mockReturnValue(true);
  });

  it("retorna erro seguro e 503 para falha de infraestrutura sem expor URL/stack", async () => {
    mocks.getLatestFlowRun.mockRejectedValue(new Error("connect ECONNREFUSED postgres://db.internal:5432/labia\\nSTACK_SECRET"));

    const response = await GET(new Request("http://localhost/api/flows/flow-1/runs/latest"), {
      params: Promise.resolve({ flowId: "flow-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Falha ao carregar a ultima execucao do fluxo.");
    expect(JSON.stringify(payload)).not.toContain("postgres://");
    expect(JSON.stringify(payload)).not.toContain("STACK_SECRET");
  });
});
