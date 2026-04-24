// Structured JSON request logger.
//
// Runs after the trace-id middleware. Emits a single JSON line per request via
// `console.log` (captured by Cloudflare's Logs/Logpush). Silent in `dev` to
// keep the Vitest output clean.
//
// Hard rule: never log PII (no email, no JWT, no raw IP). The `user_id` field
// comes from `c.get('user').sub` only — the JWT `sub` claim is an opaque ULID.

import type { MiddlewareHandler } from 'hono'
import type { AuthClaims } from '../lib/jwt'
import type { Env } from '../types'
import { routeKey, writeLiveMetricBucket } from '../lib/metrics-kv'

type LoggerVariables = {
  trace_id: string
  user?: AuthClaims
}

type LogLine = {
  ts: string
  level: 'info' | 'warn' | 'error'
  method: string
  path: string
  status: number
  duration_ms: number
  trace_id: string
  user_id?: string
  error_code?: string
}

export const loggerMiddleware: MiddlewareHandler<{ Bindings: Env; Variables: LoggerVariables }> = async (c, next) => {
  // Dev silences logs so local/test runs don't spam stdout.
  const env = c.env.ENV
  if (env !== 'production' && env !== 'staging') {
    await next()
    return
  }

  const start = Date.now()
  await next()
  const duration_ms = Date.now() - start

  const status = c.res.status
  // Error code lives in the response body envelope; cheap peek via a cloned
  // response avoids consuming the original stream. Non-JSON responses (assets,
  // redirects) simply skip this.
  let error_code: string | undefined
  if (status >= 400) {
    const ct = c.res.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      try {
        const cloned = c.res.clone()
        const body = (await cloned.json()) as { error?: { code?: string } } | null
        if (body && body.error && typeof body.error.code === 'string') {
          error_code = body.error.code
        }
      } catch {
        // Body already consumed or unparseable — skip silently.
      }
    }
  }

  const user = c.get('user')
  const path = new URL(c.req.url).pathname
  const line: LogLine = {
    ts: new Date().toISOString(),
    level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
    method: c.req.method,
    path,
    status,
    duration_ms,
    trace_id: c.get('trace_id') ?? 'unknown',
    ...(user?.sub ? { user_id: user.sub } : {}),
    ...(error_code ? { error_code } : {}),
  }
  console.log(JSON.stringify(line))

  // Analytics Engine — fire-and-forget, never blocks response.
  c.env.METRICS_AE?.writeDataPoint({
    indexes: [routeKey(path)],
    doubles: [duration_ms, status >= 500 ? 1 : 0, status],
    blobs: [line.trace_id, ...(user?.sub ? [user.sub] : [])],
  })

  // METRICS_KV live bucket — async, deferred via waitUntil.
  if (c.env.METRICS_KV) {
    c.executionCtx.waitUntil(
      writeLiveMetricBucket(c.env.METRICS_KV, duration_ms, status >= 500),
    )
  }
}
