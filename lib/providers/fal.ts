import type {
  CostEstimate,
  GenParams,
  JobHandle,
  ModelInfo,
  ModelKind,
  ModelProvider,
} from "@/lib/providers/model-provider";

export class FalProvider implements ModelProvider {
  id = "fal";

  async listModels(kind: ModelKind): Promise<ModelInfo[]> {
    void kind;
    return [];
  }

  async estimateCost(
    model: string,
    params: GenParams,
  ): Promise<CostEstimate> {
    void model;
    void params;
    throw new Error("fal.ai cost estimation is planned for the image nodes task.");
  }

  async generate(model: string, params: GenParams): Promise<JobHandle> {
    void model;
    void params;
    throw new Error("fal.ai generation is planned for the image nodes task.");
  }
}
