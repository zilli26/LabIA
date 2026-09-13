import "server-only";

import type { ExecutorAccountStatus, LoginInstruction, OpenAiLoginMethod, ProviderExecutorStatus } from "./types";
import { getExecutorConfig, sanitizeProviderMessage } from "./security";

type ExecutorErrorPayload = { error?: { code?: string; message?: string } };

export class ExecutorRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ExecutorRequestError";
  }
}

async function executorFetch<T>(pathname: string, init?: RequestInit): Promise<T> {
  const { url, token } = getExecutorConfig();
  const target = new URL(pathname, url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(target, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const payload = (await response.json().catch(() => ({}))) as ExecutorErrorPayload & T;
    if (!response.ok) {
      throw new ExecutorRequestError(
        payload.error?.message || `Executor respondeu HTTP ${response.status}`,
        response.status,
        payload.error?.code,
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ExecutorRequestError) throw error;
    throw new Error(sanitizeProviderMessage(error));
  } finally {
    clearTimeout(timer);
  }
}

export async function getExecutorHealth(): Promise<{ executorStatus: ProviderExecutorStatus }> {
  return executorFetch("/health");
}

export async function startExecutorLogin(
  sessionRef: string,
  method: OpenAiLoginMethod,
): Promise<{ loginId: string; instruction: LoginInstruction }> {
  return executorFetch(`/connections/${encodeURIComponent(sessionRef)}/start`, {
    method: "POST",
    body: JSON.stringify({ method }),
  });
}

export async function readExecutorConnectionStatus(
  sessionRef: string,
  expectedLoginId?: string | null,
  expectedLoginExpiresAt?: string | null,
) {
  const query = new URLSearchParams();
  if (expectedLoginId !== undefined) query.set("expectedLoginId", expectedLoginId ?? "");
  if (expectedLoginExpiresAt !== undefined) query.set("expectedLoginExpiresAt", expectedLoginExpiresAt ?? "");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return executorFetch<ExecutorAccountStatus>(`/connections/${encodeURIComponent(sessionRef)}/status${suffix}`);
}

export async function cancelExecutorLogin(sessionRef: string) {
  return executorFetch<ExecutorAccountStatus>(`/connections/${encodeURIComponent(sessionRef)}/cancel`, {
    method: "POST",
    body: "{}",
  });
}

export async function logoutExecutorConnection(sessionRef: string) {
  return executorFetch<ExecutorAccountStatus>(`/connections/${encodeURIComponent(sessionRef)}/logout`, {
    method: "POST",
    body: "{}",
  });
}

export async function readExecutorImageOptions(sessionRef: string) {
  return executorFetch<{ models: Array<{ id: string; name: string }> }>(
    `/connections/${encodeURIComponent(sessionRef)}/image/options`,
  );
}
