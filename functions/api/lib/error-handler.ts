// Error sanitization (SEC-02): Remove sensitive details from API error responses in production.

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
