import type { CostEstimate } from "@/lib/providers/model-provider";
import type { FlowGraph } from "@/lib/flows/graph";
import { getNodeDefinition } from "@/lib/flows/registry";
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
    const definition = getNodeDefinition(plannedNode.type);

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
  const summed = costs.reduce<CostEstimate>(
    (total, cost) => ({
      usd: total.usd + cost.usd,
      brl: total.brl + cost.brl,
      usdBrlRate: total.usdBrlRate || cost.usdBrlRate,
      lineItems: (total.lineItems ?? []).concat(cost.lineItems ?? []),
      source: "flow",
    }),
    zeroCost,
  );

  return {
    ...summed,
    // A taxa agregada deriva dos totais; nós com taxas distintas não podem
    // eleger a taxa de um único nó como taxa do fluxo.
    usdBrlRate: summed.usd > 0 ? summed.brl / summed.usd : summed.usdBrlRate,
  };
}
