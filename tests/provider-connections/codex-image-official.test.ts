import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import {
  CodexAppServerClient,
  HOMOLOGATED_CODEX_VERSION,
  type CodexProcessFactory,
} from "@/lib/provider-connections/codex-app-server";
import { ProviderExecutorManager } from "@/lib/provider-connections/executor-service";
import { deriveExecutorHeartbeatState } from "@/lib/provider-connections/heartbeat";

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);

function officialFixtureProcess(options: { recover?: boolean; emitDuringRecovery?: boolean; capabilities?: Record<string, unknown>; account?: Record<string, unknown>; model?: Record<string, unknown> } = {}) {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const emitter = new EventEmitter();
  const requests: Record<string, unknown>[] = [];
  const threadId = "thread-official-1";
  const turnId = "turn-official-1";
  const item = {
    type: "imageGeneration",
    id: "image-item-1",
    status: "completed",
    result: PNG.toString("base64"),
    savedPath: null,
    revisedPrompt: "fixture prompt",
    transparentBackground: false,
    failure: null,
  } as const;
  const respond = (id: number, result: unknown) => stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);

  const factory: CodexProcessFactory = ({ env }) => {
    const stdin = new Writable({
      write(chunk, _encoding, callback) {
        for (const line of chunk.toString().trim().split("\n").filter(Boolean)) {
          const message = JSON.parse(line) as Record<string, unknown>;
          requests.push(message);
          if (typeof message.id !== "number") continue;
          switch (message.method) {
            case "initialize":
              respond(message.id, { userAgent: `codex_cli_rs/${HOMOLOGATED_CODEX_VERSION} windows-msvc x86_64` });
              break;
            case "account/read":
              respond(message.id, options.account ?? { account: { type: "chatgpt", planType: "plus" }, requiresOpenaiAuth: true });
              break;
            case "modelProvider/capabilities/read":
              respond(message.id, options.capabilities ?? { imageGeneration: true, namespaceTools: true, webSearch: false });
              break;
            case "model/list":
              respond(message.id, { data: [options.model ?? { id: "gpt-5.5", inputModalities: ["text", "image"] }] });
              break;
            case "thread/start":
              respond(message.id, { thread: { id: threadId } });
              break;
            case "turn/start":
              respond(message.id, { turn: { id: turnId } });
              if (!options.recover) {
                queueMicrotask(() => stdout.write(`${JSON.stringify({
                  jsonrpc: "2.0",
                  method: "item/completed",
                  params: { threadId, turnId, item },
                })}\n`));
              }
              break;
            case "thread/read":
              if (options.emitDuringRecovery) {
                queueMicrotask(() => stdout.write(`${JSON.stringify({ jsonrpc: "2.0", method: "item/completed", params: { threadId, turnId, item } })}\n`));
                setTimeout(() => respond(message.id as number, { thread: { id: threadId, turns: [] } }), 10);
              } else {
                respond(message.id, { thread: { id: threadId, turns: [{ id: turnId, items: [item] }] } });
              }
              break;
            case "thread/items/list":
              respond(message.id, { data: options.emitDuringRecovery ? [] : [{ item, turnId }], nextCursor: null, backwardsCursor: null });
              break;
            default:
              respond(message.id, {});
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
      env,
    } as unknown as ReturnType<CodexProcessFactory>;
  };
  return { factory, requests, item, threadId, turnId };
}

describe("Codex App Server image generation official protocol", () => {
  const roots: string[] = [];
  afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

  it("inicia thread/start + turn/start, recebe item/completed imageGeneration e normaliza PNG", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-image-"));
    roots.push(root);
    const fixture = officialFixtureProcess();
    const client = new CodexAppServerClient({
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174020",
      codexHomeRoot: root,
      processFactory: fixture.factory,
    });

    await client.assertImageGenerationReady("gpt-5.5");
    const handle = await client.startImageGeneration({ model: "gpt-5.5", prompt: "fixture" });
    const result = await client.waitForImageGeneration(handle.id);

    expect(fixture.requests.map((request) => request.method)).toEqual([
      "initialize",
      "initialized",
      "account/read",
      "modelProvider/capabilities/read",
      "model/list",
      "thread/start",
      "turn/start",
    ]);
    expect(result).toMatchObject({ type: "imageGeneration", status: "completed", result: PNG.toString("base64") });
    expect((fixture.requests.find((request) => request.method === "turn/start")?.params as { input: unknown }).input)
      .toEqual([{ type: "text", text: "fixture" }]);
    const asset = await client.normalizeImageResult(result);
    expect(asset).toMatchObject({ contentType: "image/png", fileSize: PNG.length });
    expect(asset.url).toBe(`data:image/png;base64,${PNG.toString("base64")}`);
    client.close();
  });

  it("recupera item persistido por thread/read e thread/items/list sem evento ao vivo", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-image-recovery-"));
    roots.push(root);
    const fixture = officialFixtureProcess({ recover: true });
    const client = new CodexAppServerClient({
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174021",
      codexHomeRoot: root,
      processFactory: fixture.factory,
    });

    const handle = await client.startImageGeneration({ model: "gpt-5.5", prompt: "recovery fixture" });
    await expect(client.waitForImageGeneration(handle.id)).resolves.toMatchObject({
      id: "image-item-1",
      type: "imageGeneration",
      status: "completed",
    });
    expect(fixture.requests.map((request) => request.method)).toContain("thread/read");
    client.close();
  });

  it("não perde item/completed que chega durante a recuperação", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-image-race-"));
    roots.push(root);
    const fixture = officialFixtureProcess({ recover: true, emitDuringRecovery: true });
    const client = new CodexAppServerClient({
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174024",
      codexHomeRoot: root,
      processFactory: fixture.factory,
      requestTimeoutMs: 100,
    });

    const handle = await client.startImageGeneration({ model: "gpt-5.5", prompt: "race fixture" });
    await expect(client.waitForImageGeneration(handle.id)).resolves.toMatchObject({ id: "image-item-1", status: "completed" });
    client.close();
  });

  it("expõe o mesmo contrato pelo executor dedicado sem iniciar worker", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-image-manager-"));
    roots.push(root);
    const fixture = officialFixtureProcess();
    const manager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: fixture.factory });
    const sessionRef = "labia-codex:123e4567-e89b-42d3-a456-426614174023";

    const started = await manager.startImageGeneration(sessionRef, { model: "gpt-5.5", prompt: "manager fixture" });
    const result = await manager.waitForImageGeneration(sessionRef, started.jobId);

    expect(result.asset).toMatchObject({ contentType: "image/png", fileSize: PNG.length });
    expect(fixture.requests.map((request) => request.method)).toContain("thread/start");
    expect(fixture.requests.map((request) => request.method)).toContain("turn/start");
    manager.closeAll();
  });

  it("monta heartbeat com estado real do App Server, capacidades e modelos", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-heartbeat-online-"));
    roots.push(root);
    const fixture = officialFixtureProcess();
    const manager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: fixture.factory });
    const connections = await manager.readHeartbeatConnections([{
      connectionId: "connection-a",
      provider: "openai",
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174025",
    }]);

    expect(connections[0]).toMatchObject({
      authStatus: "connected",
      executorStatus: "online",
      capabilities: [{ key: "image_generation", status: "available" }],
      models: [{ id: "gpt-5.5", kind: "image" }],
    });
    expect(fixture.requests.map((request) => request.method)).toContain("account/read");
    expect(fixture.requests.map((request) => request.method)).toContain("modelProvider/capabilities/read");
    expect(fixture.requests.map((request) => request.method)).toContain("model/list");
    manager.closeAll();
  });

  it("publica desconectado/offline quando a conta ou App Server nao estao disponiveis", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-heartbeat-offline-"));
    roots.push(root);
    const disconnected = officialFixtureProcess({ account: { account: null, requiresOpenaiAuth: true } });
    const manager = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: disconnected.factory });
    const disconnectedConnections = await manager.readHeartbeatConnections([{
      connectionId: "connection-a",
      provider: "openai",
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174026",
    }]);
    expect(disconnectedConnections[0]).toMatchObject({ authStatus: "disconnected", executorStatus: "online", capabilities: [{ status: "unavailable" }], models: [] });

    const brokenFactory: CodexProcessFactory = () => { throw new Error("App Server offline"); };
    const broken = new ProviderExecutorManager({ codexHomeRoot: root, processFactory: brokenFactory });
    const offlineConnections = await broken.readHeartbeatConnections([{
      connectionId: "connection-b",
      provider: "openai",
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174027",
    }]);
    expect(offlineConnections[0]).toMatchObject({ authStatus: "error", executorStatus: "error" });
    expect(deriveExecutorHeartbeatState([])).toBe("offline");
    expect(deriveExecutorHeartbeatState(offlineConnections)).toBe("error");
    manager.closeAll();
    broken.closeAll();
  });

  it("recusa plano Free, capabilities ausentes e modelo sem modalidade image antes de turn/start", async () => {
    const cases = [
      { error: /plan_unavailable/i, options: { account: { account: { type: "chatgpt", planType: "free" }, requiresOpenaiAuth: true } } },
      { error: /feature_unavailable/i, options: { capabilities: { imageGeneration: false, namespaceTools: true } } },
      { error: /namespace_tools_unavailable/i, options: { capabilities: { imageGeneration: true, namespaceTools: false } } },
      { error: /model_unavailable/i, options: { model: { id: "gpt-text", inputModalities: ["text"] } } },
    ];
    for (const entry of cases) {
      const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-image-gate-"));
      roots.push(root);
      const fixture = officialFixtureProcess(entry.options);
      const client = new CodexAppServerClient({
        sessionRef: `labia-codex:123e4567-e89b-42d3-a456-42661417402${cases.indexOf(entry)}`,
        codexHomeRoot: root,
        processFactory: fixture.factory,
      });
      await expect(client.assertImageGenerationReady("gpt-5.5")).rejects.toThrow(entry.error);
      expect(fixture.requests.map((request) => request.method)).not.toContain("turn/start");
      client.close();
    }
  });

  it("aceita savedPath somente dentro do CODEX_HOME dedicado e rejeita MIME/arquivo inválido", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "labia-codex-image-path-"));
    roots.push(root);
    const fixture = officialFixtureProcess();
    const client = new CodexAppServerClient({
      sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174022",
      codexHomeRoot: root,
      processFactory: fixture.factory,
    });
    const home = path.join(root, "123e4567-e89b-42d3-a456-426614174022");
    await client.start();
    const inside = path.join(home, "generated.png");
    await writeFile(inside, PNG);
    await expect(client.normalizeImageResult({ ...fixture.item, savedPath: inside })).resolves.toMatchObject({ fileSize: PNG.length });
    const outside = path.join(root, "outside.png");
    await writeFile(outside, PNG);
    await expect(client.normalizeImageResult({ ...fixture.item, savedPath: outside })).rejects.toThrow(/dedicado|CODEX_HOME/i);
    await expect(client.normalizeImageResult({ ...fixture.item, savedPath: inside, result: Buffer.from("not-png").toString("base64") })).rejects.toThrow(/artefato|PNG|MIME/i);
    await expect(client.normalizeImageResult({ ...fixture.item, savedPath: null, result: "%%%%" })).rejects.toThrow(/base64/i);
    client.close();
  });
});
