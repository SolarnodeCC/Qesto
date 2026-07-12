/**
 * Marketing template repository (ADR-0069).
 *
 * D1 access for the Growth Engine gallery: registry aggregate stats (admin
 * growth dashboard) and the "use this template" flow, which provisions a real
 * draft session for a visitor. Pure functions taking `D1Database` + params —
 * no Hono context, no Env.
 *
 * The template registry row read/write helpers themselves live in
 * `lib/templates-kv.ts` alongside the KV blob store; this module holds the
 * queries that would otherwise sit inline in route handlers.
 */

export interface MarketingTemplateTotals {
  total: number
  active: number
  discarded: number
  total_uses: number
  /** ms epoch of the newest non-discarded template, or null. */
  last_created_at: number | null
}

/** Aggregate counts for the admin growth dashboard. */
export async function marketingTemplateTotals(db: D1Database): Promise<MarketingTemplateTotals> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_discarded = 0 THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN is_discarded = 1 THEN 1 ELSE 0 END) AS discarded,
              SUM(CASE WHEN is_discarded = 0 THEN usage_count ELSE 0 END) AS total_uses,
              MAX(CASE WHEN is_discarded = 0 THEN created_at ELSE NULL END) AS last_created_at
         FROM marketing_templates`,
    )
    .first<{ total: number; active: number | null; discarded: number | null; total_uses: number | null; last_created_at: number | null }>()
  return {
    total: row?.total ?? 0,
    active: row?.active ?? 0,
    discarded: row?.discarded ?? 0,
    total_uses: row?.total_uses ?? 0,
    last_created_at: row?.last_created_at ?? null,
  }
}

/** Published, non-discarded template counts grouped by industry. */
export async function marketingTemplateIndustryCounts(db: D1Database): Promise<Array<{ industry: string; n: number }>> {
  const { results } = await db
    .prepare(
      `SELECT industry, COUNT(*) AS n FROM marketing_templates
        WHERE is_discarded = 0 GROUP BY industry`,
    )
    .all<{ industry: string; n: number }>()
  return results ?? []
}

/** Resolve an email to a user id, or null. */
export async function findUserIdByEmail(db: D1Database, email: string): Promise<string | null> {
  const row = await db.prepare(`SELECT id FROM users WHERE email = ?1`).bind(email).first<{ id: string }>()
  return row?.id ?? null
}

/** Create a free-plan user (used when a gallery visitor is new). */
export async function insertFreeUser(db: D1Database, id: string, email: string, now: number): Promise<void> {
  await db
    .prepare(`INSERT INTO users (id, email, created_at, last_login_at, plan) VALUES (?1, ?2, ?3, ?4, 'free')`)
    .bind(id, email, now, now)
    .run()
}

export interface DraftSessionInsert {
  id: string
  ownerId: string
  code: string
  title: string
  now: number
  teamId: string | null
}

/** Insert a draft reflection session; throws on a join-code UNIQUE collision. */
export async function insertDraftSession(db: D1Database, s: DraftSessionInsert): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sessions (id, owner_id, code, title, status, anonymity, vote_policy, session_mode, created_at, team_id)
       VALUES (?1, ?2, ?3, ?4, 'draft', 'full', 'once', 'reflection', ?5, ?6)`,
    )
    .bind(s.id, s.ownerId, s.code, s.title, s.now, s.teamId)
    .run()
}

export interface TemplateQuestionInsert {
  id: string
  sessionId: string
  position: number
  kind: string
  prompt: string
  optionsJson: string
  now: number
}

/** Insert one question of a template-instantiated session. */
export async function insertSessionQuestion(db: D1Database, q: TemplateQuestionInsert): Promise<void> {
  await db
    .prepare(
      `INSERT INTO questions (id, session_id, position, kind, prompt, options_json, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(q.id, q.sessionId, q.position, q.kind, q.prompt, q.optionsJson, q.now)
    .run()
}

export interface MagicLinkInsert {
  tokenHash: string
  email: string
  now: number
  expiresAt: number
  ip: string | null
}

/** Mint a one-time sign-in link row (same table the auth callback consumes). */
export async function insertMagicLink(db: D1Database, m: MagicLinkInsert): Promise<void> {
  await db
    .prepare(
      `INSERT INTO magic_links (token_hash, email, created_at, expires_at, requester_ip)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(m.tokenHash, m.email, m.now, m.expiresAt, m.ip)
    .run()
}
