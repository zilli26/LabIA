import { describe, expect, it } from "vitest";

import { assertOwnedExecutionReferences } from "@/lib/flows/ownership";

describe("flow execution ownership", () => {
  it("rejeita referências de outro workspace/owner antes de estimar ou enfileirar", async () => {
    const repository = {
      flow: async () => ({ id: "flow-1", workspaceId: "workspace-1" }),
      brand: async () => ({ id: "brand-1", workspaceId: "workspace-foreign" }),
      flowRun: async () => null,
      connection: async () => null,
    };

    await expect(assertOwnedExecutionReferences({
      ownerId: "owner-1",
      workspaceId: "workspace-1",
      flowId: "flow-1",
      brandId: "brand-1",
      repository,
    })).rejects.toThrow(/brand|workspace/i);
  });
});
