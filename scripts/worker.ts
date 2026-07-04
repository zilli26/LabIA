import { loadEnvConfig } from "@next/env";

import { executeFlowRunNode } from "../lib/flows/runner";
import {
  FLOW_NODE_QUEUE,
  getPgBoss,
  registerFlowNodeWorker,
} from "../lib/flows/queue";
import {
  IMAGE_GENERATION_QUEUE,
  startImageGenerationWorker,
} from "../lib/providers/image-generation-job";
import {
  VIDEO_GENERATION_QUEUE,
  startVideoGenerationWorker,
} from "../lib/providers/video-generation-job";

loadEnvConfig(process.cwd());

async function main() {
  await registerFlowNodeWorker((job) =>
    executeFlowRunNode(job.data),
  );
  const flowBoss = await getPgBoss();
  console.log(`Worker ativo na fila ${FLOW_NODE_QUEUE}.`);

  const imageBoss = await startImageGenerationWorker();
  console.log(`Worker ativo na fila ${IMAGE_GENERATION_QUEUE}.`);

  const videoBoss = await startVideoGenerationWorker();
  console.log(`Worker ativo na fila ${VIDEO_GENERATION_QUEUE}.`);

  let isStopping = false;
  const stop = async () => {
    if (isStopping) {
      return;
    }

    isStopping = true;
    await Promise.all([
      flowBoss.stop({
        graceful: true,
        timeout: 30_000,
      }),
      imageBoss.stop({
        graceful: true,
        timeout: 30_000,
      }),
      videoBoss.stop({
        graceful: true,
        timeout: 30_000,
      }),
    ]);
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
