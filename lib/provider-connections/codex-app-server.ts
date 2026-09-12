import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
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
        await this.clearDedicatedHome().catch(() => undefined);
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
