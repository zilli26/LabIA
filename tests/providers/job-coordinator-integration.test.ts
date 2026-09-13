import { describe, expect, it } from "vitest";

import { createPrismaGenerationCoordinator } from "@/lib/providers/prisma-generation-store";

describe("real generation job coordinator integration", () => {
  it("exposes the transactional coordinator used by image and video jobs", () => {
    expect(createPrismaGenerationCoordinator).toBeTypeOf("function");
  });
});
