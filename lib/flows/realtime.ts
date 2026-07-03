export function getFlowRunRealtimeConfig(flowRunId: string) {
  return {
    channel: `flow-run:${flowRunId}`,
    postgresChanges: [
      {
        event: "*",
        schema: "public",
        table: "flow_runs",
        filter: `id=eq.${flowRunId}`,
      },
      {
        event: "*",
        schema: "public",
        table: "flow_run_nodes",
        filter: `flow_run_id=eq.${flowRunId}`,
      },
    ],
  };
}
