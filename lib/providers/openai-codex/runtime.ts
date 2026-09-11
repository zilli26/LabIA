import "server-only";

import { CodexAppServerClient } from "@/lib/providers/openai-codex/app-server-client";

type RuntimeEntry = {
  credentialRef: string;
  client: CodexAppServerClient;
};

const globalForCodexRuntimes = globalThis as unknown as {
  labiaCodexRuntimes?: Map<string, RuntimeEntry>;
};

const runtimes =
  globalForCodexRuntimes.labiaCodexRuntimes ?? new Map<string, RuntimeEntry>();

if (process.env.NODE_ENV !== "production") {
  globalForCodexRuntimes.labiaCodexRuntimes = runtimes;
}

export function getCodexRuntime(connectionId: string) {
  return runtimes.get(connectionId)?.client ?? null;
}

export function hasCodexRuntime(connectionId: string) {
  return runtimes.has(connectionId);
}

export async function startCodexRuntime(
  connectionId: string,
  credentialRef: string,
) {
  const current = runtimes.get(connectionId);

  if (current?.credentialRef === credentialRef && current.client.isRunning) {
    return current.client;
  }

  current?.client.close();

  const client = new CodexAppServerClient({ credentialRef });
  await client.start();
  runtimes.set(connectionId, { credentialRef, client });
  return client;
}

export function stopCodexRuntime(connectionId: string) {
  const current = runtimes.get(connectionId);
  if (!current) {
    return;
  }

  current.client.close();
  runtimes.delete(connectionId);
}
