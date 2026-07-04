export function getProviderErrorMessage(error: unknown) {
  const fallback = error instanceof Error ? error.message : String(error);

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const record = error as Record<string, unknown>;
  const bodyMessage = getErrorBodyMessage(record.body);
  const parts = [bodyMessage ?? fallback];

  if (typeof record.status === "number") {
    parts.push(`HTTP ${record.status}`);
  }

  if (typeof record.requestId === "string" && record.requestId.length > 0) {
    parts.push(`request ${record.requestId}`);
  }

  return parts.join(" - ");
}

function getErrorBodyMessage(body: unknown): string | undefined {
  if (typeof body === "string") {
    return body;
  }

  if (!body || typeof body !== "object") {
    return undefined;
  }

  const record = body as Record<string, unknown>;

  for (const key of ["message", "detail", "error"]) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    if (Array.isArray(value)) {
      const firstMessage = value
        .map((item) => getErrorBodyMessage(item))
        .find((message) => message && message.trim().length > 0);

      if (firstMessage) {
        return firstMessage;
      }
    }
  }

  if (typeof record.msg === "string" && record.msg.trim().length > 0) {
    return record.msg;
  }

  return undefined;
}
