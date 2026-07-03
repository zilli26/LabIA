import { loadEnvConfig } from "@next/env";

import {
  IMAGE_GENERATION_QUEUE,
  startImageGenerationWorker,
} from "../lib/providers/image-generation-job";

loadEnvConfig(process.cwd());

async function main() {
  const boss = await startImageGenerationWorker();
  console.log(`Worker ativo na fila ${IMAGE_GENERATION_QUEUE}.`);

  const stop = async () => {
    await boss.stop({
      graceful: true,
      timeout: 30_000,
    });
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
