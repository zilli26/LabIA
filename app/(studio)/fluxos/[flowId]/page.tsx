import { FlowCanvas } from "@/app/(studio)/fluxos/flow-canvas";

type FlowPageProps = {
  params: Promise<{
    flowId: string;
  }>;
};

export default async function FlowPage({ params }: FlowPageProps) {
  const { flowId } = await params;

  return <FlowCanvas flowId={flowId} />;
}
