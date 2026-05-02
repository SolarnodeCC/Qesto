import type { Context } from 'hono'
import type { ApiError, ApiSuccess } from '../types'

export function ok<T>(c: Context, data: T, status: number = 200): Response {
  return c.json({ ok: true, data, trace_id: c.get('trace_id') } as ApiSuccess<T>, status as never)
}

export function fail(
  c: Context,
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500,
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
