import { spawn } from "node:child_process";

import {
  buildCodexChildEnv,
  ensureConnectionCodexHome,
  getCodexBinary,
  type EnvMap,
} from "@/lib/providers/openai-codex/environment";

type DataListener = (chunk: Buffer | string) => void;
type ExitListener = (code: number | null, signal: NodeJS.Signals | null) => void;
type ErrorListener = (error: Error) => void;

export type CodexProcess = {
  stdin: {
    write(chunk: string): unknown;
    end?: () => void;
  };
  stdout: { on(event: "data", listener: DataListener): unknown };
  stderr: { on(event: "data", listener: DataListener): unknown };
  on(event: "exit", listener: ExitListener): unknown;
  on(event: "error", listener: ErrorListener): unknown;
  kill(signal?: NodeJS.Signals): unknown;
};

export type SpawnCodexProcess = (
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env: EnvMap;
    stdio: ["pipe", "pipe", "pipe"];
    windowsHide: boolean;
    shell: false;
  },
) => CodexProcess;

type JsonRpcMessage = {
  id?: number | string | null;
  result?: unknown;
  error?: { code?: number; message?: string };
  method?: string;
  params?: unknown;
};

export type ChatgptLoginResponse = {
  type: "chatgpt";
  loginId: string;
  authUrl: string;
};

export type DeviceCodeLoginResponse = {
  type: "chatgptDeviceCode";
  loginId: string;
  verificationUrl: string;
  userCode: string;
};

export type LoginResponse = ChatgptLoginResponse | DeviceCodeLoginResponse;

export type AccountLoginCompleted = {
  loginId: string;
  success: boolean;
  error?: string | null;
};

export type AccountReadResult = {
  account:
    | null
    | {
        type: string;
        email?: string | null;
        planType?: string | null;
        [key: string]: unknown;
      };
  requiresOpenaiAuth?: boolean;
};

class CodexProtocolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CodexProtocolError";
    this.code = code;
  }
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

type LoginWaiter = {
  resolve: (value: AccountLoginCompleted) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

export type CodexAppServerClientOptions = {
  credentialRef: string;
  spawnProcess?: SpawnCodexProcess;
  requestTimeoutMs?: number;
  env?: EnvMap;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_LOGIN_TIMEOUT_MS = 10 * 60_000;

export class CodexAppServerClient {
  private readonly credentialRef: string;
  private readonly spawnProcess: SpawnCodexProcess;
  private readonly requestTimeoutMs: number;
  private readonly env: EnvMap;
  private process: CodexProcess | null = null;
  private buffer = "";
  private nextId = 1;
  private closed = false;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly loginWaiters = new Map<string, LoginWaiter>();
  private readonly completedLogins = new Map<string, AccountLoginCompleted>();

  constructor(options: CodexAppServerClientOptions) {
    this.credentialRef = options.credentialRef;
    this.spawnProcess = options.spawnProcess ?? (spawn as unknown as SpawnCodexProcess);
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.env = options.env ?? process.env;
  }

  get isRunning() {
    return this.process !== null && !this.closed;
  }

  async start() {
    if (this.process && !this.closed) return;

    this.closed = false;
    const codexHome = await ensureConnectionCodexHome(
      this.credentialRef,
      this.env,
    );
    const child = this.spawnProcess(getCodexBinary(this.env), ["app-server"], {
      env: buildCodexChildEnv(codexHome, this.env),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });

    this.process = child;
    child.stdout.on("data", (chunk) => this.consumeStdout(chunk));
    child.stderr.on("data", () => {
      // Drain stderr so the child cannot block. Raw stderr is never forwarded:
      // it may contain local paths or authentication-adjacent diagnostics.
    });
    child.on("error", () => this.failProcess("executor_start_failed"));
    child.on("exit", () => this.failProcess("executor_exited"));

    await this.request("initialize", {
      clientInfo: { name: "labia", title: "LabIA", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    this.notify("initialized");
  }

  async readAccount(refreshToken = false) {
    const result = await this.request("account/read", { refreshToken });
    return result as AccountReadResult;
  }

  async startLogin(type: "chatgpt" | "chatgptDeviceCode") {
    const result = await this.request("account/login/start", { type });
    if (!isLoginResponse(result)) {
      throw new CodexProtocolError(
        "unexpected_login_response",
        "Codex returned an unexpected login response.",
      );
    }
    return result;
  }

  async cancelLogin(loginId: string) {
    await this.request("account/login/cancel", { loginId });
  }

  async logout() {
    await this.request("account/logout");
  }

  waitForLogin(loginId: string, timeoutMs = DEFAULT_LOGIN_TIMEOUT_MS) {
    const completed = this.completedLogins.get(loginId);
    if (completed) return Promise.resolve(completed);

    return new Promise<AccountLoginCompleted>((resolve, reject) => {
      const previous = this.loginWaiters.get(loginId);
      if (previous) {
        clearTimeout(previous.timer);
        previous.reject(
          new CodexProtocolError(
            "login_wait_replaced",
            "A newer wait replaced the previous login wait.",
          ),
        );
      }

      const timer = setTimeout(() => {
        this.loginWaiters.delete(loginId);
        reject(
          new CodexProtocolError(
            "login_timeout",
            "ChatGPT login did not complete before the local timeout.",
          ),
        );
      }, timeoutMs);

      this.loginWaiters.set(loginId, { resolve, reject, timer });
    });
  }

  close() {
    if (!this.process || this.closed) return;
    this.closed = true;
    this.process.stdin.end?.();
    this.process.kill("SIGTERM");
    this.process = null;
    this.rejectAll("executor_closed");
  }

  private request(method: string, params?: unknown) {
    if (!this.process || this.closed) {
      return Promise.reject(
        new CodexProtocolError(
          "executor_not_running",
          "Codex App Server is not running.",
        ),
      );
    }

    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new CodexProtocolError(
            "request_timeout",
            `Codex App Server did not answer ${method} in time.`,
          ),
        );
      }, this.requestTimeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      this.write({ id, method, ...(params === undefined ? {} : { params }) });
    });
  }

  private notify(method: string, params?: unknown) {
    this.write({ method, ...(params === undefined ? {} : { params }) });
  }

  private write(message: Record<string, unknown>) {
    if (!this.process || this.closed) {
      throw new CodexProtocolError(
        "executor_not_running",
        "Codex App Server is not running.",
      );
    }
    this.process.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private consumeStdout(chunk: Buffer | string) {
    this.buffer += chunk.toString();

    while (true) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex < 0) return;

      const rawLine = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!rawLine) continue;

      let message: JsonRpcMessage;
      try {
        message = JSON.parse(rawLine) as JsonRpcMessage;
      } catch {
        this.failProcess("invalid_json");
        return;
      }
      this.handleMessage(message);
    }
  }

  private handleMessage(message: JsonRpcMessage) {
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;

      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(
          new CodexProtocolError(
            `rpc_${message.error.code ?? "error"}`,
            "Codex App Server rejected the request.",
          ),
        );
        return;
      }
      pending.resolve(message.result);
      return;
    }

    if (message.method !== "account/login/completed") return;
    const completion = parseLoginCompleted(message.params);
    if (!completion) return;

    this.completedLogins.set(completion.loginId, completion);
    const waiter = this.loginWaiters.get(completion.loginId);
    if (!waiter) return;

    clearTimeout(waiter.timer);
    this.loginWaiters.delete(completion.loginId);
    waiter.resolve(completion);
  }

  private failProcess(code: string) {
    if (this.closed) return;
    this.closed = true;
    this.process = null;
    this.rejectAll(code);
  }

  private rejectAll(code: string) {
    const error = new CodexProtocolError(
      code,
      "Codex App Server became unavailable.",
    );

    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();

    for (const waiter of this.loginWaiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.loginWaiters.clear();
  }
}

function isLoginResponse(value: unknown): value is LoginResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;

  if (candidate.type === "chatgpt") {
    return (
      typeof candidate.loginId === "string" &&
      typeof candidate.authUrl === "string"
    );
  }

  if (candidate.type === "chatgptDeviceCode") {
    return (
      typeof candidate.loginId === "string" &&
      typeof candidate.verificationUrl === "string" &&
      typeof candidate.userCode === "string"
    );
  }

  return false;
}

function parseLoginCompleted(value: unknown): AccountLoginCompleted | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.loginId !== "string" ||
    typeof candidate.success !== "boolean"
  ) {
    return null;
  }

  return {
    loginId: candidate.loginId,
    success: candidate.success,
    error: typeof candidate.error === "string" ? candidate.error : null,
  };
}

export function getCodexErrorCode(error: unknown) {
  return error instanceof CodexProtocolError
    ? error.code
    : "executor_unknown_error";
}
