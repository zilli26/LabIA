import { afterEach, describe, expect, it, vi } from "vitest";

import { sendExecutorHeartbeat } from "@/lib/provider-connections/heartbeat-client";

const token = "executor-pairing-secret-1234567890-abcdefgh";
const heartbeat = { sequence: 1, executorVersion: "0.5.0", state: "online" as const, connections: [] };

afterEach(() => vi.restoreAllMocks());

describe("executor heartbeat client", () => {
  it("envia uma chamada outbound para o control-plane HTTPS configurado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "online" }), { status: 200 }));
    await sendExecutorHeartbeat(heartbeat, {
      baseUrl: "https://preview.example",
      pairingId: "pairing-1",
      pairingSecret: token,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://preview.example/api/executors/heartbeat");
    expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual(expect.objectContaining({ authorization: `Bearer ${token}` }));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(String(init.body)).not.toContain("127.0.0.1");
    expect(String(init.body)).not.toContain(token);
  });

  it("recusa URL localhost/loopback e não faz chamada", async () => {
    const fetchMock = vi.fn();
    await expect(sendExecutorHeartbeat(heartbeat, {
      baseUrl: "http://127.0.0.1:3000",
      pairingId: "pairing-1",
      pairingSecret: token,
      fetchImpl: fetchMock,
    })).rejects.toMatchObject({ code: "control_plane_url_invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
