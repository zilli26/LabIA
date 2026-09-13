import { describe, expect, it, vi } from "vitest";

import { OpenAiCodexImageProvider, type CodexImageExecutor } from "@/lib/providers/openai-codex-image";
import type { CodexImageItem } from "@/lib/provider-connections/codex-app-server";
import type { JobHandle } from "@/lib/providers/model-provider";

const handle: JobHandle = { id: "codex-job-1", provider: "openai", model: "gpt-5.5" };

describe("OpenAiCodexImageProvider", () => {
  it("usa o executor oficial e entrega resultado normalizado sem marcar conexão como validada", async () => {
    const executor: CodexImageExecutor = {
      startImageGeneration: vi.fn(async () => handle),
      waitForImageGeneration: vi.fn(async () => ({
        requestId: "turn-1",
        asset: {
          url: "data:image/png;base64,iVBORw0KGgo=",
          contentType: "image/png" as const,
          fileName: "codex-image.png",
          fileSize: 8,
        },
        raw: { type: "imageGeneration", id: "item-1", status: "completed", result: "", savedPath: null } as CodexImageItem,
      })),
    };
    const provider = new OpenAiCodexImageProvider({ executor });

    expect(provider.capabilities).toEqual({ image: true, video: false, recoverableResults: true });
    expect(provider.listModels("image").map((model) => model.id)).toContain("gpt-5.5");
    expect(provider.estimateCost("gpt-5.5", { prompt: "x" }).billingMode).toBe("subscription");
    const submitted = await provider.generate("gpt-5.5", { prompt: "x", operationKey: "op-1" });
    const result = await provider.waitForResult(submitted, { prompt: "x", operationKey: "op-1" });

    expect(executor.startImageGeneration).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5.5", prompt: "x" }));
    expect(executor.waitForImageGeneration).toHaveBeenCalledWith(handle);
    expect(result.images[0]).toMatchObject({ contentType: "image/png", fileSize: 8 });
    expect(result.cost.billingMode).toBe("subscription");
  });

  it("falha explicitamente antes do envio para vídeo ou modelo desconhecido", async () => {
    const executor: CodexImageExecutor = {
      startImageGeneration: vi.fn(async () => handle),
      waitForImageGeneration: vi.fn(),
    };
    const provider = new OpenAiCodexImageProvider({ executor });

    expect(() => provider.estimateCost("unknown", { prompt: "x" })).toThrow(/model_unavailable/i);
    await expect(provider.generate("unknown", { prompt: "x" })).rejects.toThrow(/model_unavailable/i);
    await expect(provider.generate("gpt-5.5", { prompt: "x", kind: "video" })).rejects.toThrow(/image_generation_contract_unavailable|video/i);
    expect(executor.startImageGeneration).not.toHaveBeenCalled();
  });
});
