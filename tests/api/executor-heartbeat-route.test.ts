import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateExecutorPairing: vi.fn(),
  recordExecutorHeartbeat: vi.fn(),
  getExecutorPairingStatus: vi.fn(),
}));

function sanitizeMockStatus(status: Record<string, unknown>, secrets: readonly string[] = []) {
  const sanitize = (value: string) => {
    let result = value;
    for (const secret of secrets) result = result.split(secret).join("[redacted]");
    return result.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
      .replace(/\bsk-[A-Za-z0-9_-]{10,}\b/g, "[redacted]")
      .replace(/\b(token|cookie)\s*[:=]\s*[^\s,;}]+/gi, "$1=[redacted]");
  };
  return JSON.parse(JSON.stringify(status, (_key, value) => typeof value === "string" ? sanitize(value) : value));
}

vi.mock("@/lib/provider-connections/pairing", () => ({
  authenticateExecutorPairing: mocks.authenticateExecutorPairing,
  recordExecutorHeartbeat: mocks.recordExecutorHeartbeat,
  getExecutorPairingStatus: mocks.getExecutorPairingStatus,
  sanitizeExecutorPairingStatus: sanitizeMockStatus,
  ExecutorPairingError: class ExecutorPairingError extends Error {
    constructor(public readonly code: string, message: string, public readonly status: number) {
      super(message);
    }
  },
}));

import { POST } from "@/app/api/executors/heartbeat/route";
import { GET } from "@/app/api/executors/[pairingId]/route";

const token = "executor-pairing-secret-1234567890-abcdefgh";
const requestBody = {
  sequence: 1,
  executorVersion: "0.5.0",
  state: "online",
  connections: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticateExecutorPairing.mockResolvedValue(undefined);
});

describe("executor control-plane routes", () => {
  it("autentica heartbeat pelo segredo e não expõe o segredo na resposta", async () => {
    mocks.recordExecutorHeartbeat.mockResolvedValue({
      pairingId: "pairing-1",
      label: "Executor Felipe",
      status: "online",
      executorVersion: "0.5.0",
      lastSeenAt: "2026-09-13T10:01:00.000Z",
      snapshot: requestBody,
    });

    const response = await POST(new Request("https://preview.example/api/executors/heartbeat", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-labia-executor-pairing-id": "pairing-1",
      },
      body: JSON.stringify(requestBody),
    }));

    expect(response.status).toBe(200);
    expect(mocks.recordExecutorHeartbeat).toHaveBeenCalledWith(expect.objectContaining({
      pairingId: "pairing-1",
      secret: token,
      heartbeat: requestBody,
    }));
    expect(JSON.stringify(await response.json())).not.toContain(token);
  });

  it("recusa token ausente ou errado antes de persistir", async () => {
    mocks.authenticateExecutorPairing.mockRejectedValue({ code: "unauthorized", message: "Nao autorizado.", status: 401 });
    mocks.recordExecutorHeartbeat.mockRejectedValue({ code: "unauthorized", message: "Não autorizado.", status: 401 });
    const response = await POST(new Request("https://preview.example/api/executors/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-labia-executor-pairing-id": "pairing-1" },
      body: JSON.stringify(requestBody),
    }));
    expect(response.status).toBe(401);
    expect(mocks.recordExecutorHeartbeat).not.toHaveBeenCalled();
  });

  it("retorna 401 antes de interpretar JSON malformado para anonimo", async () => {
    mocks.authenticateExecutorPairing.mockRejectedValue({ code: "unauthorized", message: "Nao autorizado.", status: 401 });
    const response = await POST(new Request("https://preview.example/api/executors/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-labia-executor-pairing-id": "pairing-1" },
      body: "{malformed",
    }));
    expect(response.status).toBe(401);
    expect(mocks.recordExecutorHeartbeat).not.toHaveBeenCalled();
  });

  it("rejeita body maior que o limite depois da autenticacao", async () => {
    const response = await POST(new Request("https://preview.example/api/executors/heartbeat", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "content-length": "20000",
        "x-labia-executor-pairing-id": "pairing-1",
      },
      body: JSON.stringify({ sequence: 1, payload: "x".repeat(20_000) }),
    }));
    expect(response.status).toBe(413);
    expect(mocks.recordExecutorHeartbeat).not.toHaveBeenCalled();
  });

  it("permite à Vercel ler o snapshot sem chamar localhost", async () => {
    mocks.getExecutorPairingStatus.mockResolvedValue({
      pairingId: "pairing-1",
      label: "Executor Felipe",
      status: "offline",
      executorVersion: "0.5.0",
      lastSeenAt: "2026-09-13T09:58:00.000Z",
      snapshot: requestBody,
    });

    const response = await GET(
      new Request("https://preview.example/api/executors/pairing-1", {
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ pairingId: "pairing-1" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.getExecutorPairingStatus).toHaveBeenCalledWith({ pairingId: "pairing-1", secret: token });
    expect(JSON.stringify(await response.json())).not.toContain("127.0.0.1");
  });

  it("redige credenciais em snapshot antes de responder", async () => {
    mocks.recordExecutorHeartbeat.mockResolvedValue({
      pairingId: "pairing-1",
      label: "Executor Felipe",
      status: "online",
      executorVersion: "0.5.0",
      lastSeenAt: "2026-09-13T10:01:00.000Z",
      snapshot: {
        ...requestBody,
        connections: [{
          connectionId: "connection-a",
          provider: "openai",
          authStatus: "connected",
          executorStatus: "online",
          capabilities: [{ key: "image_generation", status: "available", evidence: `Bearer ${token} sk-1234567890 token=${token} Cookie: sid=${token}` }],
          models: [],
        }],
      },
    });
    const response = await POST(new Request("https://preview.example/api/executors/heartbeat", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-labia-executor-pairing-id": "pairing-1",
      },
      body: JSON.stringify(requestBody),
    }));
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain(token);
    expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._~+/=-]+/i);
    expect(serialized).not.toMatch(/sk-[A-Za-z0-9_-]{10,}/);
    expect(serialized).toContain("token=[redacted]");
    expect(serialized).toContain("Cookie=[redacted]");
  });
});
