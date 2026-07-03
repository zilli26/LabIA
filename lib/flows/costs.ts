import type { CostEstimate } from "@/lib/providers/model-provider";
import type { FlowGraph } from "@/lib/flows/graph";
import { listNodeDefinitions } from "@/lib/flows/registry";
import { buildExecutionPlan, type FlowExecutionPlan } from "@/lib/flows/topology";
import { zeroCost } from "@/lib/flows/types";

export type NodeCostEstimate = {
  nodeId: string;
  type: string;
  estimatedCost: CostEstimate;
};

export type FlowCostEstimate = {
  total: CostEstimate;
  nodes: NodeCostEstimate[];
};

const definitionsByType = new Map(
  listNodeDefinitions().map((definition) => [definition.type, definition]),
);

export async function estimateFlowCost(
  graph: FlowGraph,
  options: {
    targetNodeId?: string | null;
    plan?: FlowExecutionPlan;
  } = {},
): Promise<FlowCostEstimate> {
  const plan =
    options.plan ??
    buildExecutionPlan(graph, {
      targetNodeId: options.targetNodeId,
    });
  const nodes: NodeCostEstimate[] = [];

  for (const plannedNode of plan.nodes) {
    const definition = definitionsByType.get(plannedNode.type);

    if (!definition) {
      throw new Error(`NodeDefinition não registrado: ${plannedNode.type}`);
    }

    const estimatedCost = await definition.estimateCost({
      nodeId: plannedNode.nodeId,
      params: plannedNode.node.data.params ?? {},
      inputs: {},
    });

    nodes.push({
      nodeId: plannedNode.nodeId,
      type: plannedNode.type,
      estimatedCost,
    });
  }

  return {
    total: sumCosts(nodes.map((node) => node.estimatedCost)),
    nodes,
  };
}

export function sumCosts(costs: CostEstimate[]) {
  return costs.reduce<CostEstimate>(
    (total, cost) => {
      const totalLineItems = total.lineItems ?? [];
      const costLineItems = cost.lineItems ?? [];

      return {
        usd: total.usd + cost.usd,
        brl: total.brl + cost.brl,
        usdBrlRate: cost.usdBrlRate || total.usdBrlRate,
        lineItems: totalLineItems.concat(costLineItems),
        source: "flow",
      };
    },
    zeroCost,
  );
}
