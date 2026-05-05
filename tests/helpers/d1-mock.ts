// Lightweight in-memory D1 stub covering the exact SQL statements used by
// the v1 auth + session routes. Not a general-purpose D1 implementation —
// the query strings are pattern-matched literally. Extend it as new queries
// land.

type MagicLink = {
  token_hash: string
  email: string
  created_at: number
  expires_at: number
  consumed_at: number | null
  requester_ip: string | null
}

type User = {
  id: string
  email: string
  display_name: string | null
  created_at: number
  last_login_at: number | null
  plan: 'free' | 'starter' | 'team'
}

type SessionRow = {
  id: string
  owner_id: string
  code: string
  title: string
  status: 'draft' | 'live' | 'closed' | 'archived'
  anonymity: 'anonymous' | 'identified' | 'full' | 'partial' | 'none'
  vote_policy?: 'once' | 'multi' | 'react'
  session_mode?: 'reflection' | 'fun'
  created_at: number
  started_at: number | null
  closed_at: number | null
  archived_at: number | null
  team_id?: string | null
  ai_generated?: number
  ai_consent_at?: number | null
  ai_grounding_hash?: string | null
  ai_accepted_count?: number
  ai_dismissed_count?: number
}

type QuestionRow = {
  id: string
  session_id: string
  position: number
  kind: 'poll' | 'ranking' | 'consent' | 'open' | 'multi_select' | 'likert' | 'upvote' | 'word_cloud' | 'slider'
  prompt: string
  options_json: string
  created_at: number
}

type VoteRow = {
  id: string
  session_id: string
  question_id: string
  voter_id: string
  option_id: string
  submitted_at: number
}

type UserRole = {
  user_id: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
}

type AuditEvent = {
  id: string
  actor_id: string | null
  action: string
  subject_type: string
  subject_id: string
  before_snapshot: string
  after_snapshot: string
  ts: number
  trace_id: string
  idempotency_key: string | null
}

/** Mirrors `buildAuditEventWhereClause` filter order for integration tests. */
function filterAuditEventsForMock(rows: AuditEvent[], sql: string, filterArgs: unknown[]): AuditEvent[] {
  let i = 0
  let out = rows
  if (sql.includes('actor_id =')) {
    const v = filterArgs[i++] as string | null
    out = out.filter((r) => r.actor_id === v)
  }
  if (sql.includes('action =')) {
    const v = filterArgs[i++] as string
    out = out.filter((r) => r.action === v)
  }
  if (sql.includes('subject_type =')) {
    const v = filterArgs[i++] as string
    out = out.filter((r) => r.subject_type === v)
  }
  if (sql.includes('ts >= ')) {
    const v = filterArgs[i++] as number
    out = out.filter((r) => r.ts >= v)
  }
  if (sql.includes('ts <= ')) {
    const v = filterArgs[i++] as number
    out = out.filter((r) => r.ts <= v)
  }
  return out
}

type InsightsDailyRow = {
  id: string
  session_id: string
  day: string
  themes_json: string
  confidence: number
  n_votes: number
  computed_at: number
}

type Sprint19EventRow = {
  id: string
  event_name: string
  user_id: string
  session_id: string | null
  team_id: string | null
  plan: string | null
  count: number
  value: number
  duration_ms: number
  created_at: number
  trace_id: string
}

type CustomRoleRow = {
  id: string
  team_id: string
  name: string
  permissions_json: string
  created_by: string
  created_at: number
  updated_at: number
}

type TeamRoleAssignmentRow = {
  id: string
  team_id: string
  user_id: string
  role_id: string
  assigned_by: string
  assigned_at: number
}

export class D1Mock {
  readonly magicLinks = new Map<string, MagicLink>()
  readonly users = new Map<string, User>()
  readonly sessions = new Map<string, SessionRow>()
  readonly questions = new Map<string, QuestionRow>()
  readonly votes = new Map<string, VoteRow>()
  readonly userRoles = new Map<string, UserRole>()
  readonly auditEvents = new Map<string, AuditEvent>()
  readonly insightsDaily = new Map<string, InsightsDailyRow>()
  readonly sprint19Events = new Map<string, Sprint19EventRow>()
  readonly customRoles = new Map<string, CustomRoleRow>()
  readonly teamRoleAssignments = new Map<string, TeamRoleAssignmentRow>()

  prepare(sql: string): D1PreparedStatementMock {
    return new D1PreparedStatementMock(this, sql.trim())
  }

  async batch(statements: D1PreparedStatementMock[]): Promise<Array<{ meta: { changes: number } }>> {
    const out: Array<{ meta: { changes: number } }> = []
    for (const s of statements) out.push(await s.run())
    return out
  }
}

export class D1PreparedStatementMock {
  private args: unknown[] = []
  constructor(
    private readonly db: D1Mock,
    private readonly sql: string,
  ) {}

  bind(...args: unknown[]): this {
    this.args = args
    return this
  }

  async run(): Promise<{ meta: { changes: number } }> {
    if (this.sql.startsWith('INSERT INTO magic_links')) {
      const [token_hash, email, created_at, expires_at, requester_ip] = this.args as [
        string,
        string,
        number,
        number,
        string | null,
      ]
      this.db.magicLinks.set(token_hash, {
        token_hash,
        email,
        created_at,
        expires_at,
        consumed_at: null,
        requester_ip,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE magic_links SET consumed_at')) {
      const [consumed_at, token_hash] = this.args as [number, string]
      const row = this.db.magicLinks.get(token_hash)
      if (!row || row.consumed_at) return { meta: { changes: 0 } }
      row.consumed_at = consumed_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO users')) {
      // Two call shapes (both now use distinct ?N indices — no D1 parameter reuse):
      //   magic-link (4 args): id, email, created_at, last_login_at
      //   password signup (5 args): id, email, display_name, created_at, last_login_at
      const args = this.args as [string, string, string | number | null, number, number?]
      const [id, email] = args
      let display_name: string | null = null
      let created_at: number
      if (args.length >= 5) {
        // password signup: (id, email, display_name, created_at, last_login_at)
        display_name = (typeof args[2] === 'string' || args[2] === null) ? (args[2] as string | null) : null
        created_at = args[3] as number
      } else {
        // magic-link: (id, email, created_at, last_login_at)
        created_at = args[2] as number
      }
      this.db.users.set(id, {
        id,
        email,
        display_name,
        created_at,
        last_login_at: created_at,
        plan: 'free',
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE users SET last_login_at')) {
      const [last_login_at, id] = this.args as [number, string]
      const row = this.db.users.get(id)
      if (!row) return { meta: { changes: 0 } }
      row.last_login_at = last_login_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO sessions')) {
      const [id, owner_id, code, title] = this.args as [string, string, string, string]
      const hasExplicitAnonymity = this.sql.includes("VALUES (?1, ?2, ?3, ?4, 'draft', ?5, ?6)")
      const anonymity = hasExplicitAnonymity
        ? (this.args[4] as SessionRow['anonymity'])
        : 'full'
      const created_at = hasExplicitAnonymity ? (this.args[5] as number) : (this.args[4] as number)
      const team_id = this.args.length >= 6 && !hasExplicitAnonymity ? (this.args[5] as string | null) : null
      if ([...this.db.sessions.values()].some((s) => s.code === code)) {
        throw new Error('UNIQUE constraint failed: sessions.code')
      }
      this.db.sessions.set(id, {
        id,
        owner_id,
        code,
        title,
        status: 'draft',
        anonymity,
        created_at,
        started_at: null,
        closed_at: null,
        archived_at: null,
        team_id,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET title')) {
      const [title, id, owner_id] = this.args as [string, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.title = title
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET anonymity')) {
      const [anonymity, id, owner_id] = this.args as [SessionRow['anonymity'], string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.anonymity = anonymity
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET vote_policy')) {
      const [vote_policy, id, owner_id] = this.args as [NonNullable<SessionRow['vote_policy']>, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.vote_policy = vote_policy
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET session_mode')) {
      const [session_mode, id, owner_id] = this.args as [NonNullable<SessionRow['session_mode']>, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.session_mode = session_mode
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith("UPDATE sessions SET status = 'live'")) {
      const [started_at, id, owner_id] = this.args as [number, string, string]
      const row = this.db.sessions.get(id)
      // Mirrors the AND status = 'draft' guard in the production SQL — only
      // a draft session can transition; returns 0 changes if already live.
      if (!row || row.owner_id !== owner_id || row.status !== 'draft') return { meta: { changes: 0 } }
      row.status = 'live'
      row.started_at = started_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith("UPDATE sessions SET status = 'draft'")) {
      const [id] = this.args as [string]
      const row = this.db.sessions.get(id)
      if (!row) return { meta: { changes: 0 } }
      row.status = 'draft'
      row.started_at = null
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith("UPDATE sessions SET status = 'closed'")) {
      const [closed_at, id, owner_id] = this.args as [number, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.status = 'closed'
      row.closed_at = closed_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT OR IGNORE INTO votes')) {
      const [id, session_id, question_id, voter_id, option_id, submitted_at] = this.args as [
        string,
        string,
        string,
        string,
        string,
        number,
      ]
      // UNIQUE(question_id, voter_id) — ignore replay.
      for (const v of this.db.votes.values()) {
        if (v.question_id === question_id && v.voter_id === voter_id) {
          return { meta: { changes: 0 } }
        }
      }
      this.db.votes.set(id, { id, session_id, question_id, voter_id, option_id, submitted_at })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('DELETE FROM questions')) {
      const [session_id] = this.args as [string]
      let changes = 0
      for (const [qid, row] of this.db.questions) {
        if (row.session_id === session_id) {
          this.db.questions.delete(qid)
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('INSERT INTO questions')) {
      const [id, session_id] = this.args as [string, string]
      const hasExplicitPosition = this.args.length >= 7
      const position = hasExplicitPosition ? (this.args[2] as number) : 0
      const kind = this.args[hasExplicitPosition ? 3 : 2] as QuestionRow['kind']
      const prompt = this.args[hasExplicitPosition ? 4 : 3] as string
      const options_json = this.args[hasExplicitPosition ? 5 : 4] as string
      const created_at = this.args[hasExplicitPosition ? 6 : 5] as number
      this.db.questions.set(id, {
        id,
        session_id,
        position,
        kind,
        prompt,
        options_json,
        created_at,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE questions SET kind')) {
      const [kind, prompt, options_json, id, session_id] = this.args as [
        QuestionRow['kind'],
        string,
        string,
        string,
        string,
      ]
      const row = this.db.questions.get(id)
      if (!row || row.session_id !== session_id) return { meta: { changes: 0 } }
      row.kind = kind
      row.prompt = prompt
      row.options_json = options_json
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO audit_events')) {
      // INSERT INTO audit_events
      // (id, ts, actor_id, actor_ip, action, subject_type, subject_id, before_snapshot, after_snapshot, trace_id, idempotency_key)
      // VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
      // ON CONFLICT DO NOTHING
      const [id, ts, actor_id, _actor_ip, action, subject_type, subject_id, before_snapshot, after_snapshot, trace_id, idempotency_key] = this.args as [
        string,
        number,
        string | null,
        string | null,
        string,
        string,
        string,
        string,
        string,
        string,
        string | null,
      ]
      // Check for existing event with same trace_id + action + subject_id (ON CONFLICT behavior)
      for (const event of this.db.auditEvents.values()) {
        if (event.trace_id === trace_id && event.action === action && event.subject_id === subject_id) {
          // Conflict — return 0 changes per ON CONFLICT DO NOTHING
          return { meta: { changes: 0 } }
        }
      }
      this.db.auditEvents.set(id, {
        id,
        actor_id,
        action,
        subject_type,
        subject_id,
        before_snapshot,
        after_snapshot,
        ts,
        trace_id,
        idempotency_key,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO user_roles')) {
      // INSERT INTO user_roles (id, user_id, role, created_at)
      // VALUES (?1, ?2, ?3, ?4)
      // ON CONFLICT(user_id, role) DO NOTHING
      const [id, user_id, role] = this.args as [
        string,
        string,
        'owner' | 'admin' | 'member' | 'viewer',
      ]
      // Check for existing role
      for (const r of this.db.userRoles.values()) {
        if (r.user_id === user_id && r.role === role) {
          // Conflict — return 0 changes per ON CONFLICT DO NOTHING
          return { meta: { changes: 0 } }
        }
      }
      this.db.userRoles.set(id, { user_id, role })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET ai_grounding_hash')) {
      const [hash, id, owner_id] = this.args as [string, string, string | undefined]
      const row = this.db.sessions.get(id)
      if (!row || (owner_id !== undefined && row.owner_id !== owner_id)) return { meta: { changes: 0 } }
      row.ai_grounding_hash = hash
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET ai_generated')) {
      const [ai_generated, id, owner_id] = this.args as [number, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.ai_generated = ai_generated
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET ai_consent_at')) {
      const [ai_consent_at, id, owner_id] = this.args as [number, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.ai_consent_at = ai_consent_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET ai_accepted_count')) {
      const [ai_accepted_count, id, owner_id] = this.args as [number, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.ai_accepted_count = ai_accepted_count
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET ai_dismissed_count')) {
      const [ai_dismissed_count, id, owner_id] = this.args as [number, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.ai_dismissed_count = ai_dismissed_count
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO insights_daily')) {
      const [id, session_id, day, themes_json, confidence, n_votes, computed_at] = this.args as [
        string, string, string, string, number, number, number,
      ]
      this.db.insightsDaily.set(id, { id, session_id, day, themes_json, confidence, n_votes, computed_at })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO sprint19_events')) {
      const [id, event_name, user_id, session_id, team_id, plan, count, value, duration_ms, created_at, trace_id] = this.args as [
        string, string, string, string | null, string | null, string | null, number, number, number, number, string,
      ]
      this.db.sprint19Events.set(id, {
        id,
        event_name,
        user_id,
        session_id,
        team_id,
        plan,
        count,
        value,
        duration_ms,
        created_at,
        trace_id,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO custom_roles')) {
      const [id, team_id, name, permissions_json, created_by, created_at, updated_at] = this.args as [
        string, string, string, string, string, number, number,
      ]
      this.db.customRoles.set(id, { id, team_id, name, permissions_json, created_by, created_at, updated_at })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE custom_roles SET')) {
      const [name, permissions_json, updated_at, id, team_id] = this.args as [string, string, number, string, string]
      const row = this.db.customRoles.get(id)
      if (!row || row.team_id !== team_id) return { meta: { changes: 0 } }
      row.name = name
      row.permissions_json = permissions_json
      row.updated_at = updated_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('DELETE FROM team_role_assignments WHERE role_id')) {
      const [role_id, team_id] = this.args as [string, string]
      let changes = 0
      for (const [id, row] of this.db.teamRoleAssignments) {
        if (row.role_id === role_id && row.team_id === team_id) {
          this.db.teamRoleAssignments.delete(id)
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('DELETE FROM custom_roles')) {
      const [id, team_id] = this.args as [string, string]
      const row = this.db.customRoles.get(id)
      if (!row || row.team_id !== team_id) return { meta: { changes: 0 } }
      this.db.customRoles.delete(id)
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO team_role_assignments')) {
      const [id, team_id, user_id, role_id, assigned_by, assigned_at] = this.args as [
        string, string, string, string, string, number,
      ]
      for (const existing of this.db.teamRoleAssignments.values()) {
        if (existing.team_id === team_id && existing.user_id === user_id && existing.role_id === role_id) {
          return { meta: { changes: 0 } }
        }
      }
      this.db.teamRoleAssignments.set(id, { id, team_id, user_id, role_id, assigned_by, assigned_at })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('DELETE FROM team_role_assignments WHERE team_id')) {
      const [team_id, role_id, user_id] = this.args as [string, string, string]
      let changes = 0
      for (const [id, row] of this.db.teamRoleAssignments) {
        if (row.team_id === team_id && row.role_id === role_id && row.user_id === user_id) {
          this.db.teamRoleAssignments.delete(id)
          changes++
        }
      }
      return { meta: { changes } }
    }
    throw new Error(`d1-mock: unsupported run(): ${this.sql}`)
  }

  async first<T = unknown>(): Promise<T | null> {
    if (this.sql.startsWith('SELECT email, expires_at, consumed_at FROM magic_links')) {
      const [token_hash] = this.args as [string]
      const row = this.db.magicLinks.get(token_hash)
      return (row
        ? { email: row.email, expires_at: row.expires_at, consumed_at: row.consumed_at }
        : null) as T | null
    }
    if (this.sql.startsWith('SELECT id FROM users WHERE email')) {
      const [email] = this.args as [string]
      for (const u of this.db.users.values()) {
        if (u.email === email) return { id: u.id } as T
      }
      return null
    }
    if (this.sql.startsWith('SELECT plan FROM users WHERE id')) {
      const [id] = this.args as [string]
      const row = this.db.users.get(id)
      return (row ? { plan: row.plan } : null) as T | null
    }
    if (this.sql.startsWith('SELECT role FROM user_roles WHERE user_id')) {
      const [user_id] = this.args as [string]
      for (const r of this.db.userRoles.values()) {
        if (r.user_id === user_id && (r.role === 'owner' || r.role === 'admin')) {
          return { role: r.role } as T
        }
      }
      return null
    }
    if (this.sql.includes('FROM audit_events') && this.sql.includes('COUNT(*)')) {
      const filtered = filterAuditEventsForMock(
        [...this.db.auditEvents.values()],
        this.sql,
        this.args as unknown[],
      )
      if (this.sql.includes(' as n ')) return { n: filtered.length } as T
      return { count: filtered.length } as T
    }
    if (this.sql.startsWith('SELECT COUNT(*) as n FROM sessions')) {
      let rows = [...this.db.sessions.values()]
      const hasRange = this.sql.includes('created_at >= ?1') && this.args.length >= 2
      if (hasRange) {
        const [start, end] = this.args as [number, number]
        rows = rows.filter((s) => s.created_at >= start && s.created_at <= end)
      }
      if (this.sql.includes('ai_generated = 1')) {
        rows = rows.filter((s) => s.ai_generated === 1)
      }
      if (this.sql.includes('ai_consent_at IS NOT NULL')) {
        rows = rows.filter((s) => s.ai_consent_at !== null && s.ai_consent_at !== undefined)
      }
      if (this.sql.includes('ai_grounding_hash IS NOT NULL')) {
        rows = rows.filter((s) => !!s.ai_grounding_hash)
      }
      if (this.sql.includes("status IN ('live','closed','archived')")) {
        rows = rows.filter((s) => s.status === 'live' || s.status === 'closed' || s.status === 'archived')
      }
      if (this.sql.includes("status = 'draft'")) {
        rows = rows.filter((s) => s.status === 'draft')
      }
      return { n: rows.length } as T
    }
    if (this.sql.startsWith('SELECT COALESCE(SUM(ai_accepted_count)')) {
      let rows = [...this.db.sessions.values()]
      const hasRange = this.sql.includes('created_at >= ?1') && this.args.length >= 2
      if (hasRange) {
        const [start, end] = this.args as [number, number]
        rows = rows.filter((s) => s.created_at >= start && s.created_at <= end)
      }
      rows = rows.filter((s) => s.ai_generated === 1)
      const accepted = rows.reduce((sum, s) => sum + (s.ai_accepted_count ?? 0), 0)
      const dismissed = rows.reduce((sum, s) => sum + (s.ai_dismissed_count ?? 0), 0)
      return { accepted, dismissed } as T
    }
    if (this.sql.startsWith('SELECT AVG(CASE WHEN anonymity')) {
      const [since] = this.args as [number]
      const rows = [...this.db.sessions.values()].filter((s) => s.created_at >= since)
      const rate = rows.length === 0
        ? null
        : rows.reduce((sum, s) => sum + (s.anonymity !== 'none' ? 1 : 0), 0) / rows.length
      return { rate } as T
    }
    if (this.sql.startsWith('SELECT COUNT(*)')) {
      return { count: 0 } as T
    }
    if (this.sql.startsWith('SELECT id, team_id, name, permissions_json')) {
      const [id, team_id] = this.args as [string, string]
      const row = this.db.customRoles.get(id)
      return (row && row.team_id === team_id ? row : null) as T | null
    }
    if (this.sql.startsWith('SELECT id, owner_id, code, title, status, anonymity')) {
      const [id, owner_id] = this.args as [string, string | undefined]
      const row = this.db.sessions.get(id)
      if (owner_id === undefined) return (row as unknown as T) ?? null
      return (row && row.owner_id === owner_id ? (row as unknown as T) : null)
    }
    throw new Error(`d1-mock: unsupported first(): ${this.sql}`)
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    if (this.sql.startsWith('SELECT role FROM user_roles WHERE user_id')) {
      const [user_id] = this.args as [string]
      const rows = [...this.db.userRoles.values()].filter((r) => r.user_id === user_id)
      return { results: rows.map((r) => ({ role: r.role })) as unknown as T[] }
    }
    if (this.sql.includes('FROM audit_events') && this.sql.includes('ORDER BY ts DESC')) {
      const args = [...this.args] as unknown[]
      const offset = Number(args.pop())
      const limit = Number(args.pop())
      let rows = [...this.db.auditEvents.values()]
      rows = filterAuditEventsForMock(rows, this.sql, args)
      rows.sort((a, b) => b.ts - a.ts)
      const slice = rows.slice(offset, offset + limit)
      return {
        results: slice.map((r) => ({
          ...r,
          actor_ip: null,
        })) as unknown as T[],
      }
    }
    if (this.sql.includes('FROM audit_events') && this.sql.includes('GROUP BY action')) {
      let rows = [...this.db.auditEvents.values()]
      if (this.sql.includes('action IN')) {
        const matches = [...this.sql.matchAll(/'([^']+)'/g)].map((match) => match[1])
        const allowed = new Set(matches)
        rows = rows.filter((row) => allowed.has(row.action))
      }
      const counts = new Map<string, number>()
      for (const row of rows) counts.set(row.action, (counts.get(row.action) ?? 0) + 1)
      return {
        results: [...counts.entries()].map(([action, count]) => ({ action, count })) as unknown as T[],
      }
    }
    if (this.sql.startsWith('SELECT * FROM audit_events')) {
      // Return all audit events (filters handled by caller if needed)
      const rows = [...this.db.auditEvents.values()]
      return { results: rows as unknown as T[] }
    }
    if (this.sql.startsWith('SELECT COUNT(*)')) {
      return { results: [] as T[] }
    }
    if (this.sql.startsWith('SELECT bucket_ts')) {
      return { results: [] as T[] }
    }
    if (this.sql.startsWith("SELECT DATE(created_at / 1000, 'unixepoch') as day")) {
      const [since] = this.args as [number]
      const counts = new Map<string, number>()
      for (const session of this.db.sessions.values()) {
        if (session.created_at < since) continue
        const day = new Date(session.created_at).toISOString().slice(0, 10)
        counts.set(day, (counts.get(day) ?? 0) + 1)
      }
      return {
        results: [...counts.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, count]) => ({ day, count })) as unknown as T[],
      }
    }
    if (this.sql.startsWith("SELECT DATE(ts / 1000, 'unixepoch') as day")) {
      const [since] = this.args as [number]
      const rows = [...this.db.auditEvents.values()]
        .filter((event) => event.action === 'insights.generate' && event.ts >= since)
      const counts = new Map<string, number>()
      for (const event of rows) {
        const day = new Date(event.ts).toISOString().slice(0, 10)
        counts.set(day, (counts.get(day) ?? 0) + 1)
      }
      return {
        results: [...counts.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, count]) => ({ day, count })) as unknown as T[],
      }
    }
    if (this.sql.startsWith('SELECT status, COUNT(*) as count FROM sessions')) {
      const counts = new Map<string, number>()
      for (const session of this.db.sessions.values()) counts.set(session.status, (counts.get(session.status) ?? 0) + 1)
      return {
        results: [...counts.entries()].map(([status, count]) => ({ status, count })) as unknown as T[],
      }
    }
    if (this.sql.startsWith('SELECT id, owner_id, code, title, status, anonymity')) {
      // List form: WHERE owner_id = ?1 AND status != 'archived'
      const [owner_id] = this.args as [string]
      const rows = [...this.db.sessions.values()]
        .filter((s) => s.owner_id === owner_id && s.status !== 'archived')
        .sort((a, b) => b.created_at - a.created_at)
      return { results: rows as unknown as T[] }
    }
    if (
      this.sql.startsWith(
        'SELECT id, session_id, position, kind, prompt, options_json, created_at',
      )
    ) {
      const [session_id] = this.args as [string]
      const rows = [...this.db.questions.values()]
        .filter((q) => q.session_id === session_id)
        .sort((a, b) => a.position - b.position)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.startsWith('SELECT option_id, COUNT(*)')) {
      const [session_id] = this.args as [string]
      const tally = new Map<string, number>()
      for (const v of this.db.votes.values()) {
        if (v.session_id !== session_id) continue
        tally.set(v.option_id, (tally.get(v.option_id) ?? 0) + 1)
      }
      const rows = [...tally.entries()].map(([option_id, n]) => ({ option_id, n }))
      return { results: rows as unknown as T[] }
    }
    if (this.sql.startsWith('SELECT day, themes_json, confidence, n_votes')) {
      // insights_daily fetch — ignore date filter (mock, not SQLite).
      const [session_id] = this.args as [string, string]
      const rows = [...this.db.insightsDaily.values()]
        .filter((r) => r.session_id === session_id)
        .sort((a, b) => b.day.localeCompare(a.day))
      return { results: rows as unknown as T[] }
    }
    if (this.sql.startsWith('SELECT event_name, COUNT(*) as n FROM sprint19_events')) {
      let rows = [...this.db.sprint19Events.values()]
      const hasRange = this.sql.includes('created_at >= ?1') && this.args.length >= 2
      if (hasRange) {
        const [start, end] = this.args as [number, number]
        rows = rows.filter((r) => r.created_at >= start && r.created_at <= end)
      }
      const counts = new Map<string, number>()
      for (const row of rows) counts.set(row.event_name, (counts.get(row.event_name) ?? 0) + 1)
      return {
        results: [...counts.entries()].map(([event_name, n]) => ({ event_name, n })) as unknown as T[],
      }
    }
    if (this.sql.startsWith('SELECT cr.permissions_json')) {
      const [team_id, user_id] = this.args as [string, string]
      const roleIds = [...this.db.teamRoleAssignments.values()]
        .filter((row) => row.team_id === team_id && row.user_id === user_id)
        .map((row) => row.role_id)
      const rows = roleIds
        .map((id) => this.db.customRoles.get(id))
        .filter((row): row is CustomRoleRow => !!row && row.team_id === team_id)
        .map((row) => ({ permissions_json: row.permissions_json }))
      return { results: rows as unknown as T[] }
    }
    if (this.sql.startsWith('SELECT id, team_id, name, permissions_json')) {
      const [team_id] = this.args as [string]
      const rows = [...this.db.customRoles.values()]
        .filter((row) => row.team_id === team_id)
        .sort((a, b) => a.created_at - b.created_at)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.startsWith('SELECT id, team_id, user_id, role_id')) {
      const [team_id] = this.args as [string]
      const rows = [...this.db.teamRoleAssignments.values()]
        .filter((row) => row.team_id === team_id)
        .sort((a, b) => a.assigned_at - b.assigned_at)
      return { results: rows as unknown as T[] }
    }
    throw new Error(`d1-mock: unsupported all(): ${this.sql}`)
  }
}
