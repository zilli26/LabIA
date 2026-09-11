import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const O1_FILES = [
  "lib/providers/openai-codex/app-server-client.ts",
  "lib/providers/openai-codex/connection-service.ts",
  "lib/providers/openai-codex/runtime.ts",
  "app/api/provider-connections/route.ts",
  "app/api/provider-connections/[connectionId]/actions/route.ts",
];

describe("O1 generation boundary", () => {
  it("does not import generation queues, flow runners or generation jobs", async () => {
    const source = (
      await Promise.all(
        O1_FILES.map((path) => readFile(resolve(process.cwd(), path), "utf8")),
      )
    ).join("\n");

    expect(source).not.toMatch(/image-generation-job/);
    expect(source).not.toMatch(/video-generation-job/);
    expect(source).not.toMatch(/scripts\/worker/);
    expect(source).not.toMatch(/flow-node-execution/);
    expect(source).not.toMatch(/pg-boss/);
    expect(source).not.toMatch(/thread\/start/);
    expect(source).not.toMatch(/turn\/start/);
  });
});
