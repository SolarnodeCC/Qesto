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
  /** Server trace id — quote it in support requests; matches server logs. */
  traceId?: string
}

/** Fired on 401 for a non-auth API call so the app can send the user to login. */
export const UNAUTHORIZED_EVENT = 'qesto:unauthorized'

function newTraceId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  }
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError }

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  idempotencyKey?: string
  signal?: AbortSignal
}

// DD-04 (#877): sensitive actions answer 403 `mfa_step_up_required` when the
// user has two-factor on but has not confirmed a code in the last 15 minutes.
// A UI component (MfaStepUpPrompt) registers a handler that asks for the code;
// api() then retries the original request once. Concurrent requests share a
// single prompt.
export const STEP_UP_REQUIRED_CODE = 'mfa_step_up_required'
const STEP_UP_PATH = '/api/auth/mfa/step-up'
type StepUpHandler = () => Promise<boolean>
let _stepUpHandler: StepUpHandler | null = null
let _stepUpInFlight: Promise<boolean> | null = null

export function setStepUpHandler(handler: StepUpHandler | null): void {
  _stepUpHandler = handler
}

export async function api<T>(path: string, opts: Options = {}): Promise<ApiResult<T>> {
  const result = await request<T>(path, opts)
  if (
    result.ok ||
    result.status !== 403 ||
    result.error.code !== STEP_UP_REQUIRED_CODE ||
    !_stepUpHandler ||
    path === STEP_UP_PATH
  ) {
    return result
  }
  const handler = _stepUpHandler
  _stepUpInFlight ??= handler().finally(() => {
    _stepUpInFlight = null
  })
  const confirmed = await _stepUpInFlight.catch(() => false)
  return confirmed ? request<T>(path, opts) : result
}

async function request<T>(path: string, opts: Options): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (opts.idempotencyKey) headers['idempotency-key'] = opts.idempotencyKey
  headers['accept-language'] = getLanguageHeader()
  // DD-24: CSRF marker — see functions/api/middleware/csrf.ts CLIENT_MARKER_HEADER.
  headers['x-qesto-client'] = 'web'
  // Correlate browser requests with server logs (the server echoes/uses it).
  const traceId = newTraceId()
  headers['x-trace-id'] = traceId
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
      error: { code: 'network', message: (err as Error).message || 'Network error', traceId },
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

  // Some routes return `{ error: 'plain string' }` while typed routes return
  // `{ error: { code, message } }`. Normalise both so callers can always rely
  // on result.error.message / result.error.code.
  const body = json as { ok?: boolean; error?: ApiError | string; trace_id?: string } | null
  const rawError = body?.error
  const baseError: ApiError =
    typeof rawError === 'string'
      ? { code: 'api_error', message: rawError }
      : (rawError as ApiError | undefined) ?? { code: 'http_error', message: `HTTP ${res.status}` }
  const error: ApiError = { ...baseError, traceId: body?.trace_id ?? res.headers.get('x-trace-id') ?? traceId }
  // Expired/revoked session on an app call: let the app route to login
  // instead of every page showing its own error. Auth endpoints are excluded
  // (a 401 from /api/auth/me is the normal "not signed in" answer).
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    try {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT, { detail: { path } }))
    } catch {
      /* non-browser test env */
    }
  }
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
