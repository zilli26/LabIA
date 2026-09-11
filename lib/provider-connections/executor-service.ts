import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";

import { CodexAppServerClient, type CodexProcessFactory } from "./codex-app-server";
import type { ExecutorAccountStatus, LoginInstruction, OpenAiLoginMethod, ProviderConnectionStatus } from "./types";
import { isValidSessionRef, sanitizeProviderMessage } from "./security";

type LoginAttempt = {
  loginId: string;
  method: OpenAiLoginMethod;
  startedAt: number;
  expiresAt: number;
  instruction: Omit<LoginInstruction, "expiresAt">;
  terminalStatus?: "cancelled" | "expired" | "failed";
};

type SessionState = { client: CodexAppServerClient; attempt: LoginAttempt | null };
type ManagerOptions = {
  codexHomeRoot: string;
  codexBin?: string;
  loginTtlMs?: number;
  processFactory?: CodexProcessFactory;
  now?: () => number;
};

function objectValue(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}
function accountSnapshot(accountResponse: Record<string, unknown>) {
  const account = objectValue(accountResponse.account);
  return {
    connected: account.type === "chatgpt",
    accountLabel: stringValue(account.email),
    planType: stringValue(account.planType) ?? stringValue(account.plan_type),
  };
}

export class ProviderExecutorManager {
  private readonly sessions = new Map<string, SessionState>();
  private readonly now: () => number;
  private readonly loginTtlMs: number;

  constructor(private readonly options: ManagerOptions) {
    this.now = options.now ?? Date.now;
    this.loginTtlMs = options.loginTtlMs ?? 10 * 60_000;
  }

  async startLogin(sessionRef: string, method: OpenAiLoginMethod) {
    const session = this.getOrCreateSession(sessionRef);
    await this.expireAttemptIfNeeded(session);
    if (session.attempt && !session.attempt.terminalStatus) {
      await session.client.cancelLogin(session.attempt.loginId).catch(() => undefined);
    }
    const response = await session.client.startLogin(method);
    const expiresAt = this.now() + this.loginTtlMs;
    const instruction = response.type === "chatgpt"
      ? ({ type: "chatgpt", authUrl: response.authUrl } as const)
      : ({ type: "chatgptDeviceCode", verificationUrl: response.verificationUrl, userCode: response.userCode } as const);
    session.attempt = {
      loginId: response.loginId,
      method,
      startedAt: this.now(),
      expiresAt,
      instruction,
    };
    return {
      loginId: response.loginId,
      instruction: { ...instruction, expiresAt: new Date(expiresAt).toISOString() } satisfies LoginInstruction,
    };
  }

  async status(sessionRef: string): Promise<ExecutorAccountStatus> {
    const session = this.getOrCreateSession(sessionRef);
    await this.expireAttemptIfNeeded(session);
    try {
      const response = await session.client.readAccount();
      const snapshot = accountSnapshot(response);
      const completion = session.attempt ? session.client.getLoginCompletion(session.attempt.loginId) : null;
      let authStatus: ProviderConnectionStatus = snapshot.connected
        ? "connected"
        : session.attempt && !session.attempt.terminalStatus
          ? "connecting"
          : session.attempt?.terminalStatus === "expired"
            ? "expired"
            : session.attempt?.terminalStatus === "failed"
              ? "error"
              : "disconnected";
      let errorMessage: string | null = null;
      if (completion && !completion.success) {
        authStatus = session.attempt?.terminalStatus === "expired" ? "expired" : "error";
        errorMessage = completion.error ? sanitizeProviderMessage(completion.error) : null;
        if (session.attempt && !session.attempt.terminalStatus) session.attempt.terminalStatus = "failed";
      }
      if (snapshot.connected && session.attempt) session.attempt = null;
      return {
        authStatus,
        executorStatus: "online",
        accountLabel: snapshot.accountLabel,
        planType: snapshot.planType,
        loginExpiresAt: session.attempt && !session.attempt.terminalStatus
          ? new Date(session.attempt.expiresAt).toISOString()
          : null,
        errorCode: errorMessage ? "login_failed" : null,
        errorMessage,
      };
    } catch (error) {
      return {
        authStatus: "error",
        executorStatus: "error",
        accountLabel: null,
        planType: null,
        loginExpiresAt: null,
        errorCode: "app_server_error",
        errorMessage: sanitizeProviderMessage(error),
      };
    }
  }

  async cancelLogin(sessionRef: string) {
    const session = this.getOrCreateSession(sessionRef);
    await this.expireAttemptIfNeeded(session);
    if (session.attempt && !session.attempt.terminalStatus) {
      await session.client.cancelLogin(session.attempt.loginId);
      session.attempt.terminalStatus = "cancelled";
    }
    return this.status(sessionRef);
  }

  async logout(sessionRef: string) {
    const session = this.getOrCreateSession(sessionRef);
    if (session.attempt && !session.attempt.terminalStatus) {
      await session.client.cancelLogin(session.attempt.loginId).catch(() => undefined);
    }
    await session.client.logout();
    session.attempt = null;
    session.client.close();
    this.sessions.delete(sessionRef);
    return {
      authStatus: "disconnected",
      executorStatus: "online",
      accountLabel: null,
      planType: null,
      loginExpiresAt: null,
      errorCode: null,
      errorMessage: null,
    } satisfies ExecutorAccountStatus;
  }

  closeAll() {
    for (const session of this.sessions.values()) session.client.close();
    this.sessions.clear();
  }

  private getOrCreateSession(sessionRef: string) {
    if (!isValidSessionRef(sessionRef)) throw new Error("sessionRef inválido");
    const existing = this.sessions.get(sessionRef);
    if (existing) return existing;
    const client = new CodexAppServerClient({
      sessionRef,
      codexHomeRoot: this.options.codexHomeRoot,
      codexBin: this.options.codexBin,
      processFactory: this.options.processFactory,
    });
    const session = { client, attempt: null } satisfies SessionState;
    this.sessions.set(sessionRef, session);
    return session;
  }

  private async expireAttemptIfNeeded(session: SessionState) {
    if (!session.attempt || session.attempt.terminalStatus || this.now() < session.attempt.expiresAt) return;
    await session.client.cancelLogin(session.attempt.loginId).catch(() => undefined);
    session.attempt.terminalStatus = "expired";
  }
}

function readJson(req: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 32_768) {
        reject(new Error("Payload muito grande"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(objectValue(JSON.parse(Buffer.concat(chunks).toString("utf8"))));
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}

export function createProviderExecutorServer(options?: { token?: string; manager?: ProviderExecutorManager }) {
  const token = options?.token ?? process.env.LABIA_PROVIDER_EXECUTOR_TOKEN?.trim();
  if (!token || token.length < 32) throw new Error("LABIA_PROVIDER_EXECUTOR_TOKEN precisa ter pelo menos 32 caracteres");
  const manager = options?.manager ?? new ProviderExecutorManager({
    codexHomeRoot: path.resolve(process.env.LABIA_CODEX_HOME_ROOT?.trim() || path.join(process.cwd(), ".labia", "codex")),
    codexBin: process.env.LABIA_CODEX_BIN?.trim() || "codex",
    loginTtlMs: Number(process.env.LABIA_OPENAI_LOGIN_TTL_MS || 600_000),
  });
  const server = createServer(async (req, res) => {
    try {
      if (req.headers.authorization !== `Bearer ${token}`) {
        return sendJson(res, 401, { error: { code: "unauthorized", message: "Não autorizado." } });
      }
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/health") {
        return sendJson(res, 200, { ok: true, executorStatus: "online" });
      }
      const match = url.pathname.match(/^\/connections\/([^/]+)\/(start|status|cancel|logout)$/);
      if (!match) return sendJson(res, 404, { error: { code: "not_found", message: "Rota inexistente." } });
      const sessionRef = decodeURIComponent(match[1]);
      const action = match[2];
      if (!isValidSessionRef(sessionRef)) {
        return sendJson(res, 400, { error: { code: "invalid_session_ref", message: "Referência inválida." } });
      }
      if (action === "status" && req.method === "GET") return sendJson(res, 200, await manager.status(sessionRef));
      if (req.method !== "POST") return sendJson(res, 405, { error: { code: "method_not_allowed", message: "Método inválido." } });
      if (action === "start") {
        const body = await readJson(req);
        const method = body.method;
        if (method !== "chatgpt" && method !== "chatgptDeviceCode") {
          return sendJson(res, 400, { error: { code: "invalid_login_method", message: "Método de login inválido." } });
        }
        return sendJson(res, 200, await manager.startLogin(sessionRef, method));
      }
      if (action === "cancel") return sendJson(res, 200, await manager.cancelLogin(sessionRef));
      if (action === "logout") return sendJson(res, 200, await manager.logout(sessionRef));
      return sendJson(res, 404, { error: { code: "not_found", message: "Rota inexistente." } });
    } catch (error) {
      return sendJson(res, 500, { error: { code: "executor_error", message: sanitizeProviderMessage(error) } });
    }
  });
  server.on("close", () => manager.closeAll());
  return server;
}
