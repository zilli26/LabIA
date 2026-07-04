import { describe, expect, it } from "vitest";

import { FalProvider } from "@/lib/providers/fal";

const provider = new FalProvider({
  usdBrlRate: 5,
});

function estimate(model: string, params: Record<string, unknown>) {
  return provider.estimateCost(model, {
    prompt: "camera moves slowly",
    image_url: "https://example.com/input.png",
    ...params,
  });
}

describe("FalProvider video cost estimates", () => {
  it.each([
    ["480p", 5, 0.25],
    ["720p", 5, 0.5],
    ["1080p", 5, 0.75],
    ["480p", 10, 0.5],
    ["720p", 10, 1],
    ["1080p", 10, 1.5],
  ])("estimates Wan 2.5 %s for %ss", (resolution, duration, expectedUsd) => {
    const result = estimate("wan-2.5", {
      resolution,
      duration,
    });

    expect(result.usd).toBe(expectedUsd);
    expect(result.lineItems?.[0]).toMatchObject({
      quantity: duration,
      unit: "second",
      unitPriceUsd: expectedUsd / duration,
    });
  });

  it.each([
    [5, 0.35],
    [10, 0.7],
  ])("estimates Kling 2.5 Turbo Pro for %ss", (duration, expectedUsd) => {
    const result = estimate("kling-2.5", {
      duration,
    });

    expect(result.usd).toBe(expectedUsd);
    expect(result.lineItems?.[0]).toMatchObject({
      quantity: 1,
      unit: "clip",
      unitPriceUsd: expectedUsd,
    });
  });

  it.each([
    [6, 0.28],
    [10, 0.56],
  ])("estimates Hailuo 2.3 Standard for %ss", (duration, expectedUsd) => {
    const result = estimate("hailuo", {
      duration,
    });

    expect(result.usd).toBe(expectedUsd);
    expect(result.lineItems?.[0]).toMatchObject({
      quantity: 1,
      unit: "clip",
      unitPriceUsd: expectedUsd,
    });
  });

  it("rejects unsupported Hailuo durations instead of interpolating", () => {
    expect(() =>
      estimate("hailuo", {
        duration: 8,
      }),
    ).toThrow(/Hailuo 2\.3 Standard aceita apenas duracoes 6s ou 10s/);
  });

  it.each([
    ["720p", 5, 1.517],
    ["1080p", 5, 3.41],
  ])("estimates Seedance 2.0 %s per second", (resolution, duration, expectedUsd) => {
    const result = estimate("seedance", {
      resolution,
      duration,
      generate_audio: false,
    });

    expect(result.usd).toBe(expectedUsd);
    expect(result.brl).toBeCloseTo(expectedUsd * 5, 5);
    expect(result.source).toContain("seedance-2.0/image-to-video reconfirmado em 2026-07-04");
  });

  it("rejects Seedance resolutions without a confirmed price", () => {
    expect(() =>
      estimate("seedance", {
        resolution: "480p",
        duration: 5,
      }),
    ).toThrow(/Seedance 2\.0: preco 480p nao confirmado/);
  });

  it.each([
    [true, 8, 3.2],
    [false, 8, 1.6],
    [undefined, 8, 3.2],
  ])("estimates Veo 3 with generate_audio=%s", (generateAudio, duration, expectedUsd) => {
    const result = estimate("veo3", {
      duration: `${duration}s`,
      generate_audio: generateAudio,
    });

    expect(result.usd).toBe(expectedUsd);
    expect(result.lineItems?.[0]).toMatchObject({
      quantity: duration,
      unit: "second",
      unitPriceUsd: expectedUsd / duration,
    });
  });

  it("uses USD_BRL_RATE for BRL conversion", () => {
    const result = estimate("wan", {
      resolution: "480p",
      duration: 10,
    });

    expect(result.usd).toBe(0.5);
    expect(result.brl).toBe(2.5);
    expect(result.usdBrlRate).toBe(5);
  });

  it("throws a readable error for uncatalogued video models", () => {
    expect(() =>
      estimate("fal-ai/new-video-model/image-to-video", {
        duration: 5,
      }),
    ).toThrow(/Modelo de video fal\.ai nao catalogado/);
  });

  it("uses real returned duration for video actual cost when present", () => {
    const result = provider.estimateActualCost(
      "veo3",
      {
        prompt: "camera moves slowly",
        image_url: "https://example.com/input.png",
        duration: "8s",
        generate_audio: false,
      },
      [
        {
          url: "https://example.com/output.mp4",
          durationSeconds: 6,
        },
      ],
    );

    expect(result.usd).toBe(1.2);
  });
});
