import { EventEmitter } from "node:events";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { CodexAppServerClient, type CodexProcessFactory } from "@/lib/provider-connections/codex-app-server";
import { ProviderExecutorManager } from "@/lib/provider-connections/executor-service";

function fakeProcessFactory(options?: { initiallyConnected?: boolean }) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const emitter = new EventEmitter();
  const requests: Record<string, unknown>[] = [];
  let capturedEnv: NodeJS.ProcessEnv | null = null;
  let connected = options?.initiallyConnected === true;

  const factory: CodexProcessFactory = ({ env }) => {
    capturedEnv = env;
    const stdin = new Writable({
      write(chunk, _encoding, callback) {
        const lines = chunk.toString().trim().split("\n").filter(Boolean);
        for (const line of lines) {
          const message = JSON.parse(line) as Record<string, unknown>;
          requests.push(message);
          const id = message.id;
          const method = message.method;
          if (typeof id !== "number") continue;
          if (method === "initialize") {
            stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: { userAgent: "fake/0.153.4" } })}\n`);
          } else if (method === "account/login/start") {
            stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: { type: "chatgptDeviceCode", loginId: "login-1", verificationUrl: "https://auth.openai.com/codex/device", userCode: "ABCD-1234" } })}\n`);
          } else if (method === "account/read") {
            stdout.write(`${JSON.stringify({
              jsonrpc: "2.0",
              id,
              result: connected
                ? { account: { type: "chatgpt", email: "cached@example.test", planType: "plus" }, requiresOpenaiAuth: true }
                : { account: null, requiresOpenaiAuth: true },
            })}\n`);
          } else if (method === "account/login/cancel") {
            stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: {} })}\n`);
          } else if (method === "account/logout") {
            connected = false;
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
    setConnected(value: boolean) { connected = value; },
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
    const status = await manager.status(sessionRef, "login-1");
    expect(status.authStatus).toBe("expired");
    expect(fake.requests.map((item) => item.method)).toContain("account/login/cancel");
    expect(fake.requests.map((item) => item.method).some((method) => String(method).includes("generate"))).toBe(false);
    manager.closeAll();
  });

  it("não aceita conta antiga em cache como conclusão da tentativa atual", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const fake = fakeProcessFactory({ initiallyConnected: true });
    const manager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: fake.factory });
    const sessionRef = "labia-codex:123e4567-e89b-42d3-a456-426614174003";

    await manager.startLogin(sessionRef, "chatgptDeviceCode");
    expect(fake.requests.map((item) => item.method)).toContain("account/logout");

    fake.setConnected(true);
    const beforeCompletion = await manager.status(sessionRef, "login-1");
    expect(beforeCompletion.authStatus).toBe("connecting");

    fake.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", method: "account/login/completed", params: { loginId: "login-old", success: true, error: null } })}\n`);
    await new Promise((resolve) => setImmediate(resolve));
    expect((await manager.status(sessionRef, "login-1")).authStatus).toBe("connecting");

    fake.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", method: "account/login/completed", params: { loginId: "login-1", success: true, error: null } })}\n`);
    await new Promise((resolve) => setImmediate(resolve));
    expect((await manager.status(sessionRef, "login-1")).authStatus).toBe("connected");
    manager.closeAll();
  });

  it("não aceita conta em cache se a tentativa esperada se perdeu após restart do executor", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const sessionRef = "labia-codex:123e4567-e89b-42d3-a456-426614174004";
    const firstFake = fakeProcessFactory();
    const firstManager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: firstFake.factory });
    await firstManager.startLogin(sessionRef, "chatgptDeviceCode");
    firstManager.closeAll();

    const restartedFake = fakeProcessFactory({ initiallyConnected: true });
    const restartedManager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: restartedFake.factory });
    const status = await restartedManager.status(sessionRef, "login-1");
    expect(status.authStatus).toBe("error");
    expect(status.errorCode).toBe("login_attempt_not_active");
    restartedManager.closeAll();
  });

  it("logout em manager reiniciado remove o CODEX_HOME dedicado", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const sessionRef = "labia-codex:123e4567-e89b-42d3-a456-426614174005";
    const home = path.join(root, "123e4567-e89b-42d3-a456-426614174005");
    await mkdir(home, { recursive: true });
    await writeFile(path.join(home, "auth.json"), "secret-session", "utf8");

    const fake = fakeProcessFactory({ initiallyConnected: true });
    const manager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: fake.factory });
    const status = await manager.logout(sessionRef);

    expect(status.authStatus).toBe("disconnected");
    await expect(access(home)).rejects.toThrow();
    expect(fake.requests.map((item) => item.method)).toContain("account/logout");
  });
});
