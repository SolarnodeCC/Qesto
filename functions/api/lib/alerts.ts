// Threshold-based alert detection + operator paging dispatch.
//
// `checkAlert` evaluates SLO thresholds. `dispatchAlert` / `alertCritical` push
// critical results to optional channels:
//   • ALERT_WEBHOOK_URL — Slack/generic webhook POST
//   • SENTRY_DSN — Sentry store API (HTTP, no SDK wrap)
//   • GITHUB_ALERT_TOKEN + GITHUB_ALERT_REPO — auto GitHub issue (label auto-alert)
// When secrets are unset, dispatch is a no-op beyond structured console logging.
//
// GitHub anti-spam: fingerprint (route + reason) keyed in ACTIONS_KV / METRICS_KV,
// reopen/comment on an existing open issue instead of creating duplicates, and a
// global hourly create-rate limit.
//
// Thresholds (v1 — tune after two weeks of baseline data):
//   • p95 latency > 500ms      (SLO: 95% of requests serve in <500ms)
//   • error_rate  > 5%         (5xx / total)
//   • DO crash                 (surfaced via do_crash flag)
//
// The alert message is English-only, operator-facing — NO user data, NO PII.

import { safeLogContext } from './log'

export const ALERT_THRESHOLDS = {
  p95LatencyMs: 500,
  errorRate: 0.05,
  /** Webhook DLQ depth that pages ops (per team list). */
  webhookDlqWarnSize: 10,
  /** Max new GitHub alert issues created per rolling hour. */
  githubMaxCreatesPerHour: 5,
  /** Min seconds between comments on the same fingerprint issue. */
  githubMinCommentIntervalSec: 900,
  /** KV TTL for fingerprint → issue mapping (30 days). */
  githubFingerprintTtlSec: 30 * 24 * 60 * 60,
} as const

export const GITHUB_ALERT_LABEL = 'auto-alert'

export type AlertInput = {
  route: string
  p95_latency: number
  error_rate: number
  do_crash?: boolean
  request_count?: number
}

export type AlertResult = {
  fired: boolean
  severity: 'none' | 'warn' | 'critical'
  reasons: string[]
  message: string
}

/** Env slice needed for paging — secrets only, never committed. */
export type AlertDispatchEnv = {
  ALERT_WEBHOOK_URL?: string
  SENTRY_DSN?: string
  /** Fine-grained PAT with Issues: write on GITHUB_ALERT_REPO only. */
  GITHUB_ALERT_TOKEN?: string
  /** `owner/repo`, e.g. `SolarnodeCC/Qesto`. */
  GITHUB_ALERT_REPO?: string
  ENV?: string
  /** Preferred KV for fingerprint dedupe; falls back to METRICS_KV. */
  ACTIONS_KV?: KVNamespace
  METRICS_KV?: KVNamespace
}

export type AlertDispatchContext = {
  traceId?: string
  route?: string
  /** Error class / reason key used in GitHub fingerprint (no PII). */
  errorClass?: string
  /** Extra operator-safe fields (no PII). */
  details?: Record<string, string | number | boolean | null>
}

export type DispatchChannels = {
  webhook: boolean
  sentry: boolean
  github: boolean
}

/**
 * Evaluate alert thresholds for a single (route, minute) bucket.
 * DO crash escalates to `critical`; latency or error rate breaches are `warn`
 * unless both fire simultaneously (compound failure → `critical`).
 */
export function checkAlert(
  route: string,
  p95_latency: number,
  error_rate: number,
  opts: { do_crash?: boolean; request_count?: number } = {},
): AlertResult {
  const reasons: string[] = []

  if (p95_latency > ALERT_THRESHOLDS.p95LatencyMs) {
    reasons.push(`p95=${Math.round(p95_latency)}ms > ${ALERT_THRESHOLDS.p95LatencyMs}ms`)
  }
  if (error_rate > ALERT_THRESHOLDS.errorRate) {
    // Format as integer percent to avoid float noise in logs.
    const pct = Math.round(error_rate * 1000) / 10
    reasons.push(`error_rate=${pct}% > ${ALERT_THRESHOLDS.errorRate * 100}%`)
  }
  if (opts.do_crash) {
    reasons.push('durable_object_crash')
  }

  if (reasons.length === 0) {
    return { fired: false, severity: 'none', reasons: [], message: '' }
  }

  const severity: AlertResult['severity'] =
    opts.do_crash || reasons.length >= 2 ? 'critical' : 'warn'

  const sampleSuffix =
    typeof opts.request_count === 'number' ? ` (n=${opts.request_count})` : ''
  const message = `[${severity}] route=${route} ${reasons.join('; ')}${sampleSuffix}`

  return { fired: true, severity, reasons, message }
}

/** Convenience wrapper that also accepts the AlertInput shape. */
export function checkAlertInput(input: AlertInput): AlertResult {
  return checkAlert(input.route, input.p95_latency, input.error_rate, {
    ...(typeof input.do_crash === 'boolean' ? { do_crash: input.do_crash } : {}),
    ...(typeof input.request_count === 'number' ? { request_count: input.request_count } : {}),
  })
}

/**
 * Build a synthetic critical AlertResult for ad-hoc paging (cron failure, DLQ
 * growth, unhandled 5xx). Does not evaluate latency/error-rate thresholds.
 */
export function criticalAlert(route: string, reason: string): AlertResult {
  return {
    fired: true,
    severity: 'critical',
    reasons: [reason],
    message: `[critical] route=${route} ${reason}`,
  }
}

/**
 * Stable fingerprint for dedupe: route + primary reason/errorClass.
 * Path IDs are collapsed so `/api/sessions/01H…/close` shares a bucket.
 */
export function alertFingerprint(route: string, reason: string): string {
  const routeKey = route
    .replace(/\/[0-9A-HJKMNP-TV-Z]{26}\b/gi, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '/:id')
    .replace(/\/\d+\b/g, '/:n')
    .replace(/[^a-zA-Z0-9_/.:-]/g, '_')
    .slice(0, 120)
  const reasonKey = reason.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80)
  return `${routeKey}::${reasonKey}`
}

/**
 * Page operators when `result` is critical. Warn-level results are logged only.
 * Missing channel secrets → those channels no-op.
 */
export async function dispatchAlert(
  env: AlertDispatchEnv,
  result: AlertResult,
  ctx: AlertDispatchContext = {},
): Promise<DispatchChannels> {
  const empty: DispatchChannels = { webhook: false, sentry: false, github: false }
  if (!result.fired) return empty

  const route = ctx.route ?? 'alerts'
  const traceId = ctx.traceId ?? `alert-${Date.now()}`
  const errorClass = ctx.errorClass ?? result.reasons[0] ?? 'Alert'

  safeLogContext(new Error(result.message), {
    traceId,
    route,
    errorClass: result.severity === 'critical' ? 'CriticalAlert' : 'WarnAlert',
    statusCode: result.severity === 'critical' ? 500 : 200,
  })

  if (result.severity !== 'critical') {
    return empty
  }

  const payload = {
    text: result.message,
    severity: result.severity,
    reasons: result.reasons,
    route,
    traceId,
    env: env.ENV ?? 'unknown',
    ...(ctx.details ? { details: sanitizeDetails(ctx.details) } : {}),
  }

  const [webhook, sentry, github] = await Promise.all([
    postAlertWebhook(env.ALERT_WEBHOOK_URL, payload),
    postSentryEvent(env.SENTRY_DSN, result.message, {
      traceId,
      route,
      reasons: result.reasons,
    }),
    postGitHubAlert(env, {
      route,
      reason: errorClass,
      message: result.message,
      traceId,
      details: ctx.details,
    }),
  ])
  return { webhook, sentry, github }
}

/**
 * Evaluate thresholds and dispatch if critical. Convenience for metrics rollups.
 */
export async function evaluateAndDispatchAlert(
  env: AlertDispatchEnv,
  input: AlertInput,
  ctx: AlertDispatchContext = {},
): Promise<AlertResult> {
  const result = checkAlertInput(input)
  if (result.fired) {
    await dispatchAlert(env, result, { ...ctx, route: ctx.route ?? input.route })
  }
  return result
}

/**
 * Fire a critical page for an already-known failure (5xx, cron, DLQ growth).
 * Always logs via safeLogContext; network paging only when secrets are set.
 */
export async function alertCritical(
  env: AlertDispatchEnv,
  route: string,
  reason: string,
  ctx: AlertDispatchContext = {},
): Promise<void> {
  await dispatchAlert(env, criticalAlert(route, reason), {
    ...ctx,
    route: ctx.route ?? route,
    errorClass: ctx.errorClass ?? reason,
  })
}

/** Drop anything that looks like an email / token from detail values. */
function sanitizeDetails(
  details: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {}
  for (const [k, v] of Object.entries(details)) {
    if (typeof v === 'string') {
      out[k] = v
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED]')
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED]')
        .slice(0, 200)
    } else {
      out[k] = v
    }
  }
  return out
}

async function postAlertWebhook(
  url: string | undefined,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (!url) return false
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    // Paging must never throw into the request/cron path.
    return false
  }
}

/**
 * Optional Sentry capture via the public store API (no @sentry/cloudflare SDK).
 * Dual Worker + Pages entry makes `withSentry` wrapping non-clean; HTTP store
 * works for both when SENTRY_DSN is set. No-op when unset.
 *
 * DSN format: https://<publicKey>@<host>/<projectId>
 */
async function postSentryEvent(
  dsn: string | undefined,
  message: string,
  tags: Record<string, string | string[]>,
): Promise<boolean> {
  if (!dsn) return false
  try {
    const parsed = parseSentryDsn(dsn)
    if (!parsed) return false
    const { publicKey, host, projectId } = parsed
    const url = `https://${host}/api/${projectId}/store/`
    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: 'error',
      logger: 'qesto.alerts',
      message,
      tags: {
        ...Object.fromEntries(
          Object.entries(tags).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v]),
        ),
      },
      environment: 'production',
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=qesto-alerts/1.0, sentry_key=${publicKey}`,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Exported for unit tests. */
export function parseSentryDsn(
  dsn: string,
): { publicKey: string; host: string; projectId: string } | null {
  try {
    const u = new URL(dsn)
    const publicKey = u.username
    const projectId = u.pathname.replace(/^\//, '').split('/')[0]
    if (!publicKey || !projectId || !u.host) return null
    return { publicKey, host: u.host, projectId }
  } catch {
    return null
  }
}

// ── GitHub Issues channel ────────────────────────────────────────────────────

type GitHubAlertInput = {
  route: string
  reason: string
  message: string
  traceId: string
  details?: Record<string, string | number | boolean | null>
}

type FingerprintState = {
  issueNumber: number
  count: number
  lastCommentAt: number
}

function alertKv(env: AlertDispatchEnv): KVNamespace | null {
  return env.ACTIONS_KV ?? env.METRICS_KV ?? null
}

function fingerprintKvKey(fp: string): string {
  return `alert:gh:fp:${fp}`
}

function rateLimitKvKey(hourBucket: string): string {
  return `alert:gh:rate:${hourBucket}`
}

/** Parse `owner/repo`; reject anything else. */
export function parseGitHubAlertRepo(repo: string | undefined): { owner: string; repo: string } | null {
  if (!repo) return null
  const m = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(repo.trim())
  if (!m) return null
  return { owner: m[1], repo: m[2] }
}

/**
 * Create or bump a GitHub issue for a critical alert.
 * No-op without GITHUB_ALERT_TOKEN. Never embeds PII — only route, error class,
 * sanitized reason, env name, and opaque trace id.
 */
async function postGitHubAlert(env: AlertDispatchEnv, input: GitHubAlertInput): Promise<boolean> {
  const token = env.GITHUB_ALERT_TOKEN
  const parsed = parseGitHubAlertRepo(env.GITHUB_ALERT_REPO)
  if (!token || !parsed) return false

  const kv = alertKv(env)
  const fp = alertFingerprint(input.route, input.reason)
  const now = Date.now()

  try {
    // Rate-limit new creates (comments on existing issues still allowed).
    if (kv) {
      const hourBucket = new Date(now).toISOString().slice(0, 13) // YYYY-MM-DDTHH
      const rateKey = rateLimitKvKey(hourBucket)
      const rawRate = await kv.get(rateKey)
      const creates = rawRate ? Number.parseInt(rawRate, 10) || 0 : 0

      const existing = await readFingerprintState(kv, fp)
      if (existing) {
        return bumpExistingGitHubIssue(env, parsed, token, kv, fp, existing, input, now)
      }

      if (creates >= ALERT_THRESHOLDS.githubMaxCreatesPerHour) {
        safeLogContext(new Error('GitHub alert create rate limit hit'), {
          traceId: input.traceId,
          route: input.route,
          errorClass: 'GitHubAlertRateLimited',
          statusCode: 429,
        })
        return false
      }

      const created = await createGitHubIssue(parsed, token, input, env.ENV)
      if (!created) return false

      await kv.put(
        fingerprintKvKey(fp),
        JSON.stringify({ issueNumber: created.number, count: 1, lastCommentAt: now } satisfies FingerprintState),
        { expirationTtl: ALERT_THRESHOLDS.githubFingerprintTtlSec },
      )
      await kv.put(rateKey, String(creates + 1), { expirationTtl: 2 * 60 * 60 })
      return true
    }

    // No KV → best-effort create without dedupe (still labelled).
    const created = await createGitHubIssue(parsed, token, input, env.ENV)
    return Boolean(created)
  } catch {
    return false
  }
}

async function readFingerprintState(kv: KVNamespace, fp: string): Promise<FingerprintState | null> {
  try {
    const raw = await kv.get(fingerprintKvKey(fp))
    if (!raw) return null
    const parsed = JSON.parse(raw) as FingerprintState
    if (typeof parsed.issueNumber !== 'number') return null
    return {
      issueNumber: parsed.issueNumber,
      count: typeof parsed.count === 'number' ? parsed.count : 1,
      lastCommentAt: typeof parsed.lastCommentAt === 'number' ? parsed.lastCommentAt : 0,
    }
  } catch {
    return null
  }
}

async function bumpExistingGitHubIssue(
  env: AlertDispatchEnv,
  repo: { owner: string; repo: string },
  token: string,
  kv: KVNamespace,
  fp: string,
  state: FingerprintState,
  input: GitHubAlertInput,
  now: number,
): Promise<boolean> {
  const minIntervalMs = ALERT_THRESHOLDS.githubMinCommentIntervalSec * 1000
  const nextCount = state.count + 1

  // Always refresh the fingerprint counter in KV.
  const nextState: FingerprintState = {
    issueNumber: state.issueNumber,
    count: nextCount,
    lastCommentAt: state.lastCommentAt,
  }

  // Skip noisy comments within the interval — counter still increments in KV.
  if (now - state.lastCommentAt < minIntervalMs) {
    await kv.put(fingerprintKvKey(fp), JSON.stringify(nextState), {
      expirationTtl: ALERT_THRESHOLDS.githubFingerprintTtlSec,
    })
    return true
  }

  const open = await ensureIssueOpen(repo, token, state.issueNumber)
  if (!open) {
    // Issue closed or gone — allow a fresh create on next fire by clearing KV.
    await kv.delete(fingerprintKvKey(fp))
    const created = await createGitHubIssue(repo, token, input, env.ENV)
    if (!created) return false
    await kv.put(
      fingerprintKvKey(fp),
      JSON.stringify({ issueNumber: created.number, count: 1, lastCommentAt: now } satisfies FingerprintState),
      { expirationTtl: ALERT_THRESHOLDS.githubFingerprintTtlSec },
    )
    return true
  }

  const body = [
    `### Recurrence (×${nextCount})`,
    '',
    `- **route:** \`${input.route}\``,
    `- **error:** \`${input.reason}\``,
    `- **env:** \`${env.ENV ?? 'unknown'}\``,
    `- **trace_id:** \`${input.traceId}\``,
    `- **at:** ${new Date(now).toISOString()}`,
    '',
    '_Auto-generated by Qesto `alertCritical`. No user/PII data included._',
  ].join('\n')

  const commented = await githubFetch(repo, token, `issues/${state.issueNumber}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  })

  nextState.lastCommentAt = now
  await kv.put(fingerprintKvKey(fp), JSON.stringify(nextState), {
    expirationTtl: ALERT_THRESHOLDS.githubFingerprintTtlSec,
  })
  return commented
}

async function ensureIssueOpen(
  repo: { owner: string; repo: string },
  token: string,
  issueNumber: number,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/issues/${issueNumber}`,
      {
        headers: githubHeaders(token),
        signal: AbortSignal.timeout(5_000),
      },
    )
    if (!res.ok) return false
    const data = (await res.json()) as { state?: string }
    return data.state === 'open'
  } catch {
    return false
  }
}

async function createGitHubIssue(
  repo: { owner: string; repo: string },
  token: string,
  input: GitHubAlertInput,
  envName: string | undefined,
): Promise<{ number: number } | null> {
  const title = `[auto-alert] ${input.route} — ${input.reason}`.slice(0, 200)
  const body = [
    '## Critical alert',
    '',
    `- **route:** \`${input.route}\``,
    `- **error:** \`${input.reason}\``,
    `- **summary:** ${input.message.slice(0, 300)}`,
    `- **env:** \`${envName ?? 'unknown'}\``,
    `- **trace_id:** \`${input.traceId}\``,
    `- **fingerprint:** \`${alertFingerprint(input.route, input.reason)}\``,
    '',
    '_Auto-generated by Qesto alerting. Contains no user data, emails, tokens, or request bodies._',
    '_Label: `auto-alert`. Close when resolved; a new occurrence will open a fresh issue._',
  ].join('\n')

  try {
    const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/issues`, {
      method: 'POST',
      headers: githubHeaders(token),
      body: JSON.stringify({
        title,
        body,
        labels: [GITHUB_ALERT_LABEL],
      }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { number?: number }
    if (typeof data.number !== 'number') return null
    return { number: data.number }
  } catch {
    return null
  }
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'qesto-alerts',
    'content-type': 'application/json',
  }
}

async function githubFetch(
  repo: { owner: string; repo: string },
  token: string,
  path: string,
  init: RequestInit,
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}/${path}`, {
      ...init,
      headers: { ...githubHeaders(token), ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(8_000),
    })
    return res.ok
  } catch {
    return false
  }
}
