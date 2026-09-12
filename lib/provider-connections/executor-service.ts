import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { CodexAppServerClient, resolveCodexHomeRoot, type CodexProcessFactory } from "./codex-app-server";
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

type SessionState = {
  client: CodexAppServerClient;
  attempt: LoginAttempt | null;
  cancellation: Promise<ExecutorAccountStatus> | null;
};
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
    let session = this.getOrCreateSession(sessionRef);
    if (session.cancellation) {
      await session.cancellation;
      session = this.getOrCreateSession(sessionRef);
    }
    await this.expireAttemptIfNeeded(session);
    if (session.attempt && !session.attempt.terminalStatus) {
      await session.client.cancelLogin(session.attempt.loginId).catch(() => undefined);
    }

    // Uma conta antiga persistida no CODEX_HOME nunca pode satisfazer a nova tentativa.
    const cached = accountSnapshot(await session.client.readAccount());
    if (cached.connected) {
      await session.client.logout();
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

  async status(sessionRef: string, expectedLoginId?: string | null): Promise<ExecutorAccountStatus> {
    const session = this.getOrCreateSession(sessionRef);
    await this.expireAttemptIfNeeded(session);
    try {
      if (expectedLoginId === null) {
        return this.loginAttemptNotActiveStatus("login_attempt_missing");
      }

      if (session.attempt?.terminalStatus === "cancelled") {
        return this.cancelledStatus();
      }

      const response = await session.client.readAccount();
      await this.expireAttemptIfNeeded(session);
      const snapshot = accountSnapshot(response);
      const attempt = session.attempt;

      if (expectedLoginId && (!attempt || attempt.loginId !== expectedLoginId)) {
        return {
          authStatus: "error",
          executorStatus: "online",
          accountLabel: null,
          planType: null,
          loginExpiresAt: null,
          errorCode: "login_attempt_not_active",
          errorMessage: "A tentativa de login atual não está mais ativa no executor. Inicie a conexão novamente.",
        };
      }

      const completion = attempt ? session.client.getLoginCompletion(attempt.loginId) : null;
      let authStatus: ProviderConnectionStatus;
      let errorMessage: string | null = null;
      let errorCode: string | null = null;

      if (attempt && !attempt.terminalStatus) {
        if (!completion) {
          authStatus = "connecting";
        } else if (!completion.success) {
          attempt.terminalStatus = "failed";
          authStatus = "error";
          errorCode = "login_failed";
          errorMessage = completion.error ? sanitizeProviderMessage(completion.error) : "O login atual falhou.";
        } else if (!snapshot.connected) {
          // O evento da tentativa atual chegou, mas account/read ainda não refletiu a conta.
          authStatus = "connecting";
        } else {
          authStatus = "connected";
          session.attempt = null;
        }
      } else if (attempt?.terminalStatus === "expired") {
        authStatus = "expired";
      } else if (attempt?.terminalStatus === "failed") {
        authStatus = "error";
        errorCode = "login_failed";
      } else {
        authStatus = snapshot.connected ? "connected" : "disconnected";
      }

      return {
        authStatus,
        executorStatus: "online",
        accountLabel: authStatus === "connected" ? snapshot.accountLabel : null,
        planType: authStatus === "connected" ? snapshot.planType : null,
        loginExpiresAt: session.attempt && !session.attempt.terminalStatus
          ? new Date(session.attempt.expiresAt).toISOString()
          : null,
        errorCode,
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
    if (session.cancellation) return session.cancellation;

    session.cancellation = (async () => {
      await this.expireAttemptIfNeeded(session);
      if (session.attempt && !session.attempt.terminalStatus) {
        session.attempt.terminalStatus = "cancelled";
        await session.client.cancelLogin(session.attempt.loginId).catch(() => undefined);
      }

      let remoteLogoutError: unknown = null;
      try {
        await session.client.logout();
      } catch (error) {
        remoteLogoutError = error;
      } finally {
        session.client.close();
        await session.client.clearDedicatedHome();
        this.sessions.delete(sessionRef);
      }

      return {
        authStatus: "disconnected",
        executorStatus: "online",
        accountLabel: null,
        planType: null,
        loginExpiresAt: null,
        errorCode: remoteLogoutError ? "remote_logout_unconfirmed" : null,
        errorMessage: remoteLogoutError ? sanitizeProviderMessage(remoteLogoutError) : null,
      } satisfies ExecutorAccountStatus;
    })();

    return session.cancellation;
  }

  async logout(sessionRef: string) {
    const session = this.getOrCreateSession(sessionRef);
    let remoteLogoutError: unknown = null;
    try {
      if (session.attempt && !session.attempt.terminalStatus) {
        await session.client.cancelLogin(session.attempt.loginId).catch(() => undefined);
      }
      await session.client.logout();
    } catch (error) {
      remoteLogoutError = error;
    } finally {
      session.attempt = null;
      session.client.close();
      this.sessions.delete(sessionRef);
    }

    // Mesmo se a revogação remota falhar, o LabIA não mantém uma credencial reutilizável localmente.
    await session.client.clearDedicatedHome();

    return {
      authStatus: "disconnected",
      executorStatus: "online",
      accountLabel: null,
      planType: null,
      loginExpiresAt: null,
      errorCode: remoteLogoutError ? "remote_logout_unconfirmed" : null,
      errorMessage: remoteLogoutError
        ? `Credencial local removida; logout remoto não confirmado: ${sanitizeProviderMessage(remoteLogoutError)}`
        : null,
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
      codexVersion: process.env.LABIA_CODEX_VERSION,
      processFactory: this.options.processFactory,
    });
    const session = { client, attempt: null, cancellation: null } satisfies SessionState;
    this.sessions.set(sessionRef, session);
    return session;
  }

  private async expireAttemptIfNeeded(session: SessionState) {
    if (!session.attempt || session.attempt.terminalStatus || this.now() < session.attempt.expiresAt) return;
    await session.client.cancelLogin(session.attempt.loginId).catch(() => undefined);
    session.attempt.terminalStatus = "expired";
  }

  private loginAttemptNotActiveStatus(errorCode: "login_attempt_missing") {
    return {
      authStatus: "error",
      executorStatus: "online",
      accountLabel: null,
      planType: null,
      loginExpiresAt: null,
      errorCode,
      errorMessage: "A tentativa de login atual estÃ¡ ausente. Inicie a conexÃ£o novamente.",
    } satisfies ExecutorAccountStatus;
  }

  private cancelledStatus() {
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
    codexHomeRoot: resolveCodexHomeRoot(process.env.LABIA_CODEX_HOME_ROOT),
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
      if (action === "status" && req.method === "GET") {
        const expectedLoginId = url.searchParams.has("expectedLoginId")
          ? (url.searchParams.get("expectedLoginId") || null)
          : undefined;
        if (expectedLoginId && expectedLoginId.length > 256) {
          return sendJson(res, 400, { error: { code: "invalid_login_id", message: "loginId inválido." } });
        }
        return sendJson(res, 200, await manager.status(sessionRef, expectedLoginId));
      }
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
