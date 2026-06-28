// Error sanitization (SEC-02): Remove sensitive details from API error responses in production.

import { type Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ApiError, Env } from '../types'

/**
 * Single builder for API error responses (ADR-0070).
 *
 * Replaces the ~610 hand-rolled `c.json({ ok: false, error: {...}, trace_id })`
 * envelopes scattered across route handlers with one call site that:
 *  - always emits the canonical {@link ApiError} shape,
 *  - always attaches the request `trace_id`, and
 *  - applies the SEC-02 production policy for 5xx (hide internal detail).
 *
 * Enforced by `scripts/check-error-response.mjs` (ratchet on inline `ok: false`).
 *
 * @example
 *   return errorResponse(c, 404, 'not_found', 'Team not found')
 */
export function errorResponse<E extends { Bindings: Env }>(
  c: Context<E>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
): Response {
  const isProduction = c.env.ENV === 'production'
  // SEC-02: never leak 5xx internals in production — mirror sanitizeError().
  const safeMessage =
    isProduction && status >= 500
      ? 'An unexpected error occurred. Please contact support if the problem persists.'
      : message
  const body: ApiError = {
    ok: false,
    error: { code, message: safeMessage },
    // trace_id lives in AuthVariables; cast for contexts not typed with it (cf. middleware/csrf.ts).
    trace_id: (c.get('trace_id' as never) as string | undefined) ?? 'unknown',
  }
  return c.json(body, status)
}

/**
 * Sanitizes error messages for API responses based on environment.
 * In production, sensitive 5xx details are replaced with generic messages.
 * In development, full error details are preserved for debugging.
 */
export function sanitizeError(
  err: Error | unknown,
  environment: 'production' | 'preview' | 'staging' | 'dev',
  status: number,
): { code: string; message: string; details?: unknown } {
  const isProduction = environment === 'production'

  // Determine error code based on HTTP status
  const code = status >= 500 ? 'internal' : 'bad_request'

  // In production, hide 5xx details; preserve 4xx user-facing messages
  if (isProduction && status >= 500) {
    return {
      code,
      message: 'An unexpected error occurred. Please contact support if the problem persists.',
    }
  }

  // Development: include full error details
  const message = err instanceof Error ? err.message : String(err)
  return {
    code,
    message,
    details: !isProduction && err instanceof Error ? { stack: err.stack } : undefined,
  }
}
