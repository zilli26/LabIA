export const flowRunStatuses = [
  "queued",
  "running",
  "done",
  "failed",
] as const;

export type FlowRunStatus = (typeof flowRunStatuses)[number];

export const flowRunNodeStatuses = [
  "waiting",
  "queued",
  "running",
  "done",
  "failed",
  "skipped",
] as const;

export type FlowRunNodeStatus = (typeof flowRunNodeStatuses)[number];

export function isTerminalNodeStatus(status: string) {
  return status === "done" || status === "failed" || status === "skipped";
}
