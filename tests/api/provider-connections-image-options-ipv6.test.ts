import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOwnedProviderConnections: vi.fn(),
  assertLocalConnectionsRequest: vi.fn(),
  readRemoteExecutorImageOptions: vi.fn(),
}));

vi.mock("@/lib/provider-connections/store", () => ({
  listOwnedProviderConnections: mocks.listOwnedProviderConnections,
  getOwnedProviderConnection: vi.fn(),
}));
vi.mock("@/lib/provider-connections/executor-client", () => ({ readExecutorImageOptions: vi.fn() }));
vi.mock("@/lib/provider-connections/remote-image-options", () => ({ readRemoteExecutorImageOptions: mocks.readRemoteExecutorImageOptions }));
vi.mock("@/lib/provider-connections/security", () => ({
  assertLocalConnectionsRequest: mocks.assertLocalConnectionsRequest,
  LocalConnectionsError: class LocalConnectionsError extends Error {},
  noStoreJson: (body: unknown, init: ResponseInit = {}) => Response.json(body, init),
  sanitizeProviderMessage: () => "safe error",
}));

import { GET } from "@/app/api/provider-connections/image-options/route";

describe("image options IPv6 loopback regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["[::1]", "::1"])("keeps %s local", async (host) => {
    mocks.listOwnedProviderConnections.mockResolvedValue([]);

    const response = await GET(new Request("http://[::1]/api/provider-connections/image-options", {
      headers: { host, "x-forwarded-host": host },
    }));

    expect(response.status).toBe(200);
    expect(mocks.assertLocalConnectionsRequest).toHaveBeenCalledOnce();
    expect(mocks.readRemoteExecutorImageOptions).not.toHaveBeenCalled();
  });
});
