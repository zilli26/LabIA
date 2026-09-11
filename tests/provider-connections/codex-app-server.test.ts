import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { CodexAppServerClient, type CodexProcessFactory } from "@/lib/provider-connections/codex-app-server";
import { ProviderExecutorManager } from "@/lib/provider-connections/executor-service";

function fakeProcessFactory(onRequest?: (message: Record<string, unknown>) => void) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const emitter = new EventEmitter();
  const requests: Record<string, unknown>[] = [];
  let capturedEnv: NodeJS.ProcessEnv | null = null;

  const factory: CodexProcessFactory = ({ env }) => {
    capturedEnv = env;
    const stdin = new Writable({
      write(chunk, _encoding, callback) {
        const lines = chunk.toString().trim().split("\n").filter(Boolean);
        for (const line of lines) {
          const message = JSON.parse(line) as Record<string, unknown>;
          requests.push(message);
          onRequest?.(message);
          const id = message.id;
          const method = message.method;
          if (typeof id !== "number") continue;
          if (method === "initialize") {
            stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: { userAgent: "fake/0.153.4" } })}\n`);
          } else if (method === "account/login/start") {
            stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: { type: "chatgptDeviceCode", loginId: "login-1", verificationUrl: "https://auth.openai.com/codex/device", userCode: "ABCD-1234" } })}\n`);
          } else if (method === "account/read") {
            stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: { account: null, requiresOpenaiAuth: true } })}\n`);
          } else if (method === "account/login/cancel" || method === "account/logout") {
            stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: {} })}\n`);
          }
        }
        callback();
      },
    });
    return {
      stdin,
      stdout,
      stderr,
      kill: () => true,
      once: emitter.once.bind(emitter),
    } as unknown as ReturnType<CodexProcessFactory>;
  };

  return {
    factory,
    stdout,
    requests,
    get env() { return capturedEnv; },
  };
}

describe("CodexAppServerClient", () => {
  const tempDirs: string[] = [];
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("faz initialize/initialized, inicia device code e isola CODEX_HOME sem chaves de API", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const fake = fakeProcessFactory();
    const oldApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-should-not-reach-child";
    const client = new CodexAppServerClient({
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174000",
      codexHomeRoot: root,
      processFactory: fake.factory,
    });
    try {
      const login = await client.startLogin("chatgptDeviceCode");
      expect(login).toMatchObject({ type: "chatgptDeviceCode", loginId: "login-1", userCode: "ABCD-1234" });
      expect(fake.requests.map((item) => item.method)).toEqual(["initialize", "initialized", "account/login/start"]);
      expect(fake.env?.OPENAI_API_KEY).toBeUndefined();
      expect(fake.env?.CODEX_HOME).toContain("123e4567-e89b-42d3-a456-426614174000");
      const config = await readFile(path.join(fake.env?.CODEX_HOME ?? "", "config.toml"), "utf8");
      expect(config).toContain('cli_auth_credentials_store = "file"');
    } finally {
      client.close();
      if (oldApiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldApiKey;
    }
  });

  it("captura account/login/completed sem expor token algum", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const fake = fakeProcessFactory();
    const client = new CodexAppServerClient({
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174001",
      codexHomeRoot: root,
      processFactory: fake.factory,
    });
    await client.startLogin("chatgptDeviceCode");
    fake.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", method: "account/login/completed", params: { loginId: "login-1", success: true, error: null } })}\n`);
    await new Promise((resolve) => setImmediate(resolve));
    expect(client.getLoginCompletion("login-1")).toEqual({ loginId: "login-1", success: true, error: null });
    client.close();
  });

  it("expira tentativa no manager e envia cancel sem executar geração", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const fake = fakeProcessFactory();
    let now = 1_000;
    const manager = new ProviderExecutorManager({
      codexHomeRoot: root,
      processFactory: fake.factory,
      loginTtlMs: 1_000,
      now: () => now,
    });
    const sessionRef = "labia-codex:123e4567-e89b-42d3-a456-426614174002";
    await manager.startLogin(sessionRef, "chatgptDeviceCode");
    now = 2_001;
    const status = await manager.status(sessionRef);
    expect(status.authStatus).toBe("expired");
    expect(fake.requests.map((item) => item.method)).toContain("account/login/cancel");
    expect(fake.requests.map((item) => item.method).some((method) => String(method).includes("generate"))).toBe(false);
    manager.closeAll();
  });
});
