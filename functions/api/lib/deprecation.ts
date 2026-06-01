/**
 * API-DEPRECATION — RFC 8594 / draft-deprecation response headers.
 *
 * Attaches `Deprecation`, `Sunset`, and `Link` (successor-version) headers so
 * external integrators on older public-API versions get a machine-readable
 * signal and a documented migration target. Apply as Hono middleware on the
 * version's router.
 *
 * See FUTURE_READY_REVIEW_2026-06.md R-03.
 */
import type { Context, Next } from 'hono'

export interface DeprecationOptions {
  /** RFC 1123 / HTTP-date string for the planned retirement, e.g. 'Thu, 31 Dec 2026 23:59:59 GMT'. */
  sunset: string
  /** Path of the successor version clients should migrate to, e.g. '/api/v3'. */
  successor: string
}

/**
 * Hono middleware that marks every response from the mounted router as
 * deprecated. Headers are set after `next()` so they apply to the final
 * response regardless of the route handler.
 */
export function deprecationHeaders({ sunset, successor }: DeprecationOptions) {
  return async (c: Context, next: Next) => {
    await next()
    c.header('Deprecation', 'true')
    c.header('Sunset', sunset)
    c.header('Link', `<${successor}>; rel="successor-version"`)
  }
}
