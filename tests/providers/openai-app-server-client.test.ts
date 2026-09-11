import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  CodexAppServerClient,
  type CodexProcess,
  type SpawnCodexProcess,
} from "../../lib/providers/openai-codex/app-server-client";

type DataListener = (chunk: Buffer | string) => void;
type ExitListener = (code: number | null, signal: NodeJS.Signals | null) => void;
type ErrorListener = (error: Error) => void;

class FakeStream {
  private listeners: DataListener[] = [];

  on(_event: "data", listener: DataListener) {
    this.listeners.push(listener);
  }

  emit(value: string) {
    for (const listener of this.listeners) listener(value);
  }
}

class FakeCodexProcess implements CodexProcess {
  readonly stdout = new FakeStream();
  readonly stderr = new FakeStream();
  readonly writes: Record<string, unknown>[] = [];
  killed = false;
  suppressAccountRead = false;
  private readonly exitListeners: ExitListener[] = [];
  private readonly errorListeners: ErrorListener[] = [];

  readonly stdin = {
    write: (chunk: string) => {
      const message = JSON.parse(chunk) as Record<string, unknown>;
      this.writes.push(message);
      this.handleWrite(message);
      return true;
    },
    end: () => undefined,
  };

  on(event: "exit", listener: ExitListener): unknown;
  on(event: "error", listener: ErrorListener): unknown;
  on(event: "exit" | "error", listener: ExitListener | ErrorListener) {
    if (event === "exit") {
      this.exitListeners.push(listener as ExitListener);
    } else {
      this.errorListeners.push(listener as ErrorListener);
    }
    return undefined;
  }

  kill() {
    this.killed = true;
    return true;
  }

  notifyLogin(loginId: string, success = true) {
    this.respond({
      method: "account/login/completed",
      params: { loginId, success, error: null },
    });
  }

  emitExit() {
    for (const listener of this.exitListeners) listener(1, null);
  }

  emitError() {
    for (const listener of this.errorListeners) {
      listener(new Error("raw secret-adjacent process error"));
    }
  }

  emitMalformedJson() {
    this.stdout.emit("{not-json}\n");
  }

  private respond(message: Record<string, unknown>) {
    this.stdout.emit(`${JSON.stringify(message)}\n`);
  }

  private handleWrite(message: Record<string, unknown>) {
    const id = message.id;
    const method = message.method;
    if (typeof id !== "number") return;

    if (method === "initialize") {
      this.respond({ id, result: { userAgent: "fake", codexHome: "fake" } });
      return;
    }

    if (method === "account/login/start") {
      const params = message.params as { type?: string };
      if (params.type === "chatgpt") {
        this.respond({
          id,
          result: {
            type: "chatgpt",
            loginId: "login-browser",
            authUrl: "https://chatgpt.com/fake",
          },
        });
      } else {
        this.respond({
          id,
          result: {
            type: "chatgptDeviceCode",
            loginId: "login-device",
            verificationUrl: "https://auth.openai.com/codex/device",
            userCode: "ABCD-1234",
          },
        });
      }
      return;
    }

    if (method === "account/read") {
      if (!this.suppressAccountRead) {
        this.respond({ id, result: { account: null, requiresOpenaiAuth: true } });
      }
      return;
    }

    if (method === "account/login/cancel" || method === "account/logout") {
      this.respond({ id, result: {} });
    }
  }
}

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function makeClient(fake = new FakeCodexProcess()) {
  const root = await mkdtemp(join(tmpdir(), "labia-o1-"));
  tempDirs.push(root);
  const client = new CodexAppServerClient({
    credentialRef: "codex-abcdef123456",
    spawnProcess: () => fake,
    env: { LABIA_PROVIDER_DATA_DIR: root },
    requestTimeoutMs: 50,
  });
  await client.start();
  return { client, fake, root };
}

describe("CodexAppServerClient", () => {
  it("initializes over JSONL and isolates CODEX_HOME from current Codex/API credentials", async () => {
    const root = await mkdtemp(join(tmpdir(), "labia-o1-"));
    tempDirs.push(root);
    const fake = new FakeCodexProcess();
    let capturedCommand = "";
    let capturedArgs: string[] = [];
    let capturedEnv: Record<string, string | undefined> = {};

    const spawnProcess: SpawnCodexProcess = (command, args, options) => {
      capturedCommand = command;
      capturedArgs = args;
      capturedEnv = options.env;
      return fake;
    };

    const client = new CodexAppServerClient({
      credentialRef: "codex-123456789abc",
      spawnProcess,
      env: {
        PATH: process.env.PATH,
        LABIA_CODEX_BIN: "codex-test",
        LABIA_PROVIDER_DATA_DIR: root,
        CODEX_HOME: join(root, "existing-codex"),
        OPENAI_API_KEY: "must-not-leak",
        CODEX_API_KEY: "must-not-leak-either",
      },
    });

    await client.start();

    expect(capturedCommand).toBe("codex-test");
    expect(capturedArgs).toEqual(["app-server"]);
    expect(capturedEnv.CODEX_HOME).toContain("codex-123456789abc");
    expect(capturedEnv.CODEX_HOME).not.toContain("existing-codex");
    expect(capturedEnv.OPENAI_API_KEY).toBeUndefined();
    expect(capturedEnv.CODEX_API_KEY).toBeUndefined();
    expect(fake.writes[0]).toMatchObject({ method: "initialize" });
    expect(fake.writes[0]).not.toHaveProperty("jsonrpc");
    expect(fake.writes[1]).toEqual({ method: "initialized" });

    client.close();
  });

  it("supports browser and device-code login without generation", async () => {
    const { client, fake } = await makeClient();

    await expect(client.startLogin("chatgpt")).resolves.toMatchObject({
      type: "chatgpt",
      loginId: "login-browser",
      authUrl: "https://chatgpt.com/fake",
    });

    const login = await client.startLogin("chatgptDeviceCode");
    expect(login).toMatchObject({
      type: "chatgptDeviceCode",
      loginId: "login-device",
      userCode: "ABCD-1234",
    });

    const completionPromise = client.waitForLogin("login-device", 500);
    fake.notifyLogin("other-login", true);
    fake.notifyLogin("login-device", true);
    await expect(completionPromise).resolves.toMatchObject({
      loginId: "login-device",
      success: true,
    });

    await client.cancelLogin("login-device");
    await client.logout();

    expect(fake.writes.map((message) => message.method)).toContain(
      "account/login/cancel",
    );
    expect(fake.writes.map((message) => message.method)).toContain(
      "account/logout",
    );
    expect(fake.writes.map((message) => message.method)).not.toContain(
      "thread/start",
    );
    expect(fake.writes.map((message) => message.method)).not.toContain(
      "turn/start",
    );

    client.close();
  });

  it("times out a login wait without exposing provider payloads", async () => {
    const { client } = await makeClient();
    await expect(client.waitForLogin("never", 5)).rejects.toThrow(
      "did not complete",
    );
    client.close();
  });

  it("rejects a pending request when the App Server exits", async () => {
    const { client, fake } = await makeClient();
    fake.suppressAccountRead = true;
    const pending = client.readAccount(false);
    fake.emitExit();
    await expect(pending).rejects.toThrow("became unavailable");
  });

  it("sanitizes process errors and malformed JSON", async () => {
    const first = await makeClient();
    first.fake.suppressAccountRead = true;
    const pendingError = first.client.readAccount(false);
    first.fake.emitError();
    await expect(pendingError).rejects.toThrow("became unavailable");
    await expect(pendingError).rejects.not.toThrow("secret-adjacent");

    const second = await makeClient();
    second.fake.suppressAccountRead = true;
    const pendingJson = second.client.readAccount(false);
    second.fake.emitMalformedJson();
    await expect(pendingJson).rejects.toThrow("became unavailable");
  });
});
