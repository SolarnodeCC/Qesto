// Platformbeheer — Module 4: OPS (operational control + incident management).
//
// Read views over operational state + audited operator actions. Destructive
// operations (deploy rollback, backup restore, secret rotation) follow a strict
// pattern: require an explicit `confirm: true`, write an audit event, and record
// the request as durable state for the external pipeline / NAS runner to act on.
// The Worker never performs the infra mutation itself.
//
// Secrets are NEVER returned in plaintext — only rotation metadata.

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import { ulid } from '../../lib/ulid'
import { validateBody } from '../../lib/request-validation'
import { recordAuditEvent } from '../../lib/audit'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { errorResponse } from '../../lib/error-handler'
import { rateLimit } from '../../middleware/rate-limit'
import { CRON_REGISTRY, isCronMissed, nextRunAfter } from '../../lib/ops-cron'
import type { Env } from '../../types'

// Shared limiter for infra-mutating operator actions (per admin IP).
const destructiveLimit = rateLimit({ namespace: 'admin-destructive', limit: 10, windowSec: 600 })

const RUNNER_HEARTBEAT_KEY = 'ops:runner:heartbeat'
const BACKUP_STATUS_KEY = 'ops:backup:status'
const WAF_WHITELIST_KEY = 'ops:waf:crawler_whitelist'
const RUNNER_OFFLINE_AFTER_MS = 5 * 60 * 1000

const Confirm = z.object({ confirm: z.literal(true) })

function opsKv(env: Env): KVNamespace | undefined {
  return env.METRICS_KV
}

export function mountOpsControlRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>,
) {
  // ── Deploys + NAS runner heartbeat ─────────────────────────────────────────
  app.get('/ops/deploys', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    let deploys: unknown[] = []
    try {
      const { results } = await c.env.DB.prepare(
        `SELECT id, version, environment, sha, status, created_at, rolled_back_at
         FROM deploy_history ORDER BY created_at DESC LIMIT 25`,
      ).all()
      deploys = results ?? []
    } catch {
      /* table optional */
    }

    const kv = opsKv(c.env)
    const hb = kv ? await readKvJson<{ last_heartbeat_at: number; runner_id?: string }>(kv, RUNNER_HEARTBEAT_KEY) : null
    const runner = hb
      ? {
          online: Date.now() - hb.last_heartbeat_at <= RUNNER_OFFLINE_AFTER_MS,
          last_heartbeat_at: hb.last_heartbeat_at,
          runner_id: hb.runner_id ?? null,
        }
      : { online: false, last_heartbeat_at: null, runner_id: null }

    return c.json({ ok: true, data: { deploys, runner }, trace_id }, 200)
  })

  app.post('/ops/deploys/:id/rollback', destructiveLimit, authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const id = c.req.param('id')
    const validated = await validateBody(c, Confirm)
    if ('error' in validated) return validated.error

    const row = await c.env.DB.prepare(`SELECT id, version FROM deploy_history WHERE id = ?1`).bind(id).first<{ id: string; version: string }>()
    if (!row) return errorResponse(c, 404, 'not_found', 'Deploy not found')

    await c.env.DB.prepare(`UPDATE deploy_history SET status = 'rollback_requested', rolled_back_at = ?1 WHERE id = ?2`)
      .bind(Date.now(), id)
      .run()
    await recordAuditEvent(c, { action: 'ops.deploy_rollback', subject_type: 'deploy', subject_id: id, after_snapshot: { version: row.version }, trace_id })
    return c.json({ ok: true, data: { id, status: 'rollback_requested' }, trace_id }, 200)
  })

  // ── Cron jobs + missed-run alert ───────────────────────────────────────────
  app.get('/ops/cron', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const now = Date.now()
    const jobs = await Promise.all(
      CRON_REGISTRY.map(async (job) => {
        let last: { status: string; started_at: number; finished_at: number | null } | null = null
        try {
          last = await c.env.DB.prepare(
            `SELECT status, started_at, finished_at FROM cron_runs WHERE job = ?1 ORDER BY started_at DESC LIMIT 1`,
          )
            .bind(job.key)
            .first()
        } catch {
          /* table optional */
        }
        const lastRunTs = last?.started_at ?? null
        return {
          key: job.key,
          label: job.label,
          schedule: job.schedule,
          last_status: last?.status ?? null,
          last_run_at: lastRunTs,
          next_run_at: nextRunAfter(lastRunTs, job.intervalMs, now),
          missed: isCronMissed(lastRunTs, job.intervalMs, now),
        }
      }),
    )
    return c.json({ ok: true, data: { jobs, generated_at: now }, trace_id }, 200)
  })

  app.post('/ops/cron/:key/trigger', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const key = c.req.param('key')
    if (!CRON_REGISTRY.some((j) => j.key === key)) {
      return errorResponse(c, 404, 'not_found', 'Unknown cron job')
    }
    try {
      await c.env.DB.prepare(
        `INSERT INTO cron_runs (id, job, status, started_at, detail) VALUES (?1, ?2, 'running', ?3, 'manual trigger requested')`,
      )
        .bind(ulid(), key, Date.now())
        .run()
    } catch {
      /* table optional — still audit the intent */
    }
    await recordAuditEvent(c, { action: 'ops.cron_trigger', subject_type: 'cron', subject_id: key, trace_id })
    return c.json({ ok: true, data: { job: key, triggered: true }, trace_id }, 200)
  })

  // ── Secret rotation tracker ────────────────────────────────────────────────
  app.get('/ops/secrets', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const now = Date.now()
    let rows: Array<{ name: string; last_rotated_at: number | null; expires_at: number | null; last_used_at: number | null; rotation_requested_at: number | null }> = []
    try {
      const r = await c.env.DB.prepare(
        `SELECT name, last_rotated_at, expires_at, last_used_at, rotation_requested_at FROM secret_rotations ORDER BY name ASC`,
      ).all<typeof rows[number]>()
      rows = r.results ?? []
    } catch {
      /* table optional */
    }
    const secrets = rows.map((s) => ({
      ...s,
      // Visual status: red if expired, amber if expiring within 14 days.
      status: s.expires_at === null ? 'unknown' : s.expires_at < now ? 'expired' : s.expires_at - now < 14 * 24 * 60 * 60 * 1000 ? 'expiring' : 'ok',
    }))
    return c.json({ ok: true, data: { secrets }, trace_id }, 200)
  })

  app.post('/ops/secrets/:name/rotate', destructiveLimit, authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const name = c.req.param('name')
    const validated = await validateBody(c, Confirm)
    if ('error' in validated) return validated.error
    const now = Date.now()
    try {
      await c.env.DB.prepare(
        `INSERT INTO secret_rotations (name, rotation_requested_at, created_at)
         VALUES (?1, ?2, ?2)
         ON CONFLICT(name) DO UPDATE SET rotation_requested_at = ?2`,
      )
        .bind(name, now)
        .run()
    } catch {
      /* table optional — still audit */
    }
    await recordAuditEvent(c, { action: 'ops.secret_rotate', subject_type: 'secret', subject_id: name, trace_id })
    return c.json({ ok: true, data: { name, rotation_requested_at: now }, trace_id }, 200)
  })

  // ── Incidents ──────────────────────────────────────────────────────────────
  app.get('/ops/incidents', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const status = c.req.query('status')
    let rows: unknown[] = []
    try {
      const stmt = status
        ? c.env.DB.prepare(`SELECT id, severity, title, status, linked_metric, postmortem, created_at, closed_at FROM incidents WHERE status = ?1 ORDER BY severity ASC, created_at DESC LIMIT 100`).bind(status)
        : c.env.DB.prepare(`SELECT id, severity, title, status, linked_metric, postmortem, created_at, closed_at FROM incidents ORDER BY severity ASC, created_at DESC LIMIT 100`)
      const { results } = await stmt.all()
      rows = results ?? []
    } catch {
      /* table optional */
    }
    return c.json({ ok: true, data: { incidents: rows }, trace_id }, 200)
  })

  const CreateIncident = z.object({
    severity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    title: z.string().min(1).max(200),
    linked_metric: z.string().max(120).optional(),
  })
  app.post('/ops/incidents', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const validated = await validateBody(c, CreateIncident)
    if ('error' in validated) return validated.error
    const { severity, title, linked_metric } = validated.data
    const id = ulid()
    const now = Date.now()
    await c.env.DB.prepare(
      `INSERT INTO incidents (id, severity, title, status, linked_metric, created_by, created_at)
       VALUES (?1, ?2, ?3, 'open', ?4, ?5, ?6)`,
    )
      .bind(id, severity, title, linked_metric ?? null, c.get('user')?.sub ?? null, now)
      .run()
    await recordAuditEvent(c, { action: 'ops.incident_create', subject_type: 'incident', subject_id: id, after_snapshot: { severity, title }, trace_id })
    return c.json({ ok: true, data: { id, severity, title, status: 'open', created_at: now }, trace_id }, 201)
  })

  const CloseIncident = z.object({ postmortem: z.string().max(5000).optional() })
  app.post('/ops/incidents/:id/close', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const id = c.req.param('id')
    const validated = await validateBody(c, CloseIncident)
    if ('error' in validated) return validated.error
    const exists = await c.env.DB.prepare(`SELECT id FROM incidents WHERE id = ?1`).bind(id).first()
    if (!exists) return errorResponse(c, 404, 'not_found', 'Incident not found')
    const now = Date.now()
    await c.env.DB.prepare(`UPDATE incidents SET status = 'closed', closed_at = ?1, postmortem = ?2 WHERE id = ?3`)
      .bind(now, validated.data.postmortem ?? null, id)
      .run()
    await recordAuditEvent(c, { action: 'ops.incident_close', subject_type: 'incident', subject_id: id, trace_id })
    return c.json({ ok: true, data: { id, status: 'closed', closed_at: now }, trace_id }, 200)
  })

  // ── Backups ────────────────────────────────────────────────────────────────
  app.get('/ops/backups', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const kv = opsKv(c.env)
    const status = kv ? await readKvJson<{ last_backup_at: number; status: string; size_bytes?: number }>(kv, BACKUP_STATUS_KEY) : null
    return c.json({ ok: true, data: { backup: status ?? { last_backup_at: null, status: 'unknown' } }, trace_id }, 200)
  })

  app.post('/ops/backups/restore', destructiveLimit, authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const validated = await validateBody(c, Confirm)
    if ('error' in validated) return validated.error
    const kv = opsKv(c.env)
    const now = Date.now()
    if (kv) await writeKvJson(kv, 'ops:backup:restore_requested', { requested_at: now, by: c.get('user')?.sub ?? null }).catch(() => {})
    await recordAuditEvent(c, { action: 'ops.backup_restore', subject_type: 'backup', subject_id: 'd1-restore', after_snapshot: { requested_at: now }, trace_id })
    return c.json({ ok: true, data: { restore_requested_at: now }, trace_id }, 200)
  })

  // ── WAF crawler whitelist ──────────────────────────────────────────────────
  app.get('/ops/waf-whitelist', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const kv = opsKv(c.env)
    const list = (kv ? await readKvJson<string[]>(kv, WAF_WHITELIST_KEY) : null) ?? []
    return c.json({ ok: true, data: { patterns: list }, trace_id }, 200)
  })

  const WafWhitelist = z.object({ pattern: z.string().min(1).max(200) })
  app.post('/ops/waf-whitelist', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const validated = await validateBody(c, WafWhitelist)
    if ('error' in validated) return validated.error
    const kv = opsKv(c.env)
    if (!kv) return errorResponse(c, 503, 'unavailable', 'Ops KV not configured')
    const list = (await readKvJson<string[]>(kv, WAF_WHITELIST_KEY)) ?? []
    if (!list.includes(validated.data.pattern)) list.push(validated.data.pattern)
    await writeKvJson(kv, WAF_WHITELIST_KEY, list)
    await recordAuditEvent(c, { action: 'ops.waf_whitelist_update', subject_type: 'waf', subject_id: 'waf', after_snapshot: { pattern: validated.data.pattern }, trace_id })
    return c.json({ ok: true, data: { patterns: list }, trace_id }, 200)
  })
}
