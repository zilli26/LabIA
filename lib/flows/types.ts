import type { CostEstimate } from "@/lib/providers/model-provider";

export type PortValueType = "text" | "image" | "video" | "copy" | "brand" | "any";

export type PortSpec = {
  id: string;
  label: string;
  type: PortValueType;
  required?: boolean;
  multiple?: boolean;
};

export type NodeCostContext = {
  nodeId: string;
  params: Record<string, unknown>;
  inputs: Record<string, unknown>;
};

export type NodeExecutionContext = NodeCostContext & {
  flowRunId: string;
  workspaceId: string;
};

export type NodeExecutionResult = {
  outputs: Record<string, unknown>;
  actualCost?: CostEstimate;
};

export type NodeDefinition = {
  type: string;
  label: string;
  description: string;
  inputs: PortSpec[];
  outputs: PortSpec[];
  estimateCost(ctx: NodeCostContext): CostEstimate | Promise<CostEstimate>;
  execute(ctx: NodeExecutionContext): Promise<NodeExecutionResult>;
  ui: {
    componentKey: string;
    kind: string;
  };
};

export type SerializableNodeDefinition = Omit<
  NodeDefinition,
  "estimateCost" | "execute"
>;

export type ConnectionValidationRequest = {
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export type ConnectionValidationResult = {
  valid: boolean;
  sourceType?: PortValueType;
  targetType?: PortValueType;
  reason?: string;
};

export type FlowValidationIssue = {
  code:
    | "unknown-node-type"
    | "unknown-node"
    | "unknown-port"
    | "incompatible-port"
    | "cycle";
  message: string;
  nodeId?: string;
  edgeId?: string;
};

export type FlowValidationResult = {
  valid: boolean;
  issues: FlowValidationIssue[];
};

export const zeroCost: CostEstimate = {
  usd: 0,
  brl: 0,
  usdBrlRate: 0,
  lineItems: [],
  source: "flow",
};
