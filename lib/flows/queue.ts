import "server-only";

import { PgBoss, type Job } from "pg-boss";

export const FLOW_NODE_QUEUE = "flow-node-execution";

export type FlowNodeJobData = {
  flowRunId: string;
  nodeId: string;
};

let bossPromise: Promise<PgBoss> | undefined;

export async function getPgBoss() {
  if (!bossPromise) {
    const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL ou DIRECT_URL é obrigatória para pg-boss.");
    }

    bossPromise = new PgBoss({
      connectionString,
      schema: "pgboss",
      migrate: true,
      supervise: true,
      schedule: false,
    }).start();
  }

  return bossPromise;
}

export async function enqueueFlowRunNodeJob(data: FlowNodeJobData) {
  const boss = await getPgBoss();
  await boss.createQueue(FLOW_NODE_QUEUE, {
    retryLimit: 2,
    retryDelay: 5,
    retentionSeconds: 60 * 60 * 24 * 14,
    deleteAfterSeconds: 60 * 60 * 24 * 7,
  });

  const jobId = await boss.send(FLOW_NODE_QUEUE, data, {
    retryLimit: 2,
    retryDelay: 5,
    singletonKey: `${data.flowRunId}:${data.nodeId}`,
    singletonSeconds: 60,
  });

  if (!jobId) {
    throw new Error("pg-boss não retornou id do job.");
  }

  return jobId;
}

export async function registerFlowNodeWorker(
  handler: (job: Job<FlowNodeJobData>) => Promise<void>,
) {
  const boss = await getPgBoss();

  return boss.work<FlowNodeJobData>(
    FLOW_NODE_QUEUE,
    {
      batchSize: 1,
      pollingIntervalSeconds: 2,
    },
    async (jobs) => {
      for (const job of jobs) {
        await handler(job);
      }
    },
  );
}
