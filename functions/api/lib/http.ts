import type { Context } from 'hono'
import type { ApiError, ApiSuccess } from '../types'

/** Common HTTP statuses returned by API handlers (incl. upstream-style errors). */
export type ApiFailStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 502 | 503

export function ok<T>(c: Context, data: T, status: number = 200): Response {
  return c.json({ ok: true, data, trace_id: c.get('trace_id') } as ApiSuccess<T>, status as never)
}

export function fail(
  c: Context,
  code: string,
  message: string,
  status: ApiFailStatus,
  details?: unknown,
): Response {
  return c.json(
    {
      ok: false,
      error: details === undefined ? { code, message } : { code, message, details },
      trace_id: c.get('trace_id'),
    } as ApiError,
    status,
  )
}
