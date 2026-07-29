// Thin fetch wrapper for the Hono API. Centralises the envelope shape
// (ApiSuccess / ApiError per SPEC_BACKEND.md) so pages and hooks don't
// hand-roll error handling.
import { getLanguageHeader } from '../i18n'
import { API_BASE_URL } from '../config/api'

// In-memory token store (XSS-resistant).
// Tokens are stored ONLY in memory (not in localStorage/sessionStorage to prevent XSS theft).
// Backend sets HttpOnly Secure SameSite cookies, which the browser auto-includes on requests.
// This module maintains an in-memory reference for UI state (e.g., showing auth status).
// On page refresh, the cookie survives and can be used to restore session via /api/auth/me.

let _token: string | null = null

export function setAuthToken(token: string | null): void {
  _token = token
}

export function getAuthToken(): string | null {
  return _token
}

export type ApiError = {
  code: string
  message: string
  details?: unknown
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError }

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  idempotencyKey?: string
  signal?: AbortSignal
}

export async function api<T>(path: string, opts: Options = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey
  headers['accept-language'] = getLanguageHeader()
  const token = getAuthToken()
  if (token) headers['authorization'] = `Bearer ${token}`

  const init: RequestInit = {
    method: opts.method ?? 'GET',
    credentials: 'include',
    headers,
  }
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body)
  if (opts.signal) init.signal = opts.signal

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, init)
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

  // Some routes (e.g. templates-marketing.ts) return { error: 'plain string' }
  // while the typed routes return { error: { code, message } }. Normalise both
  // shapes here so callers can always rely on result.error.message.
  const body = json as { ok?: boolean; error?: ApiError | string } | null
  const rawError = body?.error
  const error: ApiError =
    typeof rawError === 'string'
      ? { code: 'api_error', message: rawError }
      : (rawError as ApiError | undefined) ?? { code: 'http_error', message: `HTTP ${res.status}` }
  return { ok: false, status: res.status, error }
}

// Error codes worth retrying: the SessionRoom Durable Object can be momentarily
// unreachable (cold start / region blip), surfacing as `do_init_failed`, and a
// dropped fetch surfaces as `network`. `/start` rolls the session back to draft
// on these, so an immediate retry is safe and idempotent.
const RETRYABLE_CODES = new Set(['do_init_failed', 'network'])

/**
 * `api()` with bounded retry on transient codes (see RETRYABLE_CODES). Non-retryable
 * errors (validation, conflict, auth, …) return immediately. Backoff grows linearly
 * (backoffMs, 2×backoffMs, …) so a genuinely broken backend still surfaces promptly.
 */
export async function apiRetry<T>(
  path: string,
  opts: Options = {},
  cfg: { retries?: number; backoffMs?: number } = {},
): Promise<ApiResult<T>> {
  const retries = cfg.retries ?? 2
  const backoffMs = cfg.backoffMs ?? 600
  let last = await api<T>(path, opts)
  for (let attempt = 1; attempt <= retries && !last.ok && RETRYABLE_CODES.has(last.error.code); attempt++) {
    await new Promise((r) => setTimeout(r, backoffMs * attempt))
    last = await api<T>(path, opts)
  }
  return last
}
