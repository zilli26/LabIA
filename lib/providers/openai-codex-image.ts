import { getExecutorConfig, sanitizeProviderMessage } from "@/lib/provider-connections/security";
import type { CodexImageAsset, CodexImageItem, CodexImageStartInput } from "@/lib/provider-connections/codex-app-server";
import type {
  CostEstimate,
  GenParams,
  GenerationResult,
  JobHandle,
  ModelInfo,
  ModelProvider,
} from "./model-provider";

export const OPENAI_IMAGE_CONTRACT_UNAVAILABLE = "image_generation_contract_unavailable";

export type ExecutorImageResult = { requestId: string; asset: CodexImageAsset; raw: CodexImageItem };

export type CodexImageExecutor = {
  startImageGeneration(input: CodexImageStartInput): Promise<JobHandle>;
  waitForImageGeneration(handle: JobHandle): Promise<ExecutorImageResult>;
};

const DEFAULT_MODEL: ModelInfo = {
  id: "gpt-5.5",
  provider: "openai",
  name: "GPT-5.5 com imagem",
  kind: "image",
  description: "Imagem pelo App Server oficial, usando a assinatura ChatGPT.",
  pricing: { unit: "image", unitPriceUsd: 0, note: "Uso da assinatura; cota observada somente no executor." },
};

function httpError(payload: unknown, status: number) {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const error = body.error && typeof body.error === "object" ? body.error as Record<string, unknown> : {};
  const code = typeof error.code === "string" ? error.code : OPENAI_IMAGE_CONTRACT_UNAVAILABLE;
  const message = typeof error.message === "string" ? error.message : `Executor respondeu HTTP ${status}`;
  return new Error(`${code}: ${sanitizeProviderMessage(message)}`);
}

async function executorRequest<T>(sessionRef: string, pathname: string, body: unknown): Promise<T> {
  const { url, token } = getExecutorConfig();
  const response = await fetch(new URL(`/connections/${encodeURIComponent(sessionRef)}/image/${pathname}`, url), {
    method: "POST",
    cache: "no-store",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(payload, response.status);
  return payload as T;
}

export class HttpCodexImageExecutor implements CodexImageExecutor {
  constructor(private readonly sessionRef: string) {}

  async startImageGeneration(input: CodexImageStartInput) {
    const response = await executorRequest<{ jobId: string; model: string }>(this.sessionRef, "start", input);
    if (!response.jobId || !response.model) throw new Error(`${OPENAI_IMAGE_CONTRACT_UNAVAILABLE}: job inválido`);
    return { id: response.jobId, provider: "openai", model: response.model } satisfies JobHandle;
  }

  async waitForImageGeneration(handle: JobHandle) {
    const response = await executorRequest<ExecutorImageResult>(this.sessionRef, "result", { jobId: handle.id });
    if (!response.asset?.url || response.asset.contentType !== "image/png") {
      throw new Error(`${OPENAI_IMAGE_CONTRACT_UNAVAILABLE}: artefato não normalizado`);
    }
    return response;
  }
}

export class OpenAiCodexImageProvider implements ModelProvider {
  readonly id = "openai";
  readonly capabilities = { image: true, video: false, recoverableResults: true } as const;
  private readonly models: ModelInfo[];
  private readonly executor: CodexImageExecutor;

  constructor(options: { executor?: CodexImageExecutor; sessionRef?: string; models?: ModelInfo[] } = {}) {
    this.models = options.models ?? [DEFAULT_MODEL];
    this.executor = options.executor ?? new HttpCodexImageExecutor(options.sessionRef ?? "");
  }

  listModels(kind: "image" | "video" | "text") {
    return kind === "image" ? this.models : [];
  }

  estimateCost(model: string, params: GenParams): CostEstimate {
    this.assertSupported(model, params);
    return {
      usd: 0,
      brl: 0,
      source: "codex-chatgpt-subscription",
      billingMode: "subscription",
      lineItems: [{ label: "Imagem ChatGPT (cota da assinatura)", quantity: 1, unit: "image", unitPriceUsd: 0, usd: 0 }],
    };
  }

  async generate(model: string, params: GenParams): Promise<JobHandle> {
    this.assertSupported(model, params);
    return this.executor.startImageGeneration({ model, prompt: typeof params.prompt === "string" ? params.prompt : "" });
  }

  async waitForResult(handle: JobHandle, params: GenParams): Promise<GenerationResult> {
    this.assertSupported(handle.model, params);
    const response = await this.executor.waitForImageGeneration(handle);
    return {
      provider: this.id,
      model: handle.model,
      requestId: response.requestId,
      images: [response.asset],
      cost: this.estimateCost(handle.model, params),
      raw: response.raw,
    };
  }

  private assertSupported(model: string, params: GenParams) {
    if (params.kind === "video") throw new Error(`${OPENAI_IMAGE_CONTRACT_UNAVAILABLE}: OpenAI executor só oferece imagem`);
    if (!this.models.some((candidate) => candidate.id === model)) throw new Error("image_generation_model_unavailable");
  }
}
