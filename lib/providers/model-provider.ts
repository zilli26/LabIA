export type ModelKind = "image" | "video" | "text";

export type CostEstimate = {
  usd: number;
  brl: number;
};

export type ModelInfo = {
  id: string;
  name: string;
  kind: ModelKind;
};

export type GenParams = Record<string, unknown>;

export type JobHandle = {
  id: string;
  provider: string;
};

export interface ModelProvider {
  id: string;
  listModels(kind: ModelKind): Promise<ModelInfo[]>;
  estimateCost(model: string, params: GenParams): Promise<CostEstimate>;
  generate(model: string, params: GenParams): Promise<JobHandle>;
}
