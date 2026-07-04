import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import ffmpegPath from "ffmpeg-static";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  concatClips,
  extractLastFrame,
  mixAudioTrack,
} from "@/lib/video/ffmpeg-service";

const TEST_TIMEOUT_MS = 60_000;

function getFfmpegPath() {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static não encontrou um binário.");
  }

  return ffmpegPath;
}

function runFfmpeg(args: string[], timeoutMs = TEST_TIMEOUT_MS) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(getFfmpegPath(), args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timeout: ${args.join(" ")}`));
    }, timeoutMs);

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);

      if (code === 0) {
        resolve(stderr);
        return;
      }

      reject(new Error(stderr));
    });
  });
}

async function inspectMedia(filePath: string) {
  let stderr: string;

  try {
    stderr = await runFfmpeg(["-hide_banner", "-i", filePath, "-f", "null", "-"]);
  } catch (error) {
    stderr = error instanceof Error ? error.message : String(error);
  }

  const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const durationSeconds = durationMatch
    ? Number(durationMatch[1]) * 3600 +
      Number(durationMatch[2]) * 60 +
      Number(durationMatch[3])
    : undefined;

  return {
    durationSeconds,
    hasAudio: /Audio:/i.test(stderr),
    stderr,
  };
}

function getPngDimensions(buffer: Buffer) {
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe.sequential("ffmpeg service", () => {
  let tempDir: string;
  let clipAPath: string;
  let clipBPath: string;
  let audioPath: string;
  let corruptPath: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "labia-ffmpeg-test-"));
    clipAPath = path.join(tempDir, "clip-a.mp4");
    clipBPath = path.join(tempDir, "clip-b.mp4");
    audioPath = path.join(tempDir, "track.wav");
    corruptPath = path.join(tempDir, "corrupt.mp4");

    await runFfmpeg([
      "-hide_banner",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=160x90:rate=24:duration=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      clipAPath,
    ]);

    await runFfmpeg([
      "-hide_banner",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=160x90:rate=24:duration=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=660:duration=2",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      clipBPath,
    ]);

    await runFfmpeg([
      "-hide_banner",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=880:duration=1",
      "-c:a",
      "pcm_s16le",
      audioPath,
    ]);

    await fs.writeFile(corruptPath, "isto não é um vídeo", "utf8");
  }, TEST_TIMEOUT_MS);

  afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it(
    "extractLastFrame returns a valid PNG with dimensions",
    async () => {
      const frame = await extractLastFrame(clipAPath, {
        timeoutMs: TEST_TIMEOUT_MS,
      });
      const dimensions = getPngDimensions(frame);

      expect(frame.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
      expect(dimensions).toEqual({
        width: 160,
        height: 90,
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "concatClips returns an MP4 with summed duration and audio",
    async () => {
      const outputPath = path.join(tempDir, "concat.mp4");

      await concatClips([clipAPath, clipBPath], {
        outputPath,
        timeoutMs: TEST_TIMEOUT_MS,
      });

      const result = await inspectMedia(outputPath);

      expect(result.durationSeconds).toBeGreaterThanOrEqual(3.7);
      expect(result.durationSeconds).toBeLessThanOrEqual(4.4);
      expect(result.hasAudio).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "mixAudioTrack preserves video duration and produces audio",
    async () => {
      const outputPath = path.join(tempDir, "mixed.mp4");

      await mixAudioTrack(clipAPath, audioPath, {
        outputPath,
        originalVolume: 0.6,
        trackVolume: 0.4,
        timeoutMs: TEST_TIMEOUT_MS,
      });

      const source = await inspectMedia(clipAPath);
      const mixed = await inspectMedia(outputPath);

      expect(mixed.durationSeconds).toBeGreaterThanOrEqual(
        (source.durationSeconds ?? 0) - 0.25,
      );
      expect(mixed.durationSeconds).toBeLessThanOrEqual(
        (source.durationSeconds ?? 0) + 0.25,
      );
      expect(mixed.hasAudio).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it("throws a readable error for a missing file", async () => {
    await expect(
      extractLastFrame(path.join(tempDir, "missing.mp4")),
    ).rejects.toThrow(/Vídeo não encontrado ou inacessível/);
  });

  it(
    "throws a readable ffmpeg error for a corrupt video",
    async () => {
      await expect(
        extractLastFrame(corruptPath, {
          timeoutMs: TEST_TIMEOUT_MS,
        }),
      ).rejects.toThrow(/ffmpeg falhou em extractLastFrame/);
    },
    TEST_TIMEOUT_MS,
  );
});
