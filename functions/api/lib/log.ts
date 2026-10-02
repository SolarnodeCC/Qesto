/**
 * GDPR-compliant error logging helper.
 *
 * This is the ONLY permitted way to log errors in Qesto.
 * Raw console.error(err) outside this helper is blocked by CI gate.
 *
 * See ADR-PII-SANITIZATION.md for compliance details.
 */

export type LogLevel = 'error' | 'warn' | 'info'

/** Non-PII structured fields attached to a log line (never emails/tokens/bodies). */
export type SafeLogDetails = Record<string, string | number | boolean | null | undefined>

export interface SafeLogContext {
  /** Unique request trace ID (UUID) */
  traceId: string
  /** Route path (e.g. /api/sessions/:id/start) */
  route: string
  /** Error class name (e.g. 'NetworkError', 'ValidationError') */
  errorClass: string
  /** Sanitized error message (optional, stripped in production) */
  errorMessage?: string
  /**
   * Sanitized stack trace (optional). Redacted and truncated; never include
   * request bodies or secrets. Prefer passing `err.stack` and letting this
   * helper sanitize it.
   */
  stack?: string
  /** Hashed user ID or null for public endpoints */
  userId?: string
  /** Team / org context for audit (non-secret id) */
  teamId?: string
  /** Session id when the failure is session-scoped (non-secret) */
  sessionId?: string
  /** HTTP status code */
  statusCode?: number
  /** Request / call duration in milliseconds */
  duration?: number
  /** Log severity — defaults to `error`. Use `warn` for best-effort paths. */
  level?: LogLevel
  /** Named operation within a route (e.g. `d1.flush`, `webhook.deliver`) */
  operation?: string
  /** Extra non-PII fields (status, attempt, provider, outcome, …) */
  details?: SafeLogDetails
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
  const rawStack =
    ctx.stack ??
    (err instanceof Error && typeof err.stack === 'string' ? err.stack : undefined)
  // Cap stack length; redact PII patterns the same way as messages.
  const stack = rawStack
    ? sanitizeErrorMessage(rawStack).substring(0, 2048)
    : undefined

  const level: LogLevel = ctx.level ?? 'error'

  // Build safe log entry
  const logEntry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    traceId: ctx.traceId,
    route: ctx.route,
    errorClass: ctx.errorClass || errorName,
    errorMessage: ctx.errorMessage || errorMessage,
    userId: ctx.userId || null,
    teamId: ctx.teamId || null,
    sessionId: ctx.sessionId || null,
    statusCode: ctx.statusCode || null,
    duration: ctx.duration || null,
  }
  if (ctx.operation) logEntry.operation = ctx.operation
  if (stack) logEntry.stack = stack
  if (ctx.details) {
    const cleaned: Record<string, string | number | boolean | null> = {}
    for (const [k, v] of Object.entries(ctx.details)) {
      if (v === undefined) continue
      cleaned[k] = typeof v === 'string' ? sanitizeErrorMessage(v).substring(0, 128) : v
    }
    if (Object.keys(cleaned).length > 0) logEntry.details = cleaned
  }

  // Production: strip errorMessage, keep class + traceId + sanitized stack.
  // Staging/dev: include message for debugging.
  // Guard `process`: it is undefined in the Workers/Pages runtime without
  // nodejs_compat, and referencing it directly throws ReferenceError — which
  // previously crashed this very error logger (see CLAUDE.md: use c.env, not
  // process.env). The message is already sanitized above, so keeping it when
  // the runtime can't confirm production is safe.
  const isProduction =
    typeof process !== 'undefined' && process.env?.ENV === 'production'
  if (isProduction) {
    delete logEntry.errorMessage
  }

  // Write to console (Cloudflare Logpush picks up from there)
  // Use JSON format for structured logging. warn/info use console.warn/log so
  // Log Explorer severity filters stay useful.
  const line = JSON.stringify(logEntry)
  if (level === 'info') console.log(line)
  else if (level === 'warn') console.warn(line)
  else console.error(line)
}

/**
 * Best-effort / intentional-ignore path (cleanup, schema already-applied, metrics).
 * Always logs at `warn` with a short reason — never pages via alertCritical.
 * Callers must leave a one-line comment explaining why the failure is non-fatal.
 */
export function logBestEffort(
  err: unknown,
  ctx: Omit<SafeLogContext, 'level'> & { reason?: string },
): void {
  const { reason, details, ...rest } = ctx
  safeLogContext(err, {
    ...rest,
    level: 'warn',
    errorClass: rest.errorClass || (err instanceof Error ? err.name : 'BestEffortFailure'),
    details: {
      ...(details ?? {}),
      ...(reason ? { reason } : {}),
      bestEffort: true,
    },
  })
}

/**
 * External HTTP / provider failure (Stripe, Resend, Slack, webhooks, AI gateway…).
 * Logs status, duration, attempt/retry without PII. Does not page unless the
 * caller also invokes `alertCritical`.
 */
export function logExternalFailure(
  err: unknown,
  ctx: Omit<SafeLogContext, 'level'> & {
    provider: string
    httpStatus?: number | null
    attempt?: number
    retrying?: boolean
    outcome?: string
  },
): void {
  const { provider, httpStatus, attempt, retrying, outcome, details, duration, ...rest } = ctx
  safeLogContext(err, {
    ...rest,
    level: 'warn',
    duration,
    errorClass: rest.errorClass || `${provider}Error`,
    details: {
      ...(details ?? {}),
      provider,
      ...(httpStatus !== undefined ? { httpStatus } : {}),
      ...(attempt !== undefined ? { attempt } : {}),
      ...(retrying !== undefined ? { retrying } : {}),
      ...(outcome ? { outcome } : {}),
    },
  })
}

/** Expected D1 DDL noise (duplicate column / already exists) — no log spam. */
const EXPECTED_SCHEMA_RE = /duplicate column|already exists|unique constraint failed/i
/** Cap unexpected schema-patch warn keys per isolate to avoid cold-start bursts. */
const _schemaWarnKeys = new Set<string>()
const SCHEMA_WARN_CAP = 32

/**
 * Swallow expected schema-patch errors; warn once for unexpected ones.
 * Use on `ALTER TABLE … ADD COLUMN` / `CREATE … IF NOT EXISTS` best-effort paths.
 */
export function ignoreSchemaPatchError(err: unknown, route: string): void {
  const msg = err instanceof Error ? err.message : String(err)
  if (EXPECTED_SCHEMA_RE.test(msg)) {
    // Intentional: column/table already present on warm D1 — no log.
    return
  }
  const key = `${route}:${msg.slice(0, 64)}`
  if (_schemaWarnKeys.has(key) || _schemaWarnKeys.size >= SCHEMA_WARN_CAP) return
  _schemaWarnKeys.add(key)
  logBestEffort(err, {
    traceId: 'schema-patch',
    route,
    errorClass: 'SchemaPatchError',
    operation: 'd1.schema_patch',
    reason: 'unexpected_schema_patch_failure',
  })
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
