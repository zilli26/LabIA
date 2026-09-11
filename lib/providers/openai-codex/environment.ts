import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const CREDENTIAL_REF_PATTERN = /^codex-[a-zA-Z0-9-]{12,}$/;

const BLOCKED_CHILD_ENV = new Set([
  "CODEX_HOME",
  "CODEX_API_KEY",
  "OPENAI_API_KEY",
  "OPENAI_API_KEY_PATH",
  "OPENAI_ORGANIZATION",
  "OPENAI_PROJECT",
]);

export function getCodexBinary(env: NodeJS.ProcessEnv = process.env) {
  return env.LABIA_CODEX_BIN?.trim() || "codex";
}

export function getProviderDataRoot(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.LABIA_PROVIDER_DATA_DIR?.trim();

  if (!configured) {
    return join(homedir(), ".labia", "providers");
  }

  return isAbsolute(configured) ? configured : resolve(configured);
}

export function getConnectionCodexHome(
  credentialRef: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  if (!CREDENTIAL_REF_PATTERN.test(credentialRef)) {
    throw new Error("Invalid provider credential reference.");
  }

  return join(getProviderDataRoot(env), "openai-codex", credentialRef);
}

export async function ensureConnectionCodexHome(
  credentialRef: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const codexHome = getConnectionCodexHome(credentialRef, env);
  await mkdir(codexHome, { recursive: true, mode: 0o700 });
  return codexHome;
}

export function buildCodexChildEnv(
  codexHome: string,
  source: NodeJS.ProcessEnv = process.env,
) {
  const childEnv: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || BLOCKED_CHILD_ENV.has(key)) {
      continue;
    }

    childEnv[key] = value;
  }

  childEnv.CODEX_HOME = codexHome;
  return childEnv;
}
