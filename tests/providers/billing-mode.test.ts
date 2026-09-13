import { describe, expect, it } from "vitest";

import { billingModeFromProvider, normalizeBillingMode } from "@/lib/providers/model-provider";

describe("billingMode contract", () => {
  it("keeps local explicit and rejects unknown provider or billingMode", () => {
    expect(billingModeFromProvider("labia/ffmpeg")).toBe("local");
    expect(() => billingModeFromProvider("unknown-provider")).toThrow(/provider/i);
    expect(() => normalizeBillingMode("mystery", "fal")).toThrow(/billingMode/i);
  });
});
