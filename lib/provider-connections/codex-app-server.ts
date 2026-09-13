import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { chmod, mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

import type { OpenAiLoginMethod } from "./types";
import { isValidSessionRef, sanitizeProviderMessage } from "./security";

type JsonRpcId = number;
type JsonObject = Record<string, unknown>;

const CHILD_ENV_ALLOWLIST = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "ComSpec",
  "TEMP",
  "TMP",
  "TMPDIR",
  "LANG",
  "LC_ALL",
] as const;
export const HOMOLOGATED_CODEX_VERSION = "0.154.0";
const CODEX_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

type CodexProcess = Pick<
  ChildProcessWithoutNullStreams,
  "stdin" | "stdout" | "stderr" | "kill" | "once"
>;

export type CodexProcessFactory = (options: {
  bin: string;
  env: NodeJS.ProcessEnv;
}) => CodexProcess;

export function resolveCodexVersion(configuredVersion?: string) {
  const version = configuredVersion?.trim() || process.env.LABIA_CODEX_VERSION?.trim() || HOMOLOGATED_CODEX_VERSION;
  if (!CODEX_VERSION_PATTERN.test(version)) throw new Error("LABIA_CODEX_VERSION precisa usar semver X.Y.Z");
  return version;
}

function userAgentVersion(userAgent: string) {
  const firstToken = userAgent.trim().split(/\s+/, 1)[0] ?? "";
  return firstToken.match(/^[^\/\s]+\/v?(\d+\.\d+\.\d+)$/)?.[1] ?? null;
}

export type CodexImageItem = {
  type: "imageGeneration";
  id: string;
  status: "in_progress" | "completed" | "failed";
  result: string;
  savedPath: string | null;
  revisedPrompt?: string | null;
  transparentBackground?: boolean | null;
  failure?: unknown;
};

export type CodexImageStartInput = {
  model: string;
  prompt: string;
  referencedImagePaths?: string[];
  numLastImagesToInclude?: number;
};

export type CodexImageHandle = { id: string; threadId: string; turnId: string; model: string };

export type CodexImageModelOption = { id: string; name: string };

export type CodexImageAsset = {
  url: string;
  contentType: "image/png";
  fileName: string;
  fileSize: number;
};

export const CODEX_IMAGE_MAX_BYTES = 32 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function imageJobId(threadId: string, turnId: string) {
  return `codex-image:${Buffer.from(JSON.stringify({ threadId, turnId }), "utf8").toString("base64url")}`;
}

function parseImageJobId(id: string) {
  if (!id.startsWith("codex-image:")) throw new Error("image_generation_job_invalid");
  try {
    const parsed = JSON.parse(Buffer.from(id.slice("codex-image:".length), "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof parsed.threadId !== "string" || typeof parsed.turnId !== "string") throw new Error("invalid");
    return { threadId: parsed.threadId, turnId: parsed.turnId };
  } catch {
    throw new Error("image_generation_job_invalid");
  }
}

function asImageItem(value: unknown): CodexImageItem | null {
  const item = asObject(value);
  if (item.type !== "imageGeneration" || typeof item.id !== "string" || typeof item.status !== "string" || typeof item.result !== "string") return null;
  if (item.status !== "in_progress" && item.status !== "completed" && item.status !== "failed") return null;
  return {
    type: "imageGeneration",
    id: item.id,
    status: item.status,
    result: item.result,
    savedPath: typeof item.savedPath === "string" ? item.savedPath : null,
    revisedPrompt: typeof item.revisedPrompt === "string" ? item.revisedPrompt : null,
    transparentBackground: typeof item.transparentBackground === "boolean" ? item.transparentBackground : null,
    failure: item.failure,
  };
}

export type CodexLoginResponse =
  | { type: "chatgpt"; loginId: string; authUrl: string }
  | {
      type: "chatgptDeviceCode";
      loginId: string;
      verificationUrl: string;
      userCode: string;
    };

export type CodexLoginCompletion = {
  loginId: string | null;
  success: boolean;
  error: string | null;
};

const defaultProcessFactory: CodexProcessFactory = ({ bin, env }) =>
  spawn(bin, ["app-server"], {
    env,
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
    windowsHide: true,
  });

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function isInside(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function resolveCodexHomeRoot(configuredRoot?: string) {
  const rawRoot = configuredRoot?.trim() || path.join(os.homedir(), ".labia", "codex");
  if (!path.isAbsolute(rawRoot)) throw new Error("CODEX_HOME precisa ser um caminho absoluto");

  const root = path.resolve(rawRoot);
  const repositoryRoot = path.resolve(process.cwd());
  if (isInside(repositoryRoot, root)) throw new Error("CODEX_HOME precisa ficar fora do repositorio");
  return root;
}

export class CodexAppServerClient {
  private process: CodexProcess | null = null;
  private nextId = 1;
  private started = false;
  private startPromise: Promise<void> | null = null;
  private pending = new Map<
    JsonRpcId,
    { resolve: (value: unknown) => void; reject: (reason: Error) => void; timer: NodeJS.Timeout }
  >();
  private loginCompletions = new Map<string, CodexLoginCompletion>();
  private imageItems = new Map<string, CodexImageItem>();
  private imageWaiters = new Map<string, Array<(item: CodexImageItem) => void>>();

  constructor(
    private readonly options: {
      sessionRef: string;
      codexHomeRoot: string;
      codexBin?: string;
      codexVersion?: string;
      requestTimeoutMs?: number;
      processFactory?: CodexProcessFactory;
    },
  ) {
    if (!isValidSessionRef(options.sessionRef)) throw new Error("sessionRef inválido");
    resolveCodexHomeRoot(options.codexHomeRoot);
  }

  private get homePath() {
    const id = this.options.sessionRef.slice("labia-codex:".length);
    const root = resolveCodexHomeRoot(this.options.codexHomeRoot);
    const home = path.resolve(root, id);
    if (home !== root && !home.startsWith(`${root}${path.sep}`)) {
      throw new Error("CODEX_HOME fora da raiz dedicada");
    }
    return home;
  }

  private async prepareDedicatedHome() {
    await mkdir(this.homePath, { recursive: true, mode: 0o700 });
    const configPath = path.join(this.homePath, "config.toml");
    await writeFile(configPath, 'cli_auth_credentials_store = "file"\n', {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(this.homePath, 0o700).catch(() => undefined);
    await chmod(configPath, 0o600).catch(() => undefined);
  }

  private buildChildEnv() {
    const env = {} as NodeJS.ProcessEnv;
    env.CODEX_HOME = this.homePath;
    for (const key of CHILD_ENV_ALLOWLIST) {
      const value = process.env[key];
      if (value !== undefined) env[key] = value;
    }
    return env;
  }

  async start() {
    if (this.started) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = (async () => {
      const codexVersion = resolveCodexVersion(this.options.codexVersion);
      try {
        await this.prepareDedicatedHome();
      const factory = this.options.processFactory ?? defaultProcessFactory;
      const proc = factory({
        bin: this.options.codexBin ?? (process.env.LABIA_CODEX_BIN?.trim() || "codex"),
        env: this.buildChildEnv(),
      });
      this.process = proc;
      const stdout = readline.createInterface({ input: proc.stdout });
      stdout.on("line", (line) => this.handleLine(line));
      proc.stderr.on("data", () => undefined);
      proc.once("exit", () => this.handleExit());
      const initializeResult = asObject(await this.requestRaw("initialize", {
        clientInfo: { name: "labia-provider-executor", title: "LabIA Provider Executor", version: codexVersion },
        capabilities: { experimentalApi: false },
      }));
      const serverUserAgent = getString(initializeResult.userAgent);
      if (!serverUserAgent || userAgentVersion(serverUserAgent) !== codexVersion) {
        throw new Error(`Codex App Server incompat\u00edvel: userAgent n\u00e3o corresponde a ${codexVersion}`);
      }
      this.write({ jsonrpc: "2.0", method: "initialized" });
      this.started = true;
      } catch (error) {
        try {
          this.close();
        } catch {
          // Preserve the initialize failure as the public error.
        }
        throw error;
      }
    })().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async readAccount() {
    await this.start();
    return asObject(await this.requestRaw("account/read", { refreshToken: false }));
  }

  async readImageGenerationModels(): Promise<CodexImageModelOption[]> {
    await this.start();
    const account = asObject(await this.requestRaw("account/read", { refreshToken: false }));
    const accountData = asObject(account.account);
    const plan = getString(accountData.planType) ?? getString(accountData.plan_type);
    if (!plan || plan.toLowerCase() === "free") throw new Error("image_generation_plan_unavailable");
    const authMode = getString(accountData.type);
    const compatibleAuth = authMode === "chatgpt" && (
      account.requiresOpenaiAuth === true ||
      getString(accountData.authMode) === "chatgpt" ||
      getString(accountData.auth_mode) === "chatgpt"
    );
    if (!compatibleAuth) throw new Error("image_generation_auth_unavailable");

    const capabilities = asObject(await this.requestRaw("modelProvider/capabilities/read", {}));
    if (capabilities.imageGeneration !== true) throw new Error("image_generation_feature_unavailable");
    if (capabilities.namespaceTools !== true) throw new Error("image_generation_namespace_tools_unavailable");
    const modelsResponse = asObject(await this.requestRaw("model/list", {}));
    const models = Array.isArray(modelsResponse.data)
      ? modelsResponse.data
      : Array.isArray(modelsResponse.models) ? modelsResponse.models : [];
    return models.map(asObject).flatMap((candidate) => {
      const id = getString(candidate.id) ?? getString(candidate.model);
      const modalities = Array.isArray(candidate.inputModalities) ? candidate.inputModalities : [];
      if (!id || !modalities.some((modality) => typeof modality === "string" && modality.toLowerCase() === "image")) return [];
      return [{ id, name: getString(candidate.name) ?? getString(candidate.title) ?? id }];
    });
  }

  async assertImageGenerationReady(model: string) {
    const models = await this.readImageGenerationModels();
    if (!models.some((candidate) => candidate.id === model)) throw new Error("image_generation_model_unavailable");
  }

  async startImageGeneration(input: CodexImageStartInput): Promise<CodexImageHandle> {
    if (!input.model || !input.prompt.trim()) throw new Error("image_generation_input_invalid");
    await this.start();
    const threadResponse = asObject(await this.requestRaw("thread/start", { model: input.model, modelProvider: "openai" }));
    const thread = asObject(threadResponse.thread);
    const threadId = getString(thread.id) ?? getString(threadResponse.threadId);
    if (!threadId) throw new Error("image_generation_thread_missing");
    const turnResponse = asObject(await this.requestRaw("turn/start", {
      threadId,
      input: [{ type: "text", text: input.prompt }],
    }));
    const turn = asObject(turnResponse.turn);
    const turnId = getString(turn.id) ?? getString(turnResponse.turnId);
    if (!turnId) throw new Error("image_generation_turn_missing");
    return { id: imageJobId(threadId, turnId), threadId, turnId, model: input.model };
  }

  async waitForImageGeneration(jobId: string): Promise<CodexImageItem> {
    await this.start();
    const { threadId, turnId } = parseImageJobId(jobId);
    const key = `${threadId}:${turnId}`;
    const live = this.imageItems.get(key);
    if (live) return this.assertCompletedImage(live);

    const notification = this.createImageWaiter(key);
    let recovered: CodexImageItem | null = null;
    try {
      recovered = await this.recoverImageItem(threadId, turnId);
    } catch {
      // A live item/completed can still arrive when the history endpoint is unavailable.
    }
    if (recovered) {
      notification.cancel();
      return this.assertCompletedImage(recovered);
    }
    return this.assertCompletedImage(await notification.promise);
  }

  async normalizeImageResult(item: CodexImageItem): Promise<CodexImageAsset> {
    const encoded = item.result;
    if (item.status !== "completed" || !encoded || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      throw new Error("image_generation_invalid_base64");
    }
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length === 0 || bytes.length > CODEX_IMAGE_MAX_BYTES || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new Error("image_generation_invalid_artifact_mime");
    }
    if (item.savedPath) {
      if (!path.isAbsolute(item.savedPath)) throw new Error("image_generation_saved_path_outside_codex_home");
      let home: string;
      let candidate: string;
      try {
        home = await realpath(this.homePath);
        candidate = await realpath(item.savedPath);
        const file = await stat(candidate);
        if (!file.isFile() || !isInside(home, candidate)) throw new Error("outside");
        if (file.size > CODEX_IMAGE_MAX_BYTES) throw new Error("large");
        const persisted = await readFile(candidate);
        if (!persisted.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) || !persisted.equals(bytes)) throw new Error("mismatch");
      } catch {
        throw new Error("image_generation_saved_path_outside_codex_home");
      }
    }
    return {
      url: `data:image/png;base64,${encoded}`,
      contentType: "image/png",
      fileName: `codex-${item.id}.png`,
      fileSize: bytes.length,
    };
  }

  async startLogin(method: OpenAiLoginMethod) {
    await this.start();
    const result = asObject(await this.requestRaw("account/login/start", { type: method }));
    if (result.type === "chatgpt") {
      const loginId = getString(result.loginId);
      const authUrl = getString(result.authUrl);
      if (!loginId || !authUrl) throw new Error("Resposta de login ChatGPT incompleta");
      return { type: "chatgpt", loginId, authUrl } satisfies CodexLoginResponse;
    }
    if (result.type === "chatgptDeviceCode") {
      const loginId = getString(result.loginId);
      const verificationUrl = getString(result.verificationUrl);
      const userCode = getString(result.userCode);
      if (!loginId || !verificationUrl || !userCode) throw new Error("Resposta de device code incompleta");
      return { type: "chatgptDeviceCode", loginId, verificationUrl, userCode } satisfies CodexLoginResponse;
    }
    throw new Error("O App Server retornou um método de login inesperado");
  }

  async cancelLogin(loginId: string) {
    await this.start();
    return this.requestRaw("account/login/cancel", { loginId });
  }

  async logout() {
    await this.start();
    await this.requestRaw("account/logout", undefined);
  }

  async clearDedicatedHome() {
    await rm(this.homePath, { recursive: true, force: true });
  }

  getLoginCompletion(loginId: string) {
    return this.loginCompletions.get(loginId) ?? null;
  }

  close() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.started = false;
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error("Codex App Server encerrado"));
    }
    this.pending.clear();
    this.imageWaiters.clear();
  }

  private assertCompletedImage(item: CodexImageItem) {
    if (item.status === "failed") {
      throw new Error(`image_generation_failed: ${sanitizeProviderMessage(item.failure ?? "resultado recusado")}`);
    }
    if (item.status !== "completed") throw new Error("image_generation_incomplete");
    return item;
  }

  private createImageWaiter(key: string) {
    let resolvePromise!: (value: CodexImageItem) => void;
    let rejectPromise!: (reason: Error) => void;
    const waiter = (value: CodexImageItem) => {
      clearTimeout(timer);
      resolvePromise(value);
    };
    const promise = new Promise<CodexImageItem>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const timer = setTimeout(() => {
      const waiters = this.imageWaiters.get(key) ?? [];
      this.imageWaiters.set(key, waiters.filter((entry) => entry !== waiter));
      rejectPromise(new Error("Timeout aguardando item/completed imageGeneration"));
    }, this.options.requestTimeoutMs ?? 15_000);
    this.imageWaiters.set(key, [...(this.imageWaiters.get(key) ?? []), waiter]);
    return {
      promise,
      cancel: () => {
        clearTimeout(timer);
        const waiters = this.imageWaiters.get(key) ?? [];
        this.imageWaiters.set(key, waiters.filter((entry) => entry !== waiter));
      },
    };
  }

  private async recoverImageItem(threadId: string, turnId: string) {
    try {
      const threadResponse = asObject(await this.requestRaw("thread/read", { threadId, includeTurns: true }));
      const thread = asObject(threadResponse.thread);
      const turns = Array.isArray(thread.turns) ? thread.turns : [];
      for (const turn of turns) {
        const value = asObject(turn);
        if (getString(value.id) !== turnId) continue;
        const items = Array.isArray(value.items) ? value.items : [];
        const found = items.map(asImageItem).find((item): item is CodexImageItem => item !== null);
        if (found) return found;
      }
    } catch {
      // thread/items/list is the official paginated recovery fallback.
    }
    const listResponse = asObject(await this.requestRaw("thread/items/list", {
      threadId,
      turnId,
      sortDirection: "desc",
      limit: 100,
    }));
    const entries = Array.isArray(listResponse.data) ? listResponse.data : [];
    return entries.map((entry) => asImageItem(asObject(entry).item)).find((item): item is CodexImageItem => item !== null) ?? null;
  }

  private async requestRaw(method: string, params: unknown) {
    const id = this.nextId++;
    const timeoutMs = this.options.requestTimeoutMs ?? 15_000;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timeout no método ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
    });
  }

  private write(message: JsonObject) {
    if (!this.process) throw new Error("Codex App Server não iniciado");
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleLine(line: string) {
    let message: JsonObject;
    try {
      message = asObject(JSON.parse(line));
    } catch {
      return;
    }
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        const error = asObject(message.error);
        pending.reject(new Error(sanitizeProviderMessage(error.message ?? "Erro JSON-RPC")));
      } else pending.resolve(message.result);
      return;
    }
    if (message.method === "account/login/completed") {
      const params = asObject(message.params);
      const loginId = getString(params.loginId);
      if (loginId) {
        this.loginCompletions.set(loginId, {
          loginId,
          success: params.success === true,
          error: getString(params.error),
        });
      }
      return;
    }
    if (message.method === "item/completed") {
      const params = asObject(message.params);
      const threadId = getString(params.threadId);
      const turnId = getString(params.turnId);
      const item = asImageItem(params.item);
      if (!threadId || !turnId || !item) return;
      const key = `${threadId}:${turnId}`;
      this.imageItems.set(key, item);
      for (const waiter of this.imageWaiters.get(key) ?? []) waiter(item);
      this.imageWaiters.delete(key);
    }
  }

  private handleExit() {
    this.process = null;
    this.started = false;
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error("Codex App Server encerrou inesperadamente"));
    }
    this.pending.clear();
  }
}
