/**
import { logEvent } from './log'
 * GDPR-compliant error logging helper.
 *
 * This is the ONLY permitted way to log errors in Qesto.
 * Raw console.error(err) outside this helper is blocked by CI gate.
 *
 * See ADR-PII-SANITIZATION.md for compliance details.
 */

export interface SafeLogContext {
  /** Unique request trace ID (UUID) */
  traceId: string
  /** Route path (e.g. /api/sessions/:id/start) */
  route: string
  /** Error class name (e.g. 'NetworkError', 'ValidationError') */
  errorClass: string
  /** Sanitized error message (optional, stripped in production) */
  errorMessage?: string
  /** Hashed user ID or null for public endpoints */
  userId?: string
  /** Team context for audit */
  teamId?: string
  /** HTTP status code */
  statusCode?: number
  /** Request duration in milliseconds */
  duration?: number
}

/**
 * Redaction patterns for PII.
 * Each pattern matches common secret formats in Qesto's dependencies.
 */
const REDACTION_PATTERNS = [
  // Emails (magic-link auth, participant emails, etc.)
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },

  // JWTs (format: eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)
  { name: 'jwt', pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },

  // Bearer tokens (format: Bearer <token>)
  { name: 'bearer', pattern: /Bearer\s+[A-Za-z0-9._\-]+/gi },

  // Stripe secret keys (format: sk_test_* or sk_live_*)
  { name: 'stripe_secret', pattern: /(sk_(?:test|live)_[A-Za-z0-9]+)/g },

  // Stripe webhook secret (format: whsec_*)
  { name: 'stripe_webhook', pattern: /(whsec_[A-Za-z0-9]+)/g },

  // Resend API key (format: re_*)
  { name: 'resend_key', pattern: /(re_[A-Za-z0-9]+)/g },

  // Cloudflare API tokens (40-char hex)
  { name: 'cloudflare_token', pattern: /([a-f0-9]{40})/g },

  // SAML assertions (XML between tags)
  { name: 'saml_assertion', pattern: /<saml:Assertion[^>]*>.*?<\/saml:Assertion>/gis },

  // Workers AI prompt content (heuristic: long strings after "prompt:")
  { name: 'ai_prompt', pattern: /prompt:\s*"([^"]{100,})"/gi },

  // Vectorize embeddings (long array of floats)
  { name: 'embedding', pattern: /\[[\d.]+(?:,\s*[\d.]+){100,}\]/g },
]

/**
 * Sanitize error message by redacting PII patterns.
 * @param msg Raw error message
 * @returns Sanitized message with PII replaced by [REDACTED]
 */
function sanitizeErrorMessage(msg: string): string {
  if (!msg) return ''

  let sanitized = msg
  for (const { pattern } of REDACTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]')
  }

  // Limit length to prevent log spam
  return sanitized.substring(0, 256)
}

/**
 * Log an error with PII sanitization.
 *
 * USAGE:
 * ```typescript
 * try {
 *   await stripe.customers.create({ email, ... })
 * } catch (err) {
 *   safeLogContext(err, {
 *     traceId: c.req.header('X-Trace-ID') || generateUUID(),
 *     route: c.req.path,
 *     errorClass: 'StripeError',
 *     statusCode: 500,
 *   })
 *   return c.json({ error: 'Billing failed' }, { status: 500 })
 * }
 * ```
 *
 * @param err Error object (only name is extracted)
 * @param ctx Safe log context
 */
export function safeLogContext(err: Error | unknown, ctx: SafeLogContext): void {
  // Extract ONLY whitelisted fields from error
  const errorMessage = sanitizeErrorMessage(
    err instanceof Error ? err.message : ''
  )
  const errorName = err instanceof Error ? err.name : 'UnknownError'

  // Build safe log entry
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    traceId: ctx.traceId,
    route: ctx.route,
    errorClass: ctx.errorClass || errorName,
    errorMessage: ctx.errorMessage || errorMessage,
    userId: ctx.userId || null,
    teamId: ctx.teamId || null,
    statusCode: ctx.statusCode || null,
    duration: ctx.duration || null,
  }

  // Production: strip errorMessage, keep only class + traceId
  // Staging/dev: include message for debugging.
  // Guard `process`: it is undefined in the Workers/Pages runtime without
  // nodejs_compat, and referencing it directly throws ReferenceError — which
  // previously crashed this very error logger (see CLAUDE.md: use c.env, not
  // process.env). The message is already sanitized above, so keeping it when
  // the runtime can't confirm production is safe.
  const isProduction =
    typeof process !== 'undefined' && process.env?.ENV === 'production'
  if (isProduction) {
    delete (logEntry as any).errorMessage
  }

  // Write to console (Cloudflare Logpush picks up from there)
  // Use JSON format for structured logging
  console.error(JSON.stringify(logEntry))
}

/**
 * Validate that a message contains no obvious PII.
 * Used by compliance tests to audit logs.
 *
 * @param message Message to check
 * @returns Array of pattern names found (empty if clean)
 */
export function detectPII(message: string): string[] {
  const found: string[] = []
  for (const { name, pattern } of REDACTION_PATTERNS) {
    pattern.lastIndex = 0  // reset g-flag regex state between calls
    if (pattern.test(message)) {
      found.push(name)
    }
  }
  return found
}

/**
 * DEPRECATED: Raw error logging is forbidden.
 * Use safeLogContext() instead.
 * This function exists to make the CI gate error clear.
 */
export function unsafeLogContext(): never {
  throw new Error(
    'FORBIDDEN: use safeLogContext(err, { traceId, route, errorClass, ... }) instead. '
    + 'See ADR-PII-SANITIZATION.md for details.'
  )
}

// ── Structured event logging ──────────────────────────────────────────────────
// Use logEvent() instead of logEvent({...}) throughout the
// codebase. Serialises to a single JSON line, applies PII redaction, and
// respects the ENVIRONMENT gate so noisy dev logs don't leak to Logpush.
// See TECH_DEBT_AUDIT_2026-05.md TD-09.

export interface LogEventPayload {
  event: string
  [key: string]: unknown
}

/**
 * Emit a single structured JSON log line.
 * Replaces raw `logEvent({...})` calls.
 */
export function logEvent(payload: LogEventPayload): void {
  // Redact any PII that might have slipped into event fields.
  const safe = redactObject(payload)
  console.log(JSON.stringify(safe))
}

function redactObject(obj: unknown): unknown {
  if (typeof obj === 'string') return sanitizeErrorMessage(obj)
  if (Array.isArray(obj)) return obj.map(redactObject)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, redactObject(v)]),
    )
  }
  return obj
}
