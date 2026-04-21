// Thin fetch wrapper for the Hono API. Centralises the envelope shape
// (ApiSuccess / ApiError per SPEC_BACKEND.md) so pages and hooks don't
// hand-roll error handling.

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export type ApiError = {
  code: string
  message: string
  details?: unknown
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError }

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  idempotencyKey?: string
  signal?: AbortSignal
}

export async function api<T>(path: string, opts: Options = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers,
  }
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body)
  if (opts.signal) init.signal = opts.signal

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, init)
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: { code: 'network', message: (err as Error).message || 'Network error' },
    }
  }

  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    // Response body wasn't JSON — treat as generic error.
  }

  if (res.ok) {
    const body = json as { ok: boolean; data: T }
    if (body?.ok) return { ok: true, data: body.data }
    return { ok: false, status: res.status, error: { code: 'invalid_response', message: 'Invalid response envelope' } }
  }

  const body = json as { ok?: boolean; error?: ApiError } | null
  return {
    ok: false,
    status: res.status,
    error: body?.error ?? { code: 'http_error', message: `HTTP ${res.status}` },
  }
}
