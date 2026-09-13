import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertLocalConnectionsRequest: vi.fn(),
  getOwnedProviderConnection: vi.fn(),
  markProviderConnectionAction: vi.fn(),
  markExecutorOffline: vi.fn(),
  startExecutorLogin: vi.fn(),
  logoutExecutorConnection: vi.fn(),
  updateProviderConnectionFromExecutor: vi.fn(),
  clearDedicatedHome: vi.fn(),
}));

vi.mock("@/lib/provider-connections/security", () => ({
  assertLocalConnectionsRequest: mocks.assertLocalConnectionsRequest,
  LocalConnectionsError: class LocalConnectionsError extends Error {},
  noStoreJson(body: unknown, init: ResponseInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Cache-Control", "private, no-store, max-age=0");
    return Response.json(body, { ...init, headers });
  },
  sanitizeProviderMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/db/flows", () => ({ ensureDefaultWorkspace: vi.fn() }));
vi.mock("@/lib/provider-connections/executor-client", () => ({
  startExecutorLogin: mocks.startExecutorLogin,
  logoutExecutorConnection: mocks.logoutExecutorConnection,
}));
vi.mock("@/lib/provider-connections/store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/provider-connections/store")>("@/lib/provider-connections/store");
  return {
    ...actual,
    getOwnedProviderConnection: mocks.getOwnedProviderConnection,
    markProviderConnectionAction: mocks.markProviderConnectionAction,
    markExecutorOffline: mocks.markExecutorOffline,
    updateProviderConnectionFromExecutor: mocks.updateProviderConnectionFromExecutor,
  };
});
vi.mock("@/lib/provider-connections/codex-app-server", () => ({
  CodexAppServerClient: class {
    async clearDedicatedHome() {
      return mocks.clearDedicatedHome();
    }
  },
  resolveCodexHomeRoot: vi.fn(() => "C:/outside-labia-codex"),
}));

import { POST as login } from "@/app/api/provider-connections/[connectionId]/login/route";
import { POST as disconnect } from "@/app/api/provider-connections/[connectionId]/disconnect/route";

const connection = {
  id: "pc-race",
  provider: "openai",
  sessionRef: "labia-codex:123e4567-e89b-42d3-a456-426614174000",
};
const request = () => new Request("http://localhost:3000/api/provider-connections/pc-race/login", {
  method: "POST",
  body: JSON.stringify({ method: "chatgptDeviceCode" }),
});

describe("provider connection route serialization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("keeps login error persistence inside the connection lock", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    mocks.getOwnedProviderConnection.mockResolvedValue(connection);
    mocks.markProviderConnectionAction.mockResolvedValue(connection);
    mocks.markExecutorOffline.mockImplementation(async () => {
      events.push("mark-offline");
      return connection;
    });
    mocks.startExecutorLogin
      .mockImplementationOnce(async () => {
        events.push("start-first");
        await firstGate;
        throw new Error("executor indisponivel");
      })
      .mockImplementationOnce(async () => {
        events.push("start-second");
        return { loginId: "login-2", instruction: { type: "chatgptDeviceCode", verificationUrl: "https://example.test", userCode: "ABCD-1234", expiresAt: "2026-09-12T15:00:00.000Z" } };
      });

    const first = login(request(), { params: Promise.resolve({ connectionId: connection.id }) });
    await vi.waitFor(() => expect(events).toContain("start-first"));
    const second = login(request(), { params: Promise.resolve({ connectionId: connection.id }) });
    await Promise.resolve();
    expect(events).toEqual(["start-first"]);

    releaseFirst();
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.status).toBe(503);
    expect(secondResponse.status).toBe(200);
    expect(events).toEqual(["start-first", "mark-offline", "start-second"]);
  });

  it("keeps disconnect cleanup and fallback persistence inside the lock", async () => {
    const events: string[] = [];
    let releaseCleanup!: () => void;
    const cleanupGate = new Promise<void>((resolve) => { releaseCleanup = resolve; });
    mocks.getOwnedProviderConnection.mockResolvedValue(connection);
    mocks.logoutExecutorConnection
      .mockImplementationOnce(async () => {
        events.push("logout-first");
        throw new Error("logout remoto indisponivel");
      })
      .mockImplementationOnce(async () => {
        events.push("logout-second");
        return { authStatus: "disconnected", executorStatus: "online", accountLabel: null, planType: null, loginExpiresAt: null, errorCode: null, errorMessage: null };
      });
    mocks.clearDedicatedHome.mockImplementation(async () => {
      events.push("cleanup-start");
      await cleanupGate;
    });
    mocks.updateProviderConnectionFromExecutor.mockImplementation(async () => {
      events.push("persist");
      return connection;
    });

    const first = disconnect(request(), { params: Promise.resolve({ connectionId: connection.id }) });
    await vi.waitFor(() => expect(events).toContain("cleanup-start"));
    const second = disconnect(request(), { params: Promise.resolve({ connectionId: connection.id }) });
    await Promise.resolve();
    expect(events).toEqual(["logout-first", "cleanup-start"]);

    releaseCleanup();
    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(events).toEqual(["logout-first", "cleanup-start", "persist", "logout-second", "persist"]);
  });

  it("persists disconnected terminal state when credential cleanup is rejected", async () => {
    const persistedStatuses: unknown[] = [];
    mocks.getOwnedProviderConnection.mockResolvedValue(connection);
    mocks.logoutExecutorConnection.mockRejectedValue(new Error("logout remoto indisponivel"));
    mocks.clearDedicatedHome.mockRejectedValue(new Error("rm negado"));
    mocks.updateProviderConnectionFromExecutor.mockImplementation(async (_id, status) => {
      persistedStatuses.push(status);
      return connection;
    });

    const response = await disconnect(request(), { params: Promise.resolve({ connectionId: connection.id }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(persistedStatuses).toHaveLength(1);
    expect(persistedStatuses[0]).toMatchObject({
      authStatus: "disconnected",
      executorStatus: "offline",
      errorCode: "credential_cleanup_failed",
    });
    expect(body).toMatchObject({ connection, warning: expect.stringContaining("rm negado") });
  });
});
