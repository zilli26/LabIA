import { EventEmitter } from "node:events";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { CodexAppServerClient, HOMOLOGATED_CODEX_VERSION, resolveCodexHomeRoot, resolveCodexVersion, type CodexProcessFactory } from "@/lib/provider-connections/codex-app-server";
import { ProviderExecutorManager } from "@/lib/provider-connections/executor-service";

function fakeProcessFactory(options?: { initiallyConnected?: boolean; userAgentVersion?: string; skipInitialize?: boolean }) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const emitter = new EventEmitter();
  const requests: Record<string, unknown>[] = [];
  let capturedEnv: NodeJS.ProcessEnv | null = null;
  let connected = options?.initiallyConnected === true;
  let killCount = 0;

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
          if (method === "initialize" && !options?.skipInitialize) {
            stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result: { userAgent: `codex_cli_rs/${options?.userAgentVersion ?? HOMOLOGATED_CODEX_VERSION} windows-msvc x86_64` } })}\n`);
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
      kill: () => {
        killCount += 1;
        return true;
      },
      once: emitter.once.bind(emitter),
    } as unknown as ReturnType<CodexProcessFactory>;
  };

  return {
    factory,
    stdout,
    requests,
    setConnected(value: boolean) { connected = value; },
    get env() { return capturedEnv; },
    get killCount() { return killCount; },
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
    process.env.LABIA_TEST_SECRET = "must-not-reach-child";
    const client = new CodexAppServerClient({
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174000",
      codexHomeRoot: root,
      processFactory: fake.factory,
    });
    try {
      const login = await client.startLogin("chatgptDeviceCode");
      expect(login).toMatchObject({ type: "chatgptDeviceCode", loginId: "login-1", userCode: "ABCD-1234" });
      expect(fake.requests.map((item) => item.method)).toEqual(["initialize", "initialized", "account/login/start"]);
      expect((fake.requests[0]?.params as { clientInfo: { version: string } }).clientInfo.version).toBe(HOMOLOGATED_CODEX_VERSION);
      expect(fake.env?.OPENAI_API_KEY).toBeUndefined();
      expect(fake.env?.LABIA_TEST_SECRET).toBeUndefined();
      expect(Object.keys(fake.env ?? {}).every((key) => ["PATH", "Path", "PATHEXT", "SystemRoot", "ComSpec", "TEMP", "TMP", "TMPDIR", "LANG", "LC_ALL", "CODEX_HOME"].includes(key))).toBe(true);
      expect(fake.env?.CODEX_HOME).toContain("123e4567-e89b-42d3-a456-426614174000");
      const config = await readFile(path.join(fake.env?.CODEX_HOME ?? "", "config.toml"), "utf8");
      expect(config).toContain('cli_auth_credentials_store = "file"');
    } finally {
      client.close();
      if (oldApiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = oldApiKey;
      delete process.env.LABIA_TEST_SECRET;
    }
  });

  it("exige o userAgent da versão homologada e permite override explícito", async () => {
    expect(resolveCodexVersion()).toBe(HOMOLOGATED_CODEX_VERSION);
    expect(() => resolveCodexVersion("0.154")).toThrow(/semver/i);
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const fake = fakeProcessFactory({ userAgentVersion: "0.153.4" });
    const client = new CodexAppServerClient({
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174009",
      codexHomeRoot: root,
      codexVersion: "0.153.4",
      processFactory: fake.factory,
    });
    await client.start();
    expect((fake.requests[0]?.params as { clientInfo: { version: string } }).clientInfo.version).toBe("0.153.4");
    client.close();

    const mismatched = fakeProcessFactory({ userAgentVersion: "0.153.4" });
    const mismatchedHome = path.join(root, "123e4567-e89b-42d3-a456-426614174010");
    const mismatchedCredential = path.join(mismatchedHome, "credentials.json");
    await mkdir(mismatchedHome, { recursive: true });
    await writeFile(mismatchedCredential, "opaque-fixture-credential", "utf8");
    const rejected = new CodexAppServerClient({
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174010",
      codexHomeRoot: root,
      processFactory: mismatched.factory,
    });
    await expect(rejected.start()).rejects.toThrow(/userAgent/i);
    expect(mismatched.killCount).toBe(1);
    await expect(access(mismatchedCredential)).resolves.toBeUndefined();
  });

  it("encerra o App Server e preserva o CODEX_HOME em timeout do initialize", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const fake = fakeProcessFactory({ skipInitialize: true });
    const home = path.join(root, "123e4567-e89b-42d3-a456-426614174011");
    const credential = path.join(home, "credentials.json");
    await mkdir(home, { recursive: true });
    await writeFile(credential, "opaque-fixture-credential", "utf8");
    const client = new CodexAppServerClient({
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174011",
      codexHomeRoot: root,
      requestTimeoutMs: 10,
      processFactory: fake.factory,
    });

    await expect(client.start()).rejects.toThrow(/Timeout/i);
    expect(fake.killCount).toBe(1);
    await expect(access(credential)).resolves.toBeUndefined();
  });

  it("exige CODEX_HOME absoluto e fora do cwd do repositorio", () => {
    expect(() => resolveCodexHomeRoot(".labia/codex")).toThrow(/absoluto/i);
    expect(() => resolveCodexHomeRoot(path.join(process.cwd(), "outside-secret"))).toThrow(/fora do repositorio/i);
    expect(resolveCodexHomeRoot(path.join(os.tmpdir(), "labia-codex-root"))).toBe(path.resolve(os.tmpdir(), "labia-codex-root"));
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

    await expect(manager.startLogin(sessionRef, "chatgptDeviceCode")).rejects.toMatchObject({ code: "account_already_connected" });
    expect(fake.requests.map((item) => item.method)).not.toContain("account/logout");
    expect(fake.requests.map((item) => item.method)).not.toContain("account/login/start");
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
    const status = await restartedManager.status(sessionRef, "login-1", new Date(60_000).toISOString());
    expect(status.authStatus).toBe("connected");
    expect(restartedFake.requests.map((item) => item.method)).toContain("account/read");
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

  it("rejects a connecting status without a login id before reading a cached account", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const fake = fakeProcessFactory({ initiallyConnected: true });
    const manager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: fake.factory });
    const sessionRef = "labia-codex:123e4567-e89b-42d3-a456-426614174006";

    const status = await manager.status(sessionRef, null);

    expect(status.authStatus).toBe("connected");
    expect(status.errorCode).toBeNull();
    expect(fake.requests.map((item) => item.method)).toContain("account/read");
    manager.closeAll();
  });

  it("reidrata tentativa pendente por loginId e loginExpiresAt server-side apos restart", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const sessionRef = "labia-codex:123e4567-e89b-42d3-a456-426614174012";
    const firstFake = fakeProcessFactory();
    const firstManager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: firstFake.factory });
    await firstManager.startLogin(sessionRef, "chatgptDeviceCode");
    firstManager.closeAll();

    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const restartedFake = fakeProcessFactory();
    const restartedManager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: restartedFake.factory });
    const pending = await restartedManager.status(sessionRef, "login-1", expiresAt);
    expect(pending.authStatus).toBe("connecting");
    expect(pending.loginExpiresAt).toBe(expiresAt);

    restartedFake.setConnected(true);
    const connected = await restartedManager.status(sessionRef, "login-1", expiresAt);
    expect(connected.authStatus).toBe("connected");
    restartedManager.closeAll();
  });

  it("mantém login expirado terminal diante de resultado tardio e conta conectada", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const fake = fakeProcessFactory();
    let now = 1_000;
    const manager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: fake.factory, loginTtlMs: 1_000, now: () => now });
    const sessionRef = "labia-codex:123e4567-e89b-42d3-a456-426614174008";

    await manager.startLogin(sessionRef, "chatgptDeviceCode");
    now = 2_001;
    fake.setConnected(true);
    fake.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", method: "account/login/completed", params: { loginId: "login-1", success: true, error: null } })}\n`);
    await new Promise((resolve) => setImmediate(resolve));

    const status = await manager.status(sessionRef, "login-1");
    expect(status.authStatus).toBe("expired");
    expect(status.authStatus).not.toBe("connected");
    manager.closeAll();
  });

  it("keeps cancellation terminal through a late completion and concurrent cancellation", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-test-"));
    tempDirs.push(root);
    const fake = fakeProcessFactory();
    const manager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: fake.factory });
    const sessionRef = "labia-codex:123e4567-e89b-42d3-a456-426614174007";
    const home = path.join(root, "123e4567-e89b-42d3-a456-426614174007");

    await manager.startLogin(sessionRef, "chatgptDeviceCode");
    const [firstCancel, concurrentCancel] = await Promise.all([
      manager.cancelLogin(sessionRef),
      manager.cancelLogin(sessionRef),
    ]);
    fake.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", method: "account/login/completed", params: { loginId: "login-1", success: true, error: null } })}\n`);
    await new Promise((resolve) => setImmediate(resolve));

    expect(firstCancel.authStatus).toBe("disconnected");
    expect(concurrentCancel.authStatus).toBe("disconnected");
    expect(fake.requests.filter((item) => item.method === "account/login/cancel")).toHaveLength(1);
    expect(fake.requests.filter((item) => item.method === "account/logout")).toHaveLength(1);
    await expect(access(home)).rejects.toThrow();

    const lateStatus = await manager.status(sessionRef, "login-1");
    expect(lateStatus.authStatus).toBe("error");
    expect(lateStatus.errorCode).toBe("login_attempt_not_active");
    manager.closeAll();
  });
});
