import type { LabFlowNode, LabNodeKind } from "@/lib/flows/graph";

export const PAID_VIDEO_KINDS = [
  "video-generation",
  "video-extend",
  "text2video",
] as const satisfies LabNodeKind[];

const paidVideoKinds = new Set<LabNodeKind>(PAID_VIDEO_KINDS);

export function hasPaidVideoNode(nodes: LabFlowNode[]): boolean {
  return nodes.some((node) => paidVideoKinds.has(node.data.kind));
}
