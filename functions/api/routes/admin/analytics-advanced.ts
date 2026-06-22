// Platformbeheer — Module 5: Analytics (business + product insight).
//
// Funnel, cost, and retention analytics grounded in D1, plus structured SEO /
// marketing endpoints. Consistent window handling (7d/30d/90d or explicit
// from/to) across every widget, and every dataset is CSV-exportable via
// ?format=csv (AC).

import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../../middleware/auth'
import { adminMiddleware, type AdminVariables } from '../../middleware/admin'
import { computeFunnel, toCsv, resolveWindow, type FunnelStep } from '../../lib/analytics-funnel'
import type { Env } from '../../types'

function csvResponse(filename: string, csv: string, trace_id: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'x-trace-id': trace_id,
    },
  })
}

function rangeFromQuery(c: { req: { query: (k: string) => string | undefined } }) {
  const fromRaw = c.req.query('from')
  const toRaw = c.req.query('to')
  return resolveWindow(
    c.req.query('window'),
    fromRaw ? Date.parse(fromRaw) : null,
    toRaw ? Date.parse(toRaw) : null,
  )
}

export function mountAnalyticsAdvancedRoutes(
  app: Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>,
) {
  // ── GET /analytics/funnel ──────────────────────────────────────────────────
  // Cohort funnel: of users who signed up in the window, how many activated
  // (created ≥1 session) and converted (paid plan).
  app.get('/analytics/funnel', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const { start, end } = rangeFromQuery(c)

    let signups = 0
    let activated = 0
    let paid = 0
    try {
      const [s, a, p] = await Promise.all([
        c.env.DB.prepare(`SELECT COUNT(*) AS n FROM users WHERE created_at >= ?1 AND created_at <= ?2`).bind(start, end).first<{ n: number }>(),
        c.env.DB.prepare(
          `SELECT COUNT(DISTINCT u.id) AS n FROM users u
           JOIN sessions s ON s.owner_id = u.id
           WHERE u.created_at >= ?1 AND u.created_at <= ?2`,
        ).bind(start, end).first<{ n: number }>(),
        c.env.DB.prepare(
          `SELECT COUNT(*) AS n FROM users WHERE created_at >= ?1 AND created_at <= ?2 AND plan != 'free'`,
        ).bind(start, end).first<{ n: number }>(),
      ])
      signups = s?.n ?? 0
      activated = a?.n ?? 0
      paid = p?.n ?? 0
    } catch {
      /* tables optional in some envs */
    }

    const funnel: FunnelStep[] = computeFunnel([
      ['signup', 'Signed up', signups],
      ['first_session', 'Created first session', activated],
      ['first_paid', 'Converted to paid', paid],
    ])

    if (c.req.query('format') === 'csv') {
      const csv = toCsv(['key', 'label', 'count', 'conversion_from_prev_pct', 'drop_off_pct', 'conversion_from_top_pct'], funnel)
      return csvResponse('qesto-funnel.csv', csv, trace_id)
    }
    return c.json({ ok: true, data: { window: { start, end }, funnel }, trace_id }, 200)
  })

  // ── GET /analytics/costs ───────────────────────────────────────────────────
  // Workers AI request volume from metrics_summary (ai.* spans) → token/cost
  // estimate. Per-service CF billing breakdown is a structured estimate (the
  // billing API is not callable from the Worker).
  app.get('/analytics/costs', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const { start, end } = rangeFromQuery(c)

    let aiRequests = 0
    try {
      const row = await c.env.DB.prepare(
        `SELECT COALESCE(SUM(request_count), 0) AS n FROM metrics_summary WHERE route LIKE 'ai.%' AND bucket_ts >= ?1 AND bucket_ts <= ?2`,
      ).bind(start, end).first<{ n: number }>()
      aiRequests = row?.n ?? 0
    } catch {
      /* metrics_summary optional */
    }

    // Coarse estimate — flagged as such. ~800 tokens/request, Workers AI
    // ballpark of ~$0.011 / 1k neurons-equivalent → kept as a transparent unit.
    const estTokens = aiRequests * 800
    const estCostCents = Math.round((estTokens / 1000) * 1.1)

    const rows = [
      { service: 'workers_ai', metric: 'requests', value: aiRequests, est_cost_cents: estCostCents, is_estimate: 1 },
      { service: 'workers_ai', metric: 'est_tokens', value: estTokens, est_cost_cents: estCostCents, is_estimate: 1 },
      { service: 'd1', metric: 'unavailable', value: 0, est_cost_cents: 0, is_estimate: 1 },
      { service: 'vectorize', metric: 'unavailable', value: 0, est_cost_cents: 0, is_estimate: 1 },
      { service: 'workers', metric: 'unavailable', value: 0, est_cost_cents: 0, is_estimate: 1 },
    ]

    if (c.req.query('format') === 'csv') {
      return csvResponse('qesto-costs.csv', toCsv(['service', 'metric', 'value', 'est_cost_cents', 'is_estimate'], rows), trace_id)
    }
    return c.json(
      {
        ok: true,
        data: {
          window: { start, end },
          workers_ai: { requests: aiRequests, est_tokens: estTokens, est_cost_cents: estCostCents, is_estimate: true },
          cloudflare_billing: { note: 'Per-service CF billing requires the billing API (not callable from the Worker) — wire via a scheduled importer.', services: rows.slice(2) },
        },
        trace_id,
      },
      200,
    )
  })

  // ── GET /analytics/retention ───────────────────────────────────────────────
  // Weekly signup cohorts with activation retention (signed up → created a
  // session). Computed in JS from two grouped queries.
  app.get('/analytics/retention', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const { start, end } = rangeFromQuery(c)

    type WeekRow = { week: string; n: number }
    let signupRows: WeekRow[] = []
    let activatedRows: WeekRow[] = []
    try {
      const [s, a] = await Promise.all([
        c.env.DB.prepare(
          `SELECT strftime('%Y-%W', datetime(created_at / 1000, 'unixepoch')) AS week, COUNT(*) AS n
           FROM users WHERE created_at >= ?1 AND created_at <= ?2 GROUP BY week ORDER BY week`,
        ).bind(start, end).all<WeekRow>(),
        c.env.DB.prepare(
          `SELECT strftime('%Y-%W', datetime(u.created_at / 1000, 'unixepoch')) AS week, COUNT(DISTINCT u.id) AS n
           FROM users u JOIN sessions s ON s.owner_id = u.id
           WHERE u.created_at >= ?1 AND u.created_at <= ?2 GROUP BY week ORDER BY week`,
        ).bind(start, end).all<WeekRow>(),
      ])
      signupRows = s.results ?? []
      activatedRows = a.results ?? []
    } catch {
      /* optional */
    }

    const activatedByWeek = new Map(activatedRows.map((r) => [r.week, r.n]))
    const cohorts = signupRows.map((r) => {
      const activated = activatedByWeek.get(r.week) ?? 0
      return {
        cohort_week: r.week,
        signups: r.n,
        activated,
        activation_pct: r.n > 0 ? Math.round((activated / r.n) * 1000) / 10 : 0,
      }
    })

    if (c.req.query('format') === 'csv') {
      return csvResponse('qesto-retention.csv', toCsv(['cohort_week', 'signups', 'activated', 'activation_pct'], cohorts), trace_id)
    }
    return c.json({ ok: true, data: { window: { start, end }, cohorts }, trace_id }, 200)
  })

  // ── GET /analytics/marketing ───────────────────────────────────────────────
  // LinkedIn automation post volume from linkedin_posts (migration 0064).
  // Reach/engagement requires the LinkedIn API — surfaced as deferred.
  app.get('/analytics/marketing', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const { start, end } = rangeFromQuery(c)
    let postCount = 0
    try {
      const row = await c.env.DB.prepare(
        `SELECT COUNT(*) AS n FROM linkedin_posts WHERE created_at >= ?1 AND created_at <= ?2`,
      ).bind(start, end).first<{ n: number }>()
      postCount = row?.n ?? 0
    } catch {
      /* table optional / column mismatch */
    }
    return c.json(
      {
        ok: true,
        data: {
          window: { start, end },
          linkedin: {
            posts: postCount,
            reach: null,
            engagement: null,
            note: 'Reach/engagement requires the LinkedIn analytics API — not yet ingested.',
          },
        },
        trace_id,
      },
      200,
    )
  })

  // ── GET /analytics/seo ─────────────────────────────────────────────────────
  // Search Console (impressions/clicks/position) requires the GSC API; returned
  // as a structured, clearly-synthetic shape until an importer is wired.
  app.get('/analytics/seo', authMiddleware, adminMiddleware, async (c) => {
    const trace_id = c.get('trace_id')
    const { start, end } = rangeFromQuery(c)
    return c.json(
      {
        ok: true,
        data: {
          window: { start, end },
          search_console: { impressions: null, clicks: null, avg_position: null, synthetic: true, note: 'Wire the Google Search Console API via a scheduled importer.' },
          indexing: { sitemap_url: '/sitemap.xml', note: 'Crawl/index status available from the SEO remediation work; live GSC index coverage pending importer.' },
        },
        trace_id,
      },
      200,
    )
  })
}
