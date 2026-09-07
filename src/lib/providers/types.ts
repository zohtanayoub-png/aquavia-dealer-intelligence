/** Shared provider contracts. Every provider returns this envelope. */

export type ProviderOutcome<T> =
  | { ok: true; data: T; notes?: string[] }
  | { ok: false; error: ProviderError };

export interface ProviderError {
  /** Machine-readable reason so the UI can react precisely. */
  code:
    | 'NOT_CONFIGURED'
    | 'UNAUTHORIZED'
    | 'RATE_LIMITED'
    | 'QUOTA_EXCEEDED'
    | 'BAD_REQUEST'
    | 'UPSTREAM_ERROR'
    | 'NETWORK_ERROR'
    | 'TIMEOUT';
  message: string;
  /** HTTP status when the failure came from the upstream API. */
  status?: number;
  retryable: boolean;
}

export function providerError(
  code: ProviderError['code'],
  message: string,
  opts: { status?: number; retryable?: boolean } = {},
): { ok: false; error: ProviderError } {
  const retryableByDefault = code === 'RATE_LIMITED' || code === 'NETWORK_ERROR' || code === 'TIMEOUT';
  return {
    ok: false,
    error: {
      code,
      message,
      status: opts.status,
      retryable: opts.retryable ?? retryableByDefault,
    },
  };
}

/** fetch with an explicit timeout — a hung upstream must not hang a run. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 20_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function classifyHttpError(status: number, body: string): ReturnType<typeof providerError> {
  const snippet = body.slice(0, 400);
  if (status === 401 || status === 403) {
    return providerError('UNAUTHORIZED', `API key rejected (HTTP ${status}). ${snippet}`, { status });
  }
  if (status === 429) {
    return providerError('RATE_LIMITED', `Rate limited (HTTP 429). ${snippet}`, { status });
  }
  if (status === 400) {
    return providerError('BAD_REQUEST', `Request rejected (HTTP 400). ${snippet}`, { status });
  }
  return providerError('UPSTREAM_ERROR', `Upstream error (HTTP ${status}). ${snippet}`, { status });
}
