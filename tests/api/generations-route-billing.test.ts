import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/env", () => ({ hasDatabaseEnv: () => true }));
vi.mock("@/lib/flows/ownership", () => ({
  getOwnedGeneration: vi.fn(),
}));

import { getOwnedGeneration } from "@/lib/flows/ownership";
import { GET } from "@/app/api/generations/[generationId]/route";

describe("generation history billingMode", () => {
  it("returns billingMode and currency without dropping legacy fal api", async () => {
    vi.mocked(getOwnedGeneration).mockResolvedValue({
      id: "generation-1", status: "DONE", provider: "fal", model: "fal-ai/flux/dev", prompt: "x",
      estimatedCostBrl: { toString: () => "5" }, actualCostBrl: { toString: () => "5" },
      billingMode: "api", currency: "BRL", errorMessage: null,
      assets: [],
    } as never);

    const response = await GET(new Request("http://localhost/api/generations/generation-1"), {
      params: Promise.resolve({ generationId: "generation-1" }),
    });
    const payload = await response.json();
    expect(payload.generation.billingMode).toBe("api");
    expect(payload.generation.currency).toBe("BRL");
  });
});
