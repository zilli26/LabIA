import type { NextRequest } from "next/server";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export type LocalAccessDecision =
  | { ok: true }
  | {
      ok: false;
      status: 403 | 404;
      code: "local_oauth_disabled" | "local_only";
    };

export function checkLocalProviderAccess(
  request: Pick<NextRequest, "url" | "headers">,
  env: NodeJS.ProcessEnv = process.env,
): LocalAccessDecision {
  if (
    env.LABIA_LOCAL_OPENAI_OAUTH_ENABLED !== "true" ||
    env.VERCEL === "1"
  ) {
    return { ok: false, status: 404, code: "local_oauth_disabled" };
  }

  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return { ok: false, status: 403, code: "local_only" };
  }

  if (!LOOPBACK_HOSTS.has(requestUrl.hostname)) {
    return { ok: false, status: 403, code: "local_only" };
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (!LOOPBACK_HOSTS.has(originUrl.hostname)) {
        return { ok: false, status: 403, code: "local_only" };
      }
    } catch {
      return { ok: false, status: 403, code: "local_only" };
    }
  }

  return { ok: true };
}
