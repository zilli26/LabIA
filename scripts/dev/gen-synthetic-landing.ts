import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import ffmpegPath from "ffmpeg-static";

const publicDir = path.join(process.cwd(), "public", "landing");
const framesDir = path.join(publicDir, "frames");
const posterPath = path.join(publicDir, "poster.webp");

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-300)}`));
    });
  });
}

async function main() {
  // Limpa frames antigos
  if (fs.existsSync(framesDir)) {
    for (const f of fs.readdirSync(framesDir)) {
      fs.unlinkSync(path.join(framesDir, f));
    }
  } else {
    fs.mkdirSync(framesDir, { recursive: true });
  }

  console.log("Gerando 99 frames cinematográficos (mandelbrot zoom + paleta esmeralda)...");

  // Mandelbrot zoom com color grading para a paleta do LabIA:
  // - Fundo escuro (#0A0B0E)
  // - Tons de esmeralda (#10B981)
  // - Vignette para profundidade
  const input = [
    "mandelbrot=size=1280x720",
    "maxiter=256",
    "start_scale=3",
    "end_scale=0.0005",
    "inner=convergence",
    "rate=25",
  ].join(":");

  const filters = [
    // Mapeia as cores do fractal para tons de esmeralda/ciano
    "hue=H=155:s=3",
    // Escurece bastante e aumenta contraste
    "eq=brightness=-0.45:contrast=1.6:saturation=0.6",
    // Puxa verde/ciano, remove vermelho
    "colorbalance=rs=-0.6:gs=0.35:bs=0.1:rm=-0.3:gm=0.2:bm=0.1",
    // Vignette forte para dar profundidade
    "vignette=PI/3",
    // Leve blur para suavizar e dar aspecto de render
    "gblur=sigma=1.2",
  ].join(",");

  await run([
    "-f", "lavfi",
    "-i", input,
    "-vf", filters,
    "-frames:v", "99",
    "-c:v", "libwebp",
    "-quality", "82",
    "-y",
    path.join(framesDir, "f_%03d.webp"),
  ]);

  console.log("99 frames gerados.");

  // Poster = primeiro frame
  console.log("Gerando poster...");
  await run([
    "-f", "lavfi",
    "-i", input,
    "-vf", `${filters},select=eq(n\\,0)`,
    "-frames:v", "1",
    "-c:v", "libwebp",
    "-quality", "90",
    "-y",
    posterPath,
  ]);

  console.log("Pronto! 99 frames + poster em public/landing/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
