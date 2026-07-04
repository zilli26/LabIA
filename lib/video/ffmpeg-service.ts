import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import ffmpegPath from "ffmpeg-static";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_STDERR_CHARS = 1600;

type FfmpegOptions = {
  outputPath?: string;
  timeoutMs?: number;
};

export type MixAudioOptions = FfmpegOptions & {
  originalVolume?: number;
  trackVolume?: number;
};

type TempOutput = {
  outputPath: string;
  cleanup: () => Promise<void>;
};

function getFfmpegPath() {
  if (!ffmpegPath) {
    throw new Error("ffmpeg-static não encontrou um binário de ffmpeg.");
  }

  return ffmpegPath;
}

async function assertReadableFile(filePath: string, label: string) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} não encontrado ou inacessível: ${filePath}`);
  }
}

async function makeTempOutput(extension: string): Promise<TempOutput> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "labia-ffmpeg-"));

  return {
    outputPath: path.join(directory, `output${extension}`),
    cleanup: () => fs.rm(directory, { recursive: true, force: true }),
  };
}

async function resolveOutput(extension: string, outputPath?: string) {
  if (outputPath) {
    return {
      outputPath,
      cleanup: async () => undefined,
    };
  }

  return makeTempOutput(extension);
}

function summarizeStderr(stderr: string) {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const summary = lines.slice(-12).join("\n");

  if (summary.length <= MAX_STDERR_CHARS) {
    return summary;
  }

  return summary.slice(summary.length - MAX_STDERR_CHARS);
}

function runFfmpeg(args: string[], operation: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(getFfmpegPath(), args, {
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
      if (stderr.length > MAX_STDERR_CHARS * 4) {
        stderr = stderr.slice(stderr.length - MAX_STDERR_CHARS * 4);
      }
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`ffmpeg não iniciou em ${operation}: ${error.message}`));
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);

      if (timedOut) {
        reject(
          new Error(
            `ffmpeg excedeu o timeout de ${timeoutMs}ms em ${operation}.`,
          ),
        );
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `ffmpeg falhou em ${operation} (exit ${code ?? signal ?? "desconhecido"}): ${summarizeStderr(stderr)}`,
        ),
      );
    });
  });
}

async function readOutputAndCleanup(output: TempOutput, keepFile: boolean) {
  try {
    return await fs.readFile(output.outputPath);
  } finally {
    if (!keepFile) {
      await output.cleanup();
    }
  }
}

export async function extractLastFrame(
  videoPath: string,
  options: FfmpegOptions = {},
): Promise<Buffer> {
  await assertReadableFile(videoPath, "Vídeo");
  const output = await resolveOutput(".png", options.outputPath);

  await runFfmpeg(
    [
      "-hide_banner",
      "-y",
      "-i",
      videoPath,
      "-vf",
      "reverse",
      "-frames:v",
      "1",
      "-f",
      "image2",
      output.outputPath,
    ],
    "extractLastFrame",
    options.timeoutMs,
  );

  return readOutputAndCleanup(output, Boolean(options.outputPath));
}

function toConcatFilePath(filePath: string) {
  return path.resolve(filePath).replace(/\\/g, "/").replace(/'/g, "'\\''");
}

async function writeConcatList(clipPaths: string[]) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "labia-concat-"));
  const listPath = path.join(directory, "clips.txt");
  const content = clipPaths
    .map((clipPath) => `file '${toConcatFilePath(clipPath)}'`)
    .join("\n");

  await fs.writeFile(listPath, `${content}\n`, "utf8");

  return {
    listPath,
    cleanup: () => fs.rm(directory, { recursive: true, force: true }),
  };
}

export async function concatClips(
  clipPaths: string[],
  options: FfmpegOptions = {},
): Promise<Buffer> {
  if (clipPaths.length === 0) {
    throw new Error("concatClips exige ao menos um clipe.");
  }

  await Promise.all(
    clipPaths.map((clipPath, index) =>
      assertReadableFile(clipPath, `Clipe ${index + 1}`),
    ),
  );

  const output = await resolveOutput(".mp4", options.outputPath);
  const concatList = await writeConcatList(clipPaths);

  try {
    await runFfmpeg(
      [
        "-hide_banner",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatList.listPath,
        // Re-encode é o caminho seguro: clipes de modelos diferentes podem
        // variar em codec, timebase, resolução e áudio; stream copy quebraria.
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
        output.outputPath,
      ],
      "concatClips",
      options.timeoutMs,
    );
  } finally {
    await concatList.cleanup();
  }

  return readOutputAndCleanup(output, Boolean(options.outputPath));
}

function normalizeVolume(value: number | undefined, fallback: number) {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value < 0 || value > 4) {
    throw new Error("Volume de áudio precisa estar entre 0 e 4.");
  }

  return value;
}

export async function mixAudioTrack(
  videoPath: string,
  audioPath: string,
  options: MixAudioOptions = {},
): Promise<Buffer> {
  await assertReadableFile(videoPath, "Vídeo");
  await assertReadableFile(audioPath, "Áudio");
  const output = await resolveOutput(".mp4", options.outputPath);
  const originalVolume = normalizeVolume(options.originalVolume, 1);
  const trackVolume = normalizeVolume(options.trackVolume, 1);

  await runFfmpeg(
    [
      "-hide_banner",
      "-y",
      "-i",
      videoPath,
      "-stream_loop",
      "-1",
      "-i",
      audioPath,
      "-filter_complex",
      `[0:a]volume=${originalVolume}[a0];[1:a]volume=${trackVolume}[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[aout]`,
      "-map",
      "0:v:0",
      "-map",
      "[aout]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-shortest",
      "-movflags",
      "+faststart",
      output.outputPath,
    ],
    "mixAudioTrack",
    options.timeoutMs,
  );

  return readOutputAndCleanup(output, Boolean(options.outputPath));
}
