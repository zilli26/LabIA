import type {
  BillingMode,
  GenParams,
  GenerationResult,
  JobHandle,
  ModelProvider,
} from "./model-provider";

export type GenerationSubmissionState =
  | "not_submitted"
  | "submitting"
  | "submitted"
  | "submission_unknown"
  | "completed"
  | "failed";

export type GenerationStoreRecord = {
  id: string;
  operationKey: string;
  provider: string;
  model: string;
  params: GenParams;
  status: "queued" | "running" | "done" | "failed";
  submissionState: GenerationSubmissionState;
  providerJobId?: string;
  result?: GenerationResult;
  errorMessage?: string;
  workspaceId?: string;
  brandId?: string;
  connectionId?: string;
  flowRunId?: string;
  flowNodeId?: string;
  billingMode: BillingMode;
  currency?: string;
  estimatedCostUsd?: number;
  estimatedCostBrl?: number;
};

export type GenerationStoreCreateInput = Omit<GenerationStoreRecord, "id" | "status" | "submissionState">;

export type GenerationStore = {
  findByOperationKey(operationKey: string): Promise<GenerationStoreRecord | null>;
  create(input: GenerationStoreCreateInput): Promise<GenerationStoreRecord>;
  claim(id: string): Promise<boolean>;
  markSubmitted(id: string, handle: JobHandle): Promise<void>;
  markUnknown(id: string, errorMessage: string): Promise<void>;
  markDone(id: string, result: GenerationResult): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
  get(id: string): Promise<GenerationStoreRecord | null>;
  persistAsset(id: string, index: number, asset: unknown): Promise<void>;
};

type RunInput = {
  operationKey: string;
  provider: string;
  model: string;
  params: GenParams;
  workspaceId?: string;
  brandId?: string;
  connectionId?: string;
  flowRunId?: string;
  flowNodeId?: string;
  billingMode: BillingMode;
  currency?: string;
  estimatedCostUsd?: number;
  estimatedCostBrl?: number;
};

const operationLocks = new Map<string, Promise<void>>();

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

async function withOperationLock<T>(key: string, operation: () => Promise<T>) {
  const previous = operationLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  operationLocks.set(key, queued);

  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (operationLocks.get(key) === queued) operationLocks.delete(key);
  }
}

export class GenerationCoordinator {
  constructor(
    private readonly dependencies: {
      store: GenerationStore;
      provider: ModelProvider;
    },
  ) {}

  async run(input: RunInput) {
    return withOperationLock(input.operationKey, async () => {
      let generation = await this.dependencies.store.findByOperationKey(input.operationKey);

      if (!generation) {
        try {
          generation = await this.dependencies.store.create({
            operationKey: input.operationKey,
            provider: input.provider,
            model: input.model,
            params: input.params,
            workspaceId: input.workspaceId,
            brandId: input.brandId,
            connectionId: input.connectionId,
            flowRunId: input.flowRunId,
            flowNodeId: input.flowNodeId,
            billingMode: input.billingMode,
            currency: input.currency,
            estimatedCostUsd: input.estimatedCostUsd,
            estimatedCostBrl: input.estimatedCostBrl,
          });
        } catch (error) {
          const raced = await this.dependencies.store.findByOperationKey(input.operationKey);
          if (!raced) throw error;
          generation = raced;
        }
      }
      if (generation.provider !== input.provider || generation.model !== input.model || canonicalJson(generation.params) !== canonicalJson(input.params)) {
        throw new Error("operationKey já usado por outro snapshot de execução.");
      }

      if (generation.submissionState === "submission_unknown") {
        throw new Error("Submit ambíguo: reconciliação manual necessária; nenhum reenvio automático.");
      }
      if (generation.status === "done" && generation.result) {
        return { generationId: generation.id, result: generation.result };
      }

      const claimed = await this.dependencies.store.claim(generation.id);
      if (!claimed && !generation.providerJobId && generation.submissionState !== "submitted") {
        throw new Error("Generation já está sendo processada por outra execução.");
      }

      const handle = generation.providerJobId
        ? { id: generation.providerJobId, provider: generation.provider, model: generation.model }
        : await this.submit(generation, input);

      const result = await this.dependencies.provider.waitForResult(handle, generation.params);
      await Promise.all([
        ...result.images.map((asset, index) => this.dependencies.store.persistAsset(generation!.id, index, asset)),
        ...(result.videos ?? []).map((asset, index) =>
          this.dependencies.store.persistAsset(generation!.id, result!.images.length + index, asset),
        ),
      ]);
      await this.dependencies.store.markDone(generation.id, result);

      return { generationId: generation.id, result };
    });
  }

  private async submit(generation: GenerationStoreRecord, input: RunInput) {
    try {
      const handle = await this.dependencies.provider.generate(input.model, input.params);
      await this.dependencies.store.markSubmitted(generation.id, handle);
      return handle;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.dependencies.store.markUnknown(generation.id, message);
      throw new Error(`Submit ambíguo: ${message}`);
    }
  }
}
