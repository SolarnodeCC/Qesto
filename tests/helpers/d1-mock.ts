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
  status: 'draft' | 'energizing' | 'live' | 'closed' | 'archived'
  anonymity: 'anonymous' | 'identified' | 'full' | 'partial' | 'none' | 'zero_knowledge'
  vote_policy?: 'once' | 'multi' | 'react'
  session_mode?: 'reflection' | 'fun' | 'townhall' | 'stage' | 'retro' | 'ideate' | 'deliberate'
  townhall_moderation?: 'pre' | 'post' | null
  created_at: number
  started_at: number | null
  closed_at: number | null
  archived_at: number | null
  team_id?: string | null
  workspace_id?: string | null
  workspace_seq?: number | null
  ai_generated?: number
  ai_consent_at?: number | null
  ai_grounding_hash?: string | null
  ai_accepted_count?: number
  ai_dismissed_count?: number
}

export type TownhallQuestionRow = {
  id: string
  session_id: string
  body: string
  display_name: string | null
  author_hash: string
  status: string
  upvotes: number
  group_parent: string | null
  was_spotlit: number
  created_at: number
  resolved_at: number | null
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

type EnergizerRow = {
  id: string
  session_id: string
  kind: string
  prompt: string
  options_json: string
  config_json: string
  position: number
  state: string
  created_at: number
  updated_at: number
}

type InsightsDailyRow = {
  id: string
  session_id: string
  team_id?: string | null
  day: string
  themes_json: string
  confidence: number
  n_votes: number
  embedding_ref?: number
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

type EmbedWidgetRow = {
  id: string
  team_id: string
  session_id: string
  session_code: string
  allowed_origins: string // JSON TEXT
  scope: string
  created_by: string
  created_at: number
  revoked_at: number | null
}

export class D1Mock {
  readonly magicLinks = new Map<string, MagicLink>()
  readonly users = new Map<string, User>()
  readonly sessions = new Map<string, SessionRow>()
  readonly questions = new Map<string, QuestionRow>()
  readonly votes = new Map<string, VoteRow>()
  readonly userRoles = new Map<string, UserRole>()
  // #586: platform-admin authority lives in its own table, distinct from team roles.
  readonly platformRoles = new Map<string, { user_id: string; role: string }>()
  readonly auditEvents = new Map<string, AuditEvent>()
  readonly insightsDaily = new Map<string, InsightsDailyRow>()
  readonly sprint19Events = new Map<string, Sprint19EventRow>()
  readonly customRoles = new Map<string, CustomRoleRow>()
  readonly teamRoleAssignments = new Map<string, TeamRoleAssignmentRow>()
  readonly townhallQuestions = new Map<string, TownhallQuestionRow>()
  readonly embedWidgets = new Map<string, EmbedWidgetRow>()
  readonly studioLibraryItems = new Map<
    string,
    {
      id: string
      team_id: string
      created_by: string
      source: 'authored' | 'fork'
      forked_from_id: string | null
      question_json: string
      theme_id: string | null
      title: string
      use_count: number
      created_at: number
      updated_at: number
    }
  >()
  readonly deliberateBallots = new Map<
    string,
    {
      id: string
      session_id: string
      ballot_nonce: string
      commitment: string
      choice: string
      voter_hash: string
      leaf_index: number
      created_at: number
    }
  >()
  readonly deliberateBallotCountOverrides: number[] = []
  readonly energizers = new Map<string, EnergizerRow>()
  // Keyed `${energizer_id}:${voter_id}` — mirrors UNIQUE(energizer_id, voter_id).
  readonly energizerVotes = new Map<
    string,
    { id: string; energizer_id: string; session_id: string; voter_id: string; value: string; created_at: number }
  >()
  // Keyed `${energizer_id}:${voter_id}:${question_index}` — mirrors the table's UNIQUE constraint.
  readonly teamQuizResponses = new Map<
    string,
    { id: string; energizer_id: string; voter_id: string; question_index: number; value: string; correct: number; created_at: number }
  >()
  readonly stripeWebhookEvents = new Map<
    string,
    { stripe_event_id: string; event_type: string; processed_at: number }
  >()
  readonly deviceTokens = new Map<
    string,
    {
      id: string
      user_id: string
      platform: string
      token: string
      app_version: string | null
      locale: string | null
      created_at: number
      last_seen_at: number
      revoked_at: number | null
    }
  >()
  readonly teamInsightRollups = new Map<
    string,
    { team_id: string; kind: string; window: string; payload_json: string; computed_at: number }
  >()
  readonly pulseSessionRollups = new Map<
    string,
    {
      session_id: string
      team_id: string | null
      workspace_id: string | null
      closed_at: number
      participant_count: number
      vote_count: number
      participation_rate: number
      sentiment_score: number | null
      payload_json: string
      computed_at: number
    }
  >()
  readonly pulseTeamDaily = new Map<
    string,
    {
      team_id: string
      day: string
      participation_avg: number
      sentiment_avg: number | null
      session_count: number
      response_total: number
      computed_at: number
    }
  >()
  readonly partnerPaymentAccounts = new Map<
    string,
    {
      team_id: string
      stripe_account_id: string | null
      account_type: string
      status: string
      charges_enabled: number
      payouts_enabled: number
      default_payout_currency: string | null
      created_at: number
      updated_at: number
    }
  >()
  readonly marketplaceListings = new Map<
    string,
    {
      id: string
      partner_team_id: string
      kind: string
      title: string
      description: string | null
      price_cents: number
      currency: string
      revenue_share_bps: number
      status: string
      visibility: string
      created_at: number
      updated_at: number
      published_at: number | null
    }
  >()
  readonly workspaces = new Map<
    string,
    {
      id: string
      team_id: string
      kind: string
      title: string
      template_json: string
      cadence: string | null
      retention_days: number | null
      last_instance_at: number | null
      archived_at: number | null
      created_by: string
      created_at: number
      updated_at: number
    }
  >()
  readonly workspaceTrends = new Map<
    string,
    {
      workspace_id: string
      kind: string
      window: string
      payload_json: string
      computed_at: number
    }
  >()
  readonly agentDefinitions = new Map<
    string,
    {
      id: string
      owner_id: string
      marketplace_listing_id: string | null
      title: string
      model: string
      tools_json: string
      sandbox_policy_json: string
      status: string
      created_at: number
      updated_at: number
    }
  >()
  readonly marketplacePurchases = new Map<
    string,
    {
      id: string
      buyer_team_id: string
      listing_id: string
      amount_cents: number
      currency: string
      purchased_at: number
      refunded_at: number | null
    }
  >()
  readonly marketingTemplates = new Map<
    string,
    {
      id: string
      source_session_id: string
      content_hash: string
      industry: string
      theme: string
      topic: string
      title_en: string
      question_count: number
      estimated_minutes: number
      confidence: number
      langs: string
      is_public: number
      is_discarded: number
      usage_count: number
      created_at: number
      updated_at: number
    }
  >()

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

  private marketingTemplateRows() {
    return [...this.db.marketingTemplates.values()]
  }

  /** Apply the dynamic WHERE from listTemplates, consuming filter args in order. */
  private filterMarketingTemplates(rows: ReturnType<D1PreparedStatementMock['marketingTemplateRows']>) {
    let out = rows.filter((r) => r.is_discarded === 0)
    let i = 0
    if (this.sql.includes('is_public = 1')) out = out.filter((r) => r.is_public === 1)
    if (this.sql.includes('industry = ?')) {
      const v = this.args[i++] as string
      out = out.filter((r) => r.industry === v)
    }
    if (this.sql.includes('theme = ?')) {
      const v = this.args[i++] as string
      out = out.filter((r) => r.theme === v)
    }
    if (this.sql.includes('instr(langs')) {
      const v = this.args[i++] as string
      out = out.filter((r) => r.langs.includes(v))
    }
    return out
  }

  async run(): Promise<{ meta: { changes: number } }> {
    if (this.sql.startsWith('INSERT INTO marketing_templates')) {
      const [
        id, source_session_id, content_hash, industry, theme, topic, title_en,
        question_count, estimated_minutes, confidence, langs,
        is_public, is_discarded, usage_count, created_at, updated_at,
      ] = this.args as [
        string, string, string, string, string, string, string,
        number, number, number, string, number, number, number, number, number,
      ]
      // ON CONFLICT(content_hash) DO NOTHING — dedup gate.
      for (const row of this.db.marketingTemplates.values()) {
        if (row.content_hash === content_hash) return { meta: { changes: 0 } }
      }
      this.db.marketingTemplates.set(id, {
        id, source_session_id, content_hash, industry, theme, topic, title_en,
        question_count, estimated_minutes, confidence, langs,
        is_public, is_discarded, usage_count, created_at, updated_at,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE marketing_templates SET is_public')) {
      const [is_public, updated_at, id] = this.args as [number, number, string]
      const row = this.db.marketingTemplates.get(id)
      if (!row || row.is_discarded === 1) return { meta: { changes: 0 } }
      row.is_public = is_public
      row.updated_at = updated_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE marketing_templates SET is_discarded')) {
      const [updated_at, id] = this.args as [number, string]
      const row = this.db.marketingTemplates.get(id)
      if (!row) return { meta: { changes: 0 } }
      row.is_discarded = 1
      row.is_public = 0
      row.updated_at = updated_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE marketing_templates SET usage_count')) {
      const [id] = this.args as [string]
      const row = this.db.marketingTemplates.get(id)
      if (!row) return { meta: { changes: 0 } }
      row.usage_count += 1
      return { meta: { changes: 1 } }
    }
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
      const isWorkspaceInstance = this.sql.includes('workspace_id, workspace_seq')
      const isTemplateInstance = this.sql.includes('vote_policy, session_mode')
      const hasExplicitAnonymity = this.sql.includes("VALUES (?1, ?2, ?3, ?4, 'draft', ?5, ?6)")
      const anonymity = hasExplicitAnonymity
        ? (this.args[4] as SessionRow['anonymity'])
        : 'full'
      const created_at = isWorkspaceInstance
        ? (this.args[5] as number)
        : hasExplicitAnonymity
          ? (this.args[5] as number)
          : (this.args[4] as number)
      const team_id = isWorkspaceInstance
        ? (this.args[6] as string | null)
        : this.args.length >= 6 && !hasExplicitAnonymity
          ? (this.args[5] as string | null)
          : null
      const workspace_id = isWorkspaceInstance ? (this.args[7] as string) : null
      const workspace_seq = isWorkspaceInstance ? (this.args[8] as number) : null
      if ([...this.db.sessions.values()].some((s) => s.code === code)) {
        throw new Error('UNIQUE constraint failed: sessions.code')
      }
      const row: SessionRow = {
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
        workspace_id,
        workspace_seq,
      }
      if (isWorkspaceInstance) {
        const mode = this.args[4] as SessionRow['session_mode']
        if (mode) row.session_mode = mode
      } else if (isTemplateInstance) {
        row.vote_policy = 'once'
        row.session_mode = 'reflection'
      }
      this.db.sessions.set(id, row)
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET workspace_id = NULL')) {
      const [workspace_id] = this.args as [string]
      let changes = 0
      for (const row of this.db.sessions.values()) {
        if (row.workspace_id === workspace_id) {
          row.workspace_id = null
          row.workspace_seq = null
          changes++
        }
      }
      return { meta: { changes } }
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
    // RETRO-BOARD-01: UPDATE sessions SET anonymity = ?1, session_mode = 'retro' WHERE id = ?2
    if (this.sql.includes("session_mode = 'retro'") && this.sql.includes('anonymity')) {
      const [anonymity, id] = this.args as [SessionRow['anonymity'], string]
      const row = this.db.sessions.get(id)
      if (!row) return { meta: { changes: 0 } }
      row.anonymity = anonymity
      row.session_mode = 'retro'
      return { meta: { changes: 1 } }
    }
    if (this.sql.includes("session_mode = 'retro'")) {
      const [id] = this.args as [string]
      const row = this.db.sessions.get(id)
      if (!row) return { meta: { changes: 0 } }
      row.session_mode = 'retro'
      return { meta: { changes: 1 } }
    }
    if (this.sql.includes("session_mode = 'ideate'")) {
      const [id] = this.args as [string]
      const row = this.db.sessions.get(id)
      if (!row) return { meta: { changes: 0 } }
      row.session_mode = 'ideate'
      return { meta: { changes: 1 } }
    }
    // DELIBERATE-RECEIPT-01: UPDATE sessions SET session_mode = 'deliberate' WHERE id = ?1 AND owner_id = ?2
    if (this.sql.includes("session_mode = 'deliberate'")) {
      const [id, owner_id] = this.args as [string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.session_mode = 'deliberate'
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO embed_widgets')) {
      const [id, team_id, session_id, session_code, allowed_origins, scope, created_by, created_at] = this.args as [
        string, string, string, string, string, string, string, number
      ]
      this.db.embedWidgets.set(id, {
        id, team_id, session_id, session_code, allowed_origins, scope, created_by, created_at, revoked_at: null,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE embed_widgets SET revoked_at')) {
      const [revoked_at, id, team_id] = this.args as [number, string, string]
      const row = this.db.embedWidgets.get(id)
      if (!row || row.team_id !== team_id) return { meta: { changes: 0 } }
      row.revoked_at = revoked_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO deliberate_ballots')) {
      const [id, session_id, ballot_nonce, commitment, choice, voter_hash, leaf_index, created_at] = this
        .args as [string, string, string, string, string, string, number, number]
      // UNIQUE(session_id, voter_hash), UNIQUE(session_id, ballot_nonce), and
      // UNIQUE(session_id, leaf_index).
      for (const r of this.db.deliberateBallots.values()) {
        if (
          r.session_id === session_id &&
          (r.voter_hash === voter_hash || r.ballot_nonce === ballot_nonce || r.leaf_index === leaf_index)
        ) {
          throw new Error('UNIQUE constraint failed: deliberate_ballots')
        }
      }
      this.db.deliberateBallots.set(id, {
        id,
        session_id,
        ballot_nonce,
        commitment,
        choice,
        voter_hash,
        leaf_index,
        created_at,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET session_mode')) {
      const [session_mode, id, owner_id] = this.args as [NonNullable<SessionRow['session_mode']>, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      row.session_mode = session_mode
      return { meta: { changes: 1 } }
    }
    // TOWNHALL-06: UPDATE sessions SET townhall_moderation = ?2, session_mode = 'townhall'[, anonymity = ?3] WHERE id = ?1
    if (this.sql.startsWith('UPDATE sessions SET townhall_moderation')) {
      const [id, moderation, anonymity] = this.args as [string, 'pre' | 'post', SessionRow['anonymity'] | undefined]
      const row = this.db.sessions.get(id)
      if (!row) return { meta: { changes: 0 } }
      row.townhall_moderation = moderation
      row.session_mode = 'townhall'
      if (anonymity !== undefined) row.anonymity = anonymity
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE sessions SET status = ?1, started_at = ?2')) {
      // Parameterized start: status = 'live' | 'energizing', guards AND status = 'draft'
      const [status, started_at, id, owner_id] = this.args as [string, number, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id || row.status !== 'draft') return { meta: { changes: 0 } }
      row.status = status as SessionRow['status']
      row.started_at = started_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith("UPDATE sessions SET status = 'live'")) {
      // transition-to-live: args are (id, owner_id), not (started_at, id, owner_id)
      const [id, owner_id] = this.args as [string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id || row.status !== 'energizing') return { meta: { changes: 0 } }
      row.status = 'live'
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith("UPDATE sessions SET status = 'draft'")) {
      if (this.sql.includes('AND owner_id = ?2 AND status = ?3 AND started_at = ?4')) {
        const [id, owner_id, status, started_at] = this.args as [string, string, SessionRow['status'], number]
        const row = this.db.sessions.get(id)
        if (!row || row.owner_id !== owner_id || row.status !== status || row.started_at !== started_at) {
          return { meta: { changes: 0 } }
        }
        row.status = 'draft'
        row.started_at = null
        return { meta: { changes: 1 } }
      }
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
    if (this.sql.startsWith('DELETE FROM votes WHERE session_id')) {
      const [session_id] = this.args as [string]
      let changes = 0
      for (const [id, row] of this.db.votes) {
        if (row.session_id === session_id) {
          this.db.votes.delete(id)
          changes++
        }
      }
      return { meta: { changes } }
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
    if (
      this.sql.includes('DELETE FROM team_quiz_responses') ||
      this.sql.includes('DELETE FROM battle_royale_rounds') ||
      this.sql.includes('DELETE FROM bracket_matches') ||
      this.sql.includes('DELETE FROM energizer_votes') ||
      this.sql.includes('DELETE FROM energizers WHERE session_id') ||
      this.sql.includes('DELETE FROM leaderboard_entries') ||
      this.sql.includes('DELETE FROM badges WHERE session_id')
    ) {
      return { meta: { changes: 0 } }
    }
    if (this.sql.startsWith('INSERT OR REPLACE INTO townhall_questions')) {
      const [id, session_id, body, display_name, author_hash, status, upvotes, group_parent, was_spotlit, created_at, resolved_at] =
        this.args as [string, string, string, string | null, string, string, number, string | null, number, number, number | null]
      this.db.townhallQuestions.set(id, {
        id,
        session_id,
        body,
        display_name,
        author_hash,
        status,
        upvotes,
        group_parent,
        was_spotlit,
        created_at,
        resolved_at,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('DELETE FROM townhall_questions WHERE id')) {
      const [id, session_id] = this.args as [string, string]
      const row = this.db.townhallQuestions.get(id)
      if (!row || row.session_id !== session_id) return { meta: { changes: 0 } }
      this.db.townhallQuestions.delete(id)
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('DELETE FROM insights_daily WHERE session_id')) {
      const [session_id] = this.args as [string]
      let changes = 0
      for (const [id, row] of this.db.insightsDaily) {
        if (row.session_id === session_id) {
          this.db.insightsDaily.delete(id)
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('DELETE FROM sprint19_events WHERE session_id')) {
      const [session_id] = this.args as [string]
      let changes = 0
      for (const [id, row] of this.db.sprint19Events) {
        if (row.session_id === session_id) {
          this.db.sprint19Events.delete(id)
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('DELETE FROM sessions WHERE id = ?1 AND owner_id = ?2')) {
      const [id, owner_id] = this.args as [string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
      this.db.sessions.delete(id)
      return { meta: { changes: 1 } }
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
    if (this.sql.startsWith('INSERT INTO platform_roles')) {
      // INSERT INTO platform_roles (id, user_id, role, granted_by, created_at)
      // VALUES (?1, ?2, 'platform_admin', ?3, ?4) ON CONFLICT(user_id, role) DO NOTHING
      const [id, user_id] = this.args as [string, string]
      for (const r of this.db.platformRoles.values()) {
        if (r.user_id === user_id && r.role === 'platform_admin') return { meta: { changes: 0 } }
      }
      this.db.platformRoles.set(id, { user_id, role: 'platform_admin' })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('DELETE FROM platform_roles')) {
      const [user_id] = this.args as [string]
      let changes = 0
      for (const [k, r] of this.db.platformRoles.entries()) {
        if (r.user_id === user_id && r.role === 'platform_admin') {
          this.db.platformRoles.delete(k)
          changes++
        }
      }
      return { meta: { changes } }
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
    if (this.sql.startsWith('INSERT INTO pulse_session_rollup')) {
      const [
        session_id,
        team_id,
        workspace_id,
        closed_at,
        participant_count,
        vote_count,
        participation_rate,
        sentiment_score,
        payload_json,
        computed_at,
      ] = this.args as [
        string,
        string | null,
        string | null,
        number,
        number,
        number,
        number,
        number | null,
        string,
        number,
      ]
      this.db.pulseSessionRollups.set(session_id, {
        session_id,
        team_id,
        workspace_id,
        closed_at,
        participant_count,
        vote_count,
        participation_rate,
        sentiment_score,
        payload_json,
        computed_at,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO pulse_team_daily')) {
      const [team_id, day, participation_avg, sentiment_avg, session_count, response_total, computed_at] =
        this.args as [string, string, number, number | null, number, number, number]
      this.db.pulseTeamDaily.set(`${team_id}:${day}`, {
        team_id,
        day,
        participation_avg,
        sentiment_avg,
        session_count,
        response_total,
        computed_at,
      })
      return { meta: { changes: 1 } }
    }
    if (
      this.sql.includes('UPDATE pulse_session_rollup') &&
      this.sql.includes("SET payload_json = '{}'")
    ) {
      let changes = 0
      const [redactBefore] = this.args as [number]
      for (const row of this.db.pulseSessionRollups.values()) {
        if (row.closed_at < redactBefore && row.payload_json !== '{}') {
          row.payload_json = '{}'
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('DELETE FROM pulse_session_rollup WHERE closed_at')) {
      const [deleteBefore] = this.args as [number]
      let changes = 0
      for (const [id, row] of this.db.pulseSessionRollups.entries()) {
        if (row.closed_at < deleteBefore) {
          this.db.pulseSessionRollups.delete(id)
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('DELETE FROM pulse_team_daily WHERE computed_at')) {
      const [deleteBefore] = this.args as [number]
      let changes = 0
      for (const [key, row] of this.db.pulseTeamDaily.entries()) {
        if (row.computed_at < deleteBefore) {
          this.db.pulseTeamDaily.delete(key)
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('INSERT INTO insights_daily')) {
      // INSIGHTS-02: (id, session_id, team_id, day, themes_json, confidence, n_votes, embedding_ref, computed_at)
      // ON CONFLICT(session_id, day) DO UPDATE — idempotent per close-day.
      const [id, session_id, team_id, day, themes_json, confidence, n_votes, embedding_ref, computed_at] =
        this.args as [string, string, string | null, string, string, number, number, number, number]
      const existing = [...this.db.insightsDaily.values()].find(
        (r) => r.session_id === session_id && r.day === day,
      )
      if (existing) {
        existing.team_id = team_id
        existing.themes_json = themes_json
        existing.confidence = confidence
        existing.n_votes = n_votes
        if (embedding_ref === 1) existing.embedding_ref = 1
        existing.computed_at = computed_at
        return { meta: { changes: 1 } }
      }
      this.db.insightsDaily.set(id, {
        id,
        session_id,
        team_id,
        day,
        themes_json,
        confidence,
        n_votes,
        embedding_ref,
        computed_at,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO stripe_webhook_events')) {
      const [stripe_event_id, event_type, processed_at] = this.args as [string, string, number]
      this.db.stripeWebhookEvents.set(stripe_event_id, { stripe_event_id, event_type, processed_at })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO device_tokens')) {
      const [id, user_id, platform, token, app_version, locale, created_at] = this.args as [
        string, string, string, string, string | null, string | null, number,
      ]
      this.db.deviceTokens.set(id, {
        id,
        user_id,
        platform,
        token,
        app_version,
        locale,
        created_at,
        last_seen_at: created_at,
        revoked_at: null,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE device_tokens SET revoked_at')) {
      const [revoked_at, ...rest] = this.args as [number, ...string[]]
      if (this.sql.includes('WHERE id = ?2 AND user_id = ?3')) {
        const [id, user_id] = rest as [string, string]
        const row = this.db.deviceTokens.get(id)
        if (!row || row.user_id !== user_id || row.revoked_at) return { meta: { changes: 0 } }
        row.revoked_at = revoked_at
        return { meta: { changes: 1 } }
      }
      const [user_id, platform, token] = rest as [string, string, string]
      let changes = 0
      for (const row of this.db.deviceTokens.values()) {
        if (
          row.user_id === user_id &&
          row.platform === platform &&
          row.token === token &&
          row.revoked_at == null
        ) {
          row.revoked_at = revoked_at
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.includes('INSERT INTO team_insight_rollup')) {
      const [team_id, kind, window, payload_json, computed_at] = this.args as [
        string, string, string, string, number,
      ]
      const key = `${team_id}:${kind}:${window}`
      this.db.teamInsightRollups.set(key, { team_id, kind, window, payload_json, computed_at })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO partner_payment_accounts')) {
      // (team_id, stripe_account_id, account_type, 'onboarding', 0, 0, NULL, created_at, created_at)
      // ON CONFLICT(team_id) DO UPDATE — keep existing account id when excluded is null.
      const [team_id, stripe_account_id, account_type, created_at] = this.args as [
        string, string | null, string, number,
      ]
      const existing = this.db.partnerPaymentAccounts.get(team_id)
      if (existing) {
        existing.stripe_account_id = stripe_account_id ?? existing.stripe_account_id
        existing.account_type = account_type
        existing.updated_at = created_at
        return { meta: { changes: 1 } }
      }
      this.db.partnerPaymentAccounts.set(team_id, {
        team_id,
        stripe_account_id,
        account_type,
        status: 'onboarding',
        charges_enabled: 0,
        payouts_enabled: 0,
        default_payout_currency: null,
        created_at,
        updated_at: created_at,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE partner_payment_accounts')) {
      const [team_id, status, charges_enabled, payouts_enabled, default_payout_currency, updated_at] =
        this.args as [string, string, number, number, string | null, number]
      const row = this.db.partnerPaymentAccounts.get(team_id)
      if (!row) return { meta: { changes: 0 } }
      row.status = status
      row.charges_enabled = charges_enabled
      row.payouts_enabled = payouts_enabled
      row.default_payout_currency = default_payout_currency
      row.updated_at = updated_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('DELETE FROM team_insight_rollup')) {
      const [team_id] = this.args as [string]
      let changes = 0
      for (const [key, row] of this.db.teamInsightRollups) {
        if (row.team_id === team_id) {
          this.db.teamInsightRollups.delete(key)
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('INSERT INTO workspaces')) {
      if (this.args.length >= 10) {
        const [id, team_id, kind, title, template_json, cadence, retention_days, , , created_by, created_at, updated_at] =
          this.args as [string, string, string, string, string, string | null, number | null, null, null, string, number, number]
        this.db.workspaces.set(id, {
          id,
          team_id,
          kind,
          title,
          template_json,
          cadence,
          retention_days,
          last_instance_at: null,
          archived_at: null,
          created_by,
          created_at,
          updated_at,
        })
      } else {
        const [id, team_id, kind, title, template_json, created_by, created_at, updated_at] = this.args as [
          string, string, string, string, string, string, number, number,
        ]
        this.db.workspaces.set(id, {
          id,
          team_id,
          kind,
          title,
          template_json,
          cadence: null,
          retention_days: null,
          last_instance_at: null,
          archived_at: null,
          created_by,
          created_at,
          updated_at,
        })
      }
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE workspaces SET last_instance_at')) {
      const [last_instance_at, id] = this.args as [number, string]
      const row = this.db.workspaces.get(id)
      if (!row) return { meta: { changes: 0 } }
      row.last_instance_at = last_instance_at
      row.updated_at = last_instance_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE workspaces SET template_json')) {
      const [template_json, updated_at, id, team_id] = this.args as [string, number, string, string]
      const row = this.db.workspaces.get(id)
      if (!row || row.team_id !== team_id) return { meta: { changes: 0 } }
      row.template_json = template_json
      row.updated_at = updated_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE workspaces SET')) {
      const row = this.db.workspaces.get(this.args[this.args.length - 2] as string)
      if (row) row.updated_at = this.args[0] as number
      return { meta: { changes: row ? 1 : 0 } }
    }
    if (this.sql.startsWith('INSERT INTO workspace_trend')) {
      const [workspace_id, kind, window, payload_json, computed_at] = this.args as [
        string, string, string, string, number,
      ]
      const key = `${workspace_id}:${kind}:${window}`
      this.db.workspaceTrends.set(key, { workspace_id, kind, window, payload_json, computed_at })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('DELETE FROM workspace_trend')) {
      const [workspace_id] = this.args as [string]
      let changes = 0
      for (const [key, row] of this.db.workspaceTrends) {
        if (row.workspace_id === workspace_id) {
          this.db.workspaceTrends.delete(key)
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('DELETE FROM workspaces')) {
      const [id, team_id] = this.args as [string, string]
      const row = this.db.workspaces.get(id)
      if (row && row.team_id === team_id) {
        this.db.workspaces.delete(id)
        return { meta: { changes: 1 } }
      }
      return { meta: { changes: 0 } }
    }
    if (this.sql.startsWith('INSERT INTO marketplace_listings')) {
      const [
        id, partner_team_id, kind, title, description, price_cents, currency,
        revenue_share_bps, status, visibility, created_at, , published_at,
      ] = this.args as [string, string, string, string, string | null, number, string, number, string, string, number, number, number | null]
      this.db.marketplaceListings.set(id, {
        id,
        partner_team_id,
        kind,
        title,
        description,
        price_cents,
        currency,
        revenue_share_bps,
        status,
        visibility,
        created_at,
        updated_at: created_at,
        published_at,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE marketplace_listings')) {
      const [id, partner_team_id, title, description, price_cents, status, visibility, published_at, updated_at] =
        this.args as [string, string, string, string | null, number, string, string, number | null, number]
      const row = this.db.marketplaceListings.get(id)
      if (!row || row.partner_team_id !== partner_team_id) return { meta: { changes: 0 } }
      row.title = title
      row.description = description
      row.price_cents = price_cents
      row.status = status
      row.visibility = visibility
      row.published_at = published_at
      row.updated_at = updated_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO marketplace_purchases')) {
      const [id, buyer_team_id, listing_id, amount_cents, currency, purchased_at] = this.args as [
        string, string, string, number, string, number,
      ]
      this.db.marketplacePurchases.set(id, {
        id,
        buyer_team_id,
        listing_id,
        amount_cents,
        currency,
        purchased_at,
        refunded_at: null,
      })
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
    if (this.sql.startsWith('INSERT INTO energizers')) {
      // INSERT INTO energizers (id, session_id, kind, prompt, config_json, position, state, created_at, updated_at)
      // VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      const [id, session_id, kind, prompt, config_json, position, state, created_at, updated_at] = this.args as [
        string, string, string, string, string, number, string, number, number,
      ]
      this.db.energizers.set(id, {
        id,
        session_id,
        kind,
        prompt,
        options_json: '[]',
        config_json,
        position,
        state,
        created_at,
        updated_at,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith("UPDATE energizers SET state = 'completed'") && this.sql.includes("WHERE id = ?2 AND state = 'active'")) {
      // DO→D1 mirror on energizer completion (audit E-2):
      // UPDATE energizers SET state = 'completed', updated_at = ?1 WHERE id = ?2 AND state = 'active'
      const [updated_at, id] = this.args as [number, string]
      const row = this.db.energizers.get(id)
      if (!row || row.state !== 'active') return { meta: { changes: 0 } }
      row.state = 'completed'
      row.updated_at = updated_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO team_quiz_responses')) {
      // INSERT ... ON CONFLICT(energizer_id, voter_id, question_index) DO NOTHING (audit E-1: answers are final)
      const [id, energizer_id, voter_id, question_index, value, correct, created_at] = this.args as [
        string, string, string, number, string, number, number,
      ]
      const key = `${energizer_id}:${voter_id}:${question_index}`
      if (this.db.teamQuizResponses.has(key)) return { meta: { changes: 0 } }
      this.db.teamQuizResponses.set(key, { id, energizer_id, voter_id, question_index, value, correct, created_at })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('INSERT INTO energizer_votes')) {
      // INSERT ... ON CONFLICT(energizer_id, voter_id) DO UPDATE SET value = excluded.value
      const [id, energizer_id, session_id, voter_id, value, created_at] = this.args as [
        string, string, string, string, string, number,
      ]
      const key = `${energizer_id}:${voter_id}`
      const existing = this.db.energizerVotes.get(key)
      if (existing) {
        existing.value = value
      } else {
        this.db.energizerVotes.set(key, { id, energizer_id, session_id, voter_id, value, created_at })
      }
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE energizers SET config_json = ?1, state = ?2, updated_at = ?3 WHERE id = ?4')) {
      // Team-quiz /next: advance current_index (and possibly complete).
      const [config_json, state, updated_at, id] = this.args as [string, string, number, string]
      const row = this.db.energizers.get(id)
      if (!row) return { meta: { changes: 0 } }
      row.config_json = config_json
      row.state = state
      row.updated_at = updated_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith("UPDATE energizers SET state = 'completed'")) {
      // UPDATE energizers SET state = 'completed', updated_at = ?1
      // WHERE session_id = ?2 AND state = 'active' AND id != ?3
      const [updated_at, session_id, energizer_id] = this.args as [number, string, string]
      let changes = 0
      for (const row of this.db.energizers.values()) {
        if (row.session_id === session_id && row.state === 'active' && row.id !== energizer_id) {
          row.state = 'completed'
          row.updated_at = updated_at
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.includes('UPDATE energizers SET') && this.sql.includes('WHERE id = ?') && this.sql.includes('AND session_id = ?')) {
      // Dynamic UPDATE based on what fields are being set
      // PATCH endpoint builds dynamic SQL: UPDATE energizers SET updated_at = ?1, [state = ?2], [prompt = ?3], [config_json = ?4]
      // WHERE id = ?N AND session_id = ?M
      const sets: string[] = []
      let paramIdx = 1
      const updated_at = this.args[0] as number
      sets.push('updated_at')
      paramIdx++

      let state: string | undefined
      let prompt: string | undefined
      let config_json: string | undefined

      // Parse what's being set from the SQL. Placeholder numbers (?N) are
      // 1-based while args are 0-based, hence the `- 1` on every read.
      if (this.sql.includes(`state = ?${paramIdx}`)) {
        state = this.args[paramIdx - 1] as string
        sets.push('state')
        paramIdx++
      }
      if (this.sql.includes(`prompt = ?${paramIdx}`)) {
        prompt = this.args[paramIdx - 1] as string
        sets.push('prompt')
        paramIdx++
      }
      if (this.sql.includes(`config_json = ?${paramIdx}`)) {
        config_json = this.args[paramIdx - 1] as string
        sets.push('config_json')
        paramIdx++
      }

      const energizerId = this.args[paramIdx - 1] as string
      const sessionId = this.args[paramIdx] as string

      const row = this.db.energizers.get(energizerId)
      if (!row || row.session_id !== sessionId) {
        return { meta: { changes: 0 } }
      }

      row.updated_at = updated_at
      if (state !== undefined) row.state = state
      if (prompt !== undefined) row.prompt = prompt
      if (config_json !== undefined) row.config_json = config_json

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
    // STUDIO-LIBRARY-01
    if (this.sql.startsWith('INSERT INTO studio_library_items')) {
      const [
        id,
        team_id,
        created_by,
        source,
        forked_from_id,
        question_json,
        theme_id,
        title,
        created_at,
        updated_at,
      ] = this.args as [
        string,
        string,
        string,
        'authored' | 'fork',
        string | null,
        string,
        string | null,
        string,
        number,
        number,
      ]
      this.db.studioLibraryItems.set(id, {
        id,
        team_id,
        created_by,
        source,
        forked_from_id,
        question_json,
        theme_id,
        title,
        use_count: 0,
        created_at,
        updated_at,
      })
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('UPDATE studio_library_items')) {
      const [id, team_id, updated_at] = this.args as [string, string, number]
      const row = this.db.studioLibraryItems.get(id)
      if (!row || row.team_id !== team_id) return { meta: { changes: 0 } }
      row.use_count += 1
      row.updated_at = updated_at
      return { meta: { changes: 1 } }
    }
    if (this.sql.startsWith('DELETE FROM studio_library_items')) {
      const [id, team_id] = this.args as [string, string]
      const row = this.db.studioLibraryItems.get(id)
      if (!row || row.team_id !== team_id) return { meta: { changes: 0 } }
      this.db.studioLibraryItems.delete(id)
      return { meta: { changes: 1 } }
    }
    // GDPR-BADGE-01: hard-delete a user's own analytics rows, audit trail, and account row.
    if (this.sql.startsWith('DELETE FROM sprint19_events WHERE user_id')) {
      const [user_id] = this.args as [string]
      let changes = 0
      for (const [id, row] of this.db.sprint19Events) {
        if (row.user_id === user_id) {
          this.db.sprint19Events.delete(id)
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('DELETE FROM audit_events WHERE actor_id')) {
      const [actor_id] = this.args as [string]
      let changes = 0
      for (const [id, row] of this.db.auditEvents) {
        if (row.actor_id === actor_id) {
          this.db.auditEvents.delete(id)
          changes++
        }
      }
      return { meta: { changes } }
    }
    if (this.sql.startsWith('DELETE FROM users WHERE id')) {
      const [id] = this.args as [string]
      const existed = this.db.users.delete(id)
      return { meta: { changes: existed ? 1 : 0 } }
    }
    throw new Error(`d1-mock: unsupported run(): ${this.sql}`)
  }

  async first<T = unknown>(): Promise<T | null> {
    // marketing_templates registry (Growth Engine gallery).
    if (this.sql.includes('FROM marketing_templates')) {
      const rows = this.marketingTemplateRows()
      if (this.sql.includes('SUM(CASE WHEN is_discarded')) {
        // growth.ts aggregate.
        const active = rows.filter((r) => r.is_discarded === 0)
        const discarded = rows.filter((r) => r.is_discarded === 1)
        return {
          total: rows.length,
          active: active.length,
          discarded: discarded.length,
          total_uses: active.reduce((s, r) => s + r.usage_count, 0),
          last_created_at: active.length ? Math.max(...active.map((r) => r.created_at)) : null,
        } as T
      }
      if (this.sql.startsWith('SELECT COUNT(*) AS n')) {
        return { n: this.filterMarketingTemplates(rows).length } as T
      }
      if (this.sql.includes('WHERE id = ?1')) {
        const [id] = this.args as [string]
        const row = this.db.marketingTemplates.get(id)
        return (row
          ? { id: row.id, is_public: row.is_public, is_discarded: row.is_discarded, usage_count: row.usage_count }
          : null) as T | null
      }
      return null
    }
    if (this.sql.startsWith('SELECT email, expires_at, consumed_at FROM magic_links')) {
      const [token_hash] = this.args as [string]
      const row = this.db.magicLinks.get(token_hash)
      return (row
        ? { email: row.email, expires_at: row.expires_at, consumed_at: row.consumed_at }
        : null) as T | null
    }
    if (this.sql.startsWith('SELECT stripe_event_id FROM stripe_webhook_events')) {
      const [stripe_event_id] = this.args as [string]
      const row = this.db.stripeWebhookEvents.get(stripe_event_id)
      return (row ? { stripe_event_id: row.stripe_event_id } : null) as T | null
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
    // #586: platform-admin authority lookups (adminMiddleware + rbac hasPlatformAdmin).
    if (this.sql.startsWith('SELECT role FROM platform_roles WHERE user_id')) {
      const [user_id] = this.args as [string]
      for (const r of this.db.platformRoles.values()) {
        if (r.user_id === user_id && r.role === 'platform_admin') return { role: r.role } as T
      }
      return null
    }
    if (this.sql.includes('FROM platform_roles') && this.sql.includes('AS ok')) {
      const [user_id] = this.args as [string]
      for (const r of this.db.platformRoles.values()) {
        if (r.user_id === user_id && r.role === 'platform_admin') return { ok: 1 } as T
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
    // DELIBERATE-RECEIPT-01: ballot count for a session.
    if (this.sql.includes('COUNT(*) AS n FROM deliberate_ballots WHERE session_id')) {
      const [session_id] = this.args as [string]
      const override = this.db.deliberateBallotCountOverrides.shift()
      if (override !== undefined) return { n: override } as T
      let n = 0
      for (const r of this.db.deliberateBallots.values()) if (r.session_id === session_id) n++
      return { n } as T
    }
    if (this.sql.includes('SELECT COUNT(DISTINCT voter_id) AS n FROM votes WHERE session_id = ?1')) {
      const [session_id] = this.args as [string]
      const voters = new Set<string>()
      for (const vote of this.db.votes.values()) {
        if (vote.session_id === session_id) voters.add(vote.voter_id)
      }
      return { n: voters.size } as T
    }
    if (this.sql.includes('SELECT COUNT(*) AS n FROM votes WHERE session_id = ?1')) {
      const [session_id] = this.args as [string]
      let n = 0
      for (const vote of this.db.votes.values()) {
        if (vote.session_id === session_id) n++
      }
      return { n } as T
    }
    if (this.sql.includes('SELECT COUNT(*) AS n FROM questions WHERE session_id = ?1')) {
      const [session_id] = this.args as [string]
      let n = 0
      for (const q of this.db.questions.values()) {
        if (q.session_id === session_id) n++
      }
      return { n } as T
    }
    if (this.sql.startsWith('SELECT id FROM deliberate_ballots WHERE session_id')) {
      const [session_id, voter_hash] = this.args as [string, string]
      for (const r of this.db.deliberateBallots.values()) {
        if (r.session_id === session_id && r.voter_hash === voter_hash) return { id: r.id } as T
      }
      return null
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
    if (this.sql.startsWith('SELECT id, owner_id, title, status, closed_at, created_at')) {
      const [id, owner_id] = this.args as [string, string]
      const row = this.db.sessions.get(id)
      return (row && row.owner_id === owner_id
        ? {
            id: row.id,
            owner_id: row.owner_id,
            title: row.title,
            status: row.status,
            closed_at: row.closed_at,
            created_at: row.created_at,
            anonymity: row.anonymity,
            ai_generated: row.ai_generated ?? null,
            ai_consent_at: row.ai_consent_at ?? null,
          }
        : null) as T | null
    }
    // REV-06: fetchSessionAIGovernanceForOwner (repositories/sessionRepository.ts)
    if (this.sql.startsWith('SELECT id, title, team_id, anonymity, ai_generated, ai_consent_at, status, closed_at')) {
      const [id, owner_id] = this.args as [string, string]
      const row = this.db.sessions.get(id)
      return (row && row.owner_id === owner_id
        ? {
            id: row.id,
            title: row.title,
            team_id: row.team_id ?? null,
            anonymity: row.anonymity,
            ai_generated: row.ai_generated ?? null,
            ai_consent_at: row.ai_consent_at ?? null,
            status: row.status,
            closed_at: row.closed_at,
          }
        : null) as T | null
    }
    if (this.sql.startsWith('SELECT team_id, kind, window, payload_json, computed_at')) {
      const [team_id, kind, window] = this.args as [string, string, string]
      const key = `${team_id}:${kind}:${window}`
      return (this.db.teamInsightRollups.get(key) as T) ?? null
    }
    if (this.sql.startsWith('SELECT team_id, stripe_account_id, account_type, status')) {
      const [team_id] = this.args as [string]
      return (this.db.partnerPaymentAccounts.get(team_id) as T) ?? null
    }
    if (this.sql.includes('SELECT session_id, team_id FROM pulse_session_rollup WHERE session_id')) {
      const [session_id] = this.args as [string]
      const row = this.db.pulseSessionRollups.get(session_id)
      return (row ? { session_id: row.session_id, team_id: row.team_id } : null) as T | null
    }
    if (this.sql.includes('AVG(participation_rate) AS participation_avg') && this.sql.includes('FROM pulse_session_rollup')) {
      const [team_id, day] = this.args as [string, string]
      const rows = [...this.db.pulseSessionRollups.values()].filter((r) => {
        if (r.team_id !== team_id) return false
        const rowDay = new Date(r.closed_at).toISOString().slice(0, 10)
        return rowDay === day
      })
      if (rows.length === 0) return null
      const participation_avg = rows.reduce((s, r) => s + r.participation_rate, 0) / rows.length
      const sentimentScores = rows.map((r) => r.sentiment_score).filter((s): s is number => s != null)
      const sentiment_avg =
        sentimentScores.length > 0
          ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
          : null
      const response_total = rows.reduce((s, r) => s + r.vote_count, 0)
      return {
        participation_avg,
        sentiment_avg,
        session_count: rows.length,
        response_total,
      } as T
    }
    if (this.sql.startsWith('SELECT id, team_id, workspace_id, closed_at, anonymity')) {
      const [id] = this.args as [string]
      const row = this.db.sessions.get(id)
      if (!row || (row.status !== 'closed' && row.status !== 'archived')) return null
      return {
        id: row.id,
        team_id: row.team_id ?? null,
        workspace_id: row.workspace_id ?? null,
        closed_at: row.closed_at,
        anonymity: row.anonymity,
      } as T
    }
    if (this.sql.startsWith('SELECT team_id FROM sessions WHERE id')) {
      const [id] = this.args as [string]
      const row = this.db.sessions.get(id)
      return (row ? { team_id: row.team_id ?? null } : null) as T | null
    }
    if (this.sql.startsWith('SELECT id, owner_id, team_id FROM sessions WHERE id')) {
      const [id] = this.args as [string]
      const row = this.db.sessions.get(id)
      return (row
        ? { id: row.id, owner_id: row.owner_id, team_id: row.team_id ?? null }
        : null) as T | null
    }
    if (this.sql.startsWith('SELECT id, status, owner_id, workspace_id FROM sessions WHERE id')) {
      const [id] = this.args as [string]
      const row = this.db.sessions.get(id)
      return (row
        ? {
            id: row.id,
            status: row.status,
            owner_id: row.owner_id,
            workspace_id: row.workspace_id ?? null,
          }
        : null) as T | null
    }
    if (this.sql.startsWith('SELECT id, session_mode, status, title, code, workspace_id FROM sessions WHERE id')) {
      const [id, owner_id] = this.args as [string, string]
      const row = this.db.sessions.get(id)
      return (row && row.owner_id === owner_id
        ? {
            id: row.id,
            session_mode: row.session_mode ?? 'reflection',
            status: row.status,
            title: row.title,
            code: row.code,
            workspace_id: row.workspace_id ?? null,
          }
        : null) as T | null
    }
    if (this.sql.startsWith('SELECT id FROM marketplace_purchases')) {
      const [buyer_team_id, listing_id] = this.args as [string, string]
      for (const row of this.db.marketplacePurchases.values()) {
        if (row.buyer_team_id === buyer_team_id && row.listing_id === listing_id && row.refunded_at == null) {
          return { id: row.id } as T
        }
      }
      return null
    }
    if (this.sql.includes('FROM marketplace_listings') && this.sql.includes('WHERE id = ?1 AND partner_team_id')) {
      const [id, partner_team_id] = this.args as [string, string]
      const row = this.db.marketplaceListings.get(id)
      return (row && row.partner_team_id === partner_team_id ? row : null) as T | null
    }
    if (this.sql.includes('FROM marketplace_listings WHERE id = ?1') && !this.sql.includes('partner_team_id = ?2')) {
      const [id] = this.args as [string]
      return (this.db.marketplaceListings.get(id) as T) ?? null
    }
    if (this.sql.includes('COALESCE(MAX(workspace_seq)')) {
      const [workspace_id] = this.args as [string]
      const max = [...this.db.sessions.values()]
        .filter((s) => s.workspace_id === workspace_id)
        .reduce((m, s) => Math.max(m, s.workspace_seq ?? 0), 0)
      return { max_seq: max } as T
    }
    if (this.sql.includes('FROM workspaces') && this.sql.includes('id = ?1 AND team_id = ?2')) {
      const [id, team_id] = this.args as [string, string]
      const row = this.db.workspaces.get(id)
      return (row && row.team_id === team_id ? row : null) as T | null
    }
    if (this.sql.includes("json_extract(template_json, '$.eventCode')")) {
      const [eventCode] = this.args as [string]
      const row = [...this.db.workspaces.values()].find((ws) => {
        if (ws.kind !== 'event' || ws.archived_at != null) return false
        try {
          const template = JSON.parse(ws.template_json || '{}') as { eventCode?: string }
          return template.eventCode === eventCode
        } catch {
          return false
        }
      })
      return (row ?? null) as T | null
    }
    if (this.sql.includes('MAX(computed_at)') && this.sql.includes('FROM workspace_trend')) {
      // ADR-0048 /refresh debounce: newest trend computed_at for a workspace.
      const [workspace_id] = this.args as [string]
      const rows = [...this.db.workspaceTrends.values()].filter((t) => t.workspace_id === workspace_id)
      const m = rows.length ? Math.max(...rows.map((t) => t.computed_at)) : null
      return { m } as T
    }
    if (this.sql.includes('FROM workspace_trend') && this.sql.includes('payload_json')) {
      const [workspace_id, kind, window] = this.args as [string, string, string]
      const key = `${workspace_id}:${kind}:${window}`
      const row = this.db.workspaceTrends.get(key)
      return (row ? { payload_json: row.payload_json } : null) as T | null
    }
    if (this.sql.startsWith('SELECT id FROM workspaces WHERE id = ?1 AND team_id = ?2')) {
      const [id, team_id] = this.args as [string, string]
      const row = this.db.workspaces.get(id)
      return (row && row.team_id === team_id ? { id: row.id } : null) as T | null
    }
    if (this.sql.startsWith('SELECT id FROM sessions WHERE id = ?1 AND owner_id = ?2')) {
      const [id, owner_id] = this.args as [string, string]
      const row = this.db.sessions.get(id)
      return (row && row.owner_id === owner_id ? { id: row.id } : null) as T | null
    }
    // EMBED-SDK-01: widget token lookups
    if (this.sql.includes('FROM embed_widgets WHERE id =')) {
      const [id] = this.args as [string]
      return (this.db.embedWidgets.get(id) ?? null) as T | null
    }
    if (this.sql.includes('FROM embed_widgets WHERE session_id =') || this.sql.includes('FROM embed_widgets WHERE session_code =')) {
      const [val] = this.args as [string]
      for (const r of this.db.embedWidgets.values()) {
        if (r.session_id === val || r.session_code === val) return r as T
      }
      return null as T | null
    }
    // DELIBERATE-RECEIPT-01: sessionForBallot — public fields, no owner constraint.
    if (this.sql.startsWith('SELECT id, code, created_at, session_mode, status FROM sessions WHERE id')) {
      const [id] = this.args as [string]
      const row = this.db.sessions.get(id)
      return (row
        ? { id: row.id, code: row.code, created_at: row.created_at, session_mode: row.session_mode ?? 'reflection', status: row.status }
        : null) as T | null
    }
    // STUDIO-LIBRARY-01: tenant-scoped single-item fetch.
    if (this.sql.includes('FROM studio_library_items') && this.sql.includes('WHERE id = ?1 AND team_id = ?2')) {
      const [id, team_id] = this.args as [string, string]
      const row = this.db.studioLibraryItems.get(id)
      return (row && row.team_id === team_id ? (row as unknown as T) : null)
    }
    // GET /energizers/active — the active energizer row for a session.
    if (this.sql.includes('FROM energizers') && this.sql.includes("state = 'active' LIMIT 1")) {
      const [session_id] = this.args as [string]
      const row = [...this.db.energizers.values()].find((e) => e.session_id === session_id && e.state === 'active')
      return (row ?? null) as T | null
    }
    // Energizer vote route: SELECT kind, config_json, state FROM energizers WHERE id = ?1 AND session_id = ?2
    // Repository: SELECT id, session_id, ... FROM energizers WHERE id = ?1 AND session_id = ?2
    if (this.sql.includes('FROM energizers') && this.sql.includes('WHERE id = ?1 AND session_id = ?2')) {
      const [id, session_id] = this.args as [string, string]
      const row = this.db.energizers.get(id)
      return (row && row.session_id === session_id ? (row as unknown as T) : null)
    }
    if (this.sql.startsWith('SELECT COUNT(*) as n FROM team_quiz_responses')) {
      const [energizer_id, question_index] = this.args as [string, number]
      let n = 0
      for (const r of this.db.teamQuizResponses.values()) {
        if (r.energizer_id === energizer_id && r.question_index === question_index) n++
      }
      return { n } as T
    }
    throw new Error(`d1-mock: unsupported first(): ${this.sql}`)
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    // marketing_templates registry (Growth Engine gallery).
    if (this.sql.includes('FROM marketing_templates')) {
      const rows = this.marketingTemplateRows()
      if (this.sql.includes('GROUP BY industry')) {
        const counts = new Map<string, number>()
        for (const r of rows.filter((x) => x.is_discarded === 0)) {
          counts.set(r.industry, (counts.get(r.industry) ?? 0) + 1)
        }
        return { results: [...counts.entries()].map(([industry, n]) => ({ industry, n })) as unknown as T[] }
      }
      const filtered = this.filterMarketingTemplates(rows).sort((a, b) => b.created_at - a.created_at)
      const limit = this.args[this.args.length - 2] as number
      const offset = this.args[this.args.length - 1] as number
      const page = filtered.slice(offset, offset + limit)
      return {
        results: page.map((r) => ({
          id: r.id,
          is_public: r.is_public,
          is_discarded: r.is_discarded,
          usage_count: r.usage_count,
        })) as unknown as T[],
      }
    }
    // GDPR-BADGE-01: enumerate a user's owned sessions for deletion cascade.
    if (this.sql.startsWith('SELECT id FROM sessions WHERE owner_id')) {
      const [owner_id] = this.args as [string]
      const rows = [...this.db.sessions.values()].filter((r) => r.owner_id === owner_id)
      return { results: rows.map((r) => ({ id: r.id })) as unknown as T[] }
    }
    if (this.sql.includes('FROM embed_widgets WHERE team_id')) {
      const [team_id] = this.args as [string]
      const rows = [...this.db.embedWidgets.values()].filter((r) => r.team_id === team_id)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('FROM embed_widgets WHERE session_id')) {
      const [session_id] = this.args as [string]
      const rows = [...this.db.embedWidgets.values()].filter((r) => r.session_id === session_id)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('FROM townhall_questions WHERE session_id')) {
      const [session_id] = this.args as [string]
      const rows = [...this.db.townhallQuestions.values()]
        .filter((r) => r.session_id === session_id)
        .sort((a, b) => a.created_at - b.created_at)
      return { results: rows as unknown as T[] }
    }
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
    if (this.sql.startsWith('SELECT title FROM sessions WHERE owner_id')) {
      const [owner_id] = this.args as [string]
      const rows = [...this.db.sessions.values()]
        .filter((s) => s.owner_id === owner_id)
        .map((s) => ({ title: s.title }))
      return { results: rows as unknown as T[] }
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
    if (this.sql.startsWith('SELECT session_id, day, themes_json, confidence, n_votes, embedding_ref')) {
      const [team_id, since_day] = this.args as [string, string]
      const rows = [...this.db.insightsDaily.values()]
        .filter((r) => r.team_id === team_id && r.day >= since_day)
        .sort((a, b) => a.day.localeCompare(b.day))
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('insight_computed_at')) {
      // ADR-0048 /history: linked instances + per-session insight summary (LEFT JOIN).
      const [workspace_id] = this.args as [string]
      const rows = [...this.db.sessions.values()]
        .filter((s) => s.workspace_id === workspace_id)
        .sort((a, b) => (b.workspace_seq ?? 0) - (a.workspace_seq ?? 0))
        .map((s) => {
          const insight = [...this.db.insightsDaily.values()].find((r) => r.session_id === s.id)
          return {
            id: s.id,
            title: s.title,
            status: s.status,
            workspace_seq: s.workspace_seq ?? null,
            created_at: s.created_at,
            closed_at: s.closed_at ?? null,
            insight_votes: insight ? insight.n_votes : null,
            insight_confidence: insight ? insight.confidence : null,
            insight_computed_at: insight ? insight.computed_at : null,
          }
        })
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('HAVING MAX(s.closed_at)')) {
      // ADR-0048 §4 cron: retro/ideate workspaces with a closed instance newer
      // than their newest trend computed_at (or no trend rows yet).
      const rows = [...this.db.workspaces.values()]
        .filter((w) => (w.kind === 'retro' || w.kind === 'ideate') && w.archived_at == null)
        .filter((w) => {
          const closed = [...this.db.sessions.values()].filter(
            (s) =>
              s.workspace_id === w.id &&
              (s.status === 'closed' || s.status === 'archived') &&
              s.closed_at != null,
          )
          if (closed.length === 0) return false
          const maxClosed = Math.max(...closed.map((s) => s.closed_at as number))
          const trends = [...this.db.workspaceTrends.values()].filter((t) => t.workspace_id === w.id)
          const maxTrend = trends.length ? Math.max(...trends.map((t) => t.computed_at)) : 0
          return maxClosed > maxTrend
        })
        .map((w) => ({ id: w.id, team_id: w.team_id, kind: w.kind }))
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('COALESCE(i.n_votes, 0)') && this.sql.includes('workspace_id = ?1')) {
      // ADR-0048 participation trend: LEFT JOIN insights_daily for n_votes.
      const [workspace_id, cutoff] = this.args as [string, number]
      const rows = [...this.db.sessions.values()]
        .filter(
          (s) =>
            s.workspace_id === workspace_id &&
            (s.status === 'closed' || s.status === 'archived') &&
            s.closed_at != null &&
            s.closed_at >= cutoff &&
            s.anonymity !== 'zero_knowledge',
        )
        .sort((a, b) => (a.workspace_seq ?? 0) - (b.workspace_seq ?? 0))
        .map((s) => {
          const insight = [...this.db.insightsDaily.values()].find((r) => r.session_id === s.id)
          return {
            id: s.id,
            workspace_seq: s.workspace_seq ?? null,
            closed_at: s.closed_at!,
            anonymity: s.anonymity,
            n_votes: insight ? insight.n_votes : 0,
          }
        })
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('INNER JOIN insights_daily i ON i.session_id = s.id') && this.sql.includes('workspace_id = ?1')) {
      const [workspace_id, cutoff] = this.args as [string, number]
      const rows = [...this.db.sessions.values()]
        .filter(
          (s) =>
            s.workspace_id === workspace_id &&
            s.session_mode === 'retro' &&
            (s.status === 'closed' || s.status === 'archived') &&
            s.closed_at != null &&
            s.closed_at >= cutoff &&
            s.anonymity !== 'zero_knowledge',
        )
        .sort((a, b) => (a.workspace_seq ?? 0) - (b.workspace_seq ?? 0))
        .map((s) => {
          const insight = [...this.db.insightsDaily.values()].find((r) => r.session_id === s.id)
          if (!insight) return null
          return {
            id: s.id,
            workspace_seq: s.workspace_seq ?? null,
            closed_at: s.closed_at!,
            themes_json: insight.themes_json,
            n_votes: insight.n_votes,
          }
        })
        .filter((row): row is NonNullable<typeof row> => row != null)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('FROM insights_daily i') && this.sql.includes('JOIN sessions s')) {
      const [team_id, since_day] = this.args as [string, string]
      const rows = [...this.db.insightsDaily.values()]
        .filter((r) => r.team_id === team_id && r.day >= since_day)
        .map((r) => {
          const session = this.db.sessions.get(r.session_id)
          if (!session || session.anonymity === 'zero_knowledge') return null
          return {
            session_id: r.session_id,
            day: r.day,
            confidence: r.confidence,
            n_votes: r.n_votes,
            themes_json: r.themes_json,
            owner_id: session.owner_id,
          }
        })
        .filter((row): row is NonNullable<typeof row> => row != null)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('COALESCE(MAX(workspace_seq)')) {
      const [workspace_id] = this.args as [string]
      const max = [...this.db.sessions.values()]
        .filter((s) => s.workspace_id === workspace_id)
        .reduce((m, s) => Math.max(m, s.workspace_seq ?? 0), 0)
      return { results: [{ max_seq: max }] as unknown as T[] }
    }
    if (this.sql.includes('FROM sessions') && this.sql.includes('workspace_id = ?1') && this.sql.includes('workspace_seq DESC')) {
      const [workspace_id] = this.args as [string]
      const rows = [...this.db.sessions.values()]
        .filter((s) => s.workspace_id === workspace_id)
        .sort((a, b) => (b.workspace_seq ?? 0) - (a.workspace_seq ?? 0))
      return { results: rows as unknown as T[] }
    }
    if (
      this.sql.includes('SELECT id, code, title, status, session_mode FROM sessions') &&
      this.sql.includes('workspace_id = ?1') &&
      this.sql.includes('workspace_seq ASC')
    ) {
      const [workspace_id] = this.args as [string]
      const rows = [...this.db.sessions.values()]
        .filter((s) => s.workspace_id === workspace_id)
        .sort((a, b) => (a.workspace_seq ?? 0) - (b.workspace_seq ?? 0))
        .map((s) => ({
          id: s.id,
          code: s.code,
          title: s.title,
          status: s.status,
          session_mode: s.session_mode ?? 'reflection',
        }))
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('FROM workspace_trend')) {
      const [workspace_id, kind, window] = this.args as [string, string, string]
      const key = `${workspace_id}:${kind}:${window}`
      const row = this.db.workspaceTrends.get(key)
      return row ? { results: [row] as unknown as T[] } : { results: [] }
    }
    if (this.sql.includes('FROM workspaces')) {
      const team_id = this.args[0] as string
      let rows = [...this.db.workspaces.values()].filter((r) => r.team_id === team_id)
      if (this.sql.includes('archived_at IS NULL')) {
        rows = rows.filter((r) => r.archived_at == null)
      }
      if (this.sql.includes('kind = ?2') && this.args[1]) {
        rows = rows.filter((r) => r.kind === this.args[1])
      }
      if (this.sql.includes('id = ?1 AND team_id = ?2')) {
        const [id, tid] = this.args as [string, string]
        const row = this.db.workspaces.get(id)
        return row && row.team_id === tid ? { results: [row] as unknown as T[] } : { results: [] }
      }
      rows.sort((a, b) => b.updated_at - a.updated_at)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('FROM agent_definitions') && this.sql.includes('owner_id = ?1')) {
      const [owner_id] = this.args as [string]
      const rows = [...(this.db.agentDefinitions?.values() ?? [])]
        .filter((r) => r.owner_id === owner_id)
        .sort((a, b) => b.updated_at - a.updated_at)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('FROM marketplace_listings') && this.sql.includes('partner_team_id = ?1')) {
      const [partner_team_id] = this.args as [string]
      const rows = [...this.db.marketplaceListings.values()]
        .filter((r) => r.partner_team_id === partner_team_id)
        .sort((a, b) => b.updated_at - a.updated_at)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes("status = 'live' AND visibility = 'public'")) {
      const rows = [...this.db.marketplaceListings.values()].filter(
        (r) => r.status === 'live' && r.visibility === 'public',
      )
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
    if (this.sql.startsWith('SELECT id, platform, app_version, locale, created_at, last_seen_at')) {
      const [user_id] = this.args as [string]
      const rows = [...this.db.deviceTokens.values()]
        .filter((r) => r.user_id === user_id && r.revoked_at == null)
        .sort((a, b) => b.last_seen_at - a.last_seen_at)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.startsWith('SELECT id, kind, prompt, config_json, state, position, created_at FROM energizers')) {
      const [session_id] = this.args as [string]
      const rows = [...this.db.energizers.values()]
        .filter((e) => e.session_id === session_id)
        .sort((a, b) => a.position - b.position)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('FROM votes v') && this.sql.includes('JOIN questions q') && this.sql.includes("q.kind = 'open'")) {
      // SELECT v.option_id AS text FROM votes v JOIN questions q ON q.id = v.question_id
      // WHERE v.session_id = ?1 AND q.kind = 'open' ORDER BY v.submitted_at ASC LIMIT 500
      const [session_id] = this.args as [string]
      const rows: Array<{ text: string }> = []
      for (const vote of this.db.votes.values()) {
        if (vote.session_id !== session_id) continue
        const question = [...this.db.questions.values()].find((q) => q.id === vote.question_id)
        if (question && question.kind === 'open') {
          rows.push({ text: vote.option_id })
        }
      }
      return { results: rows as unknown as T[] }
    }
    if (this.sql.startsWith('SELECT id, prompt, kind, options_json')) {
      // SELECT id, prompt, kind, options_json FROM questions WHERE session_id = ?1 ORDER BY position ASC LIMIT 20
      const [session_id] = this.args as [string]
      const rows = [...this.db.questions.values()]
        .filter((q) => q.session_id === session_id)
        .sort((a, b) => a.position - b.position)
        .slice(0, 20)
      return { results: rows as unknown as T[] }
    }
    // DELIBERATE-RECEIPT-01: ordered commitment ledger for a session.
    if (this.sql.includes('FROM deliberate_ballots WHERE session_id')) {
      const [session_id] = this.args as [string]
      const rows = [...this.db.deliberateBallots.values()]
        .filter((r) => r.session_id === session_id)
        .sort((a, b) => a.leaf_index - b.leaf_index)
        .map((r) => ({ ballot_nonce: r.ballot_nonce, commitment: r.commitment, choice: r.choice, leaf_index: r.leaf_index }))
      return { results: rows as unknown as T[] }
    }
    // EMBED-WIDGET-API-01: SELECT from embed_widgets
    if (this.sql.includes('FROM embed_widgets WHERE team_id = ?1')) {
      const [team_id] = this.args as [string]
      const rows = [...this.db.embedWidgets.values()]
        .filter((r) => r.team_id === team_id)
        .sort((a, b) => b.created_at - a.created_at)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('FROM embed_widgets WHERE id = ?1 AND team_id = ?2')) {
      const [id, team_id] = this.args as [string, string]
      const row = this.db.embedWidgets.get(id)
      if (!row || row.team_id !== team_id) return { results: [] }
      return { results: [row] as unknown as T[] }
    }
    if (this.sql.includes('FROM embed_widgets WHERE id = ?1')) {
      const [id] = this.args as [string]
      const row = this.db.embedWidgets.get(id)
      if (!row) return { results: [] }
      return { results: [row] as unknown as T[] }
    }
    // EMBED-WIDGET-API-01: SELECT from sessions for embed widget visibility
    if (this.sql.includes('FROM sessions WHERE id = ?1 OR code = ?1')) {
      const [idOrCode] = this.args as [string]
      const row = [...this.db.sessions.values()].find((s) => s.id === idOrCode || s.code === idOrCode)
      if (!row) return { results: [] }
      return {
        results: [
          {
            id: row.id,
            code: row.code,
            title: row.title,
            status: row.status,
            anonymity: row.anonymity,
          } as unknown as T,
        ],
      }
    }
    // EMBED-WIDGET-API-01: SELECT questions for active question
    if (this.sql.includes('FROM questions WHERE session_id = ?1 ORDER BY position ASC LIMIT 1')) {
      const [session_id] = this.args as [string]
      const rows = [...this.db.questions.values()]
        .filter((q) => q.session_id === session_id)
        .sort((a, b) => a.position - b.position)
        .slice(0, 1)
      return { results: rows as unknown as T[] }
    }
    // EMBED-WIDGET-API-01: aggregate response count
    if (this.sql.includes('SELECT COUNT(*) AS n FROM votes WHERE session_id = ?1')) {
      const [session_id] = this.args as [string]
      let n = 0
      for (const vote of this.db.votes.values()) {
        if (vote.session_id === session_id) n++
      }
      return { results: [{ n } as unknown as T] }
    }
    // EMBED-WIDGET-API-01: aggregate tallies (GROUP BY option_id)
    if (this.sql.includes('FROM votes WHERE session_id = ?1 AND question_id = ?2') && this.sql.includes('GROUP BY option_id')) {
      const [session_id, question_id] = this.args as [string, string]
      const tallies = new Map<string, number>()
      for (const vote of this.db.votes.values()) {
        if (vote.session_id === session_id && vote.question_id === question_id) {
          tallies.set(vote.option_id, (tallies.get(vote.option_id) ?? 0) + 1)
        }
      }
      const rows = Array.from(tallies.entries()).map(([option_id, count]) => ({
        option_id,
        count,
      }))
      return { results: rows as unknown as T[] }
    }
    if (this.sql.includes('FROM pulse_team_daily') && this.sql.includes('WHERE team_id = ?1 AND day >= ?2')) {
      const [team_id, since] = this.args as [string, string]
      const rows = [...this.db.pulseTeamDaily.values()]
        .filter((r) => r.team_id === team_id && r.day >= since)
        .sort((a, b) => a.day.localeCompare(b.day))
      return { results: rows as unknown as T[] }
    }
    if (
      this.sql.includes('FROM pulse_session_rollup') &&
      this.sql.includes('WHERE team_id = ?1 AND closed_at >= ?2')
    ) {
      const [team_id, since] = this.args as [string, number]
      const rows = [...this.db.pulseSessionRollups.values()]
        .filter((r) => r.team_id === team_id && r.closed_at >= since)
        .sort((a, b) => a.closed_at - b.closed_at)
        .slice(0, 50)
      return { results: rows as unknown as T[] }
    }
    // STUDIO-LIBRARY-01: tenant-scoped list, newest-first, LIMIT/OFFSET.
    if (this.sql.includes('FROM studio_library_items') && this.sql.includes('WHERE team_id = ?1')) {
      const [team_id, limit, offset] = this.args as [string, number, number]
      const rows = [...this.db.studioLibraryItems.values()]
        .filter((r) => r.team_id === team_id)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(offset, offset + limit)
      return { results: rows as unknown as T[] }
    }
    // GET /energizers/active — legacy D1 vote aggregation fallbacks.
    if (this.sql.startsWith('SELECT value, COUNT(*) as count FROM energizer_votes')) {
      const [energizer_id] = this.args as [string]
      const counts = new Map<string, number>()
      for (const v of this.db.energizerVotes.values()) {
        if (v.energizer_id === energizer_id) counts.set(v.value, (counts.get(v.value) ?? 0) + 1)
      }
      const rows = [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
      return { results: rows as unknown as T[] }
    }
    if (this.sql.startsWith('SELECT voter_id, value, created_at FROM energizer_votes')) {
      const [energizer_id] = this.args as [string]
      const rows = [...this.db.energizerVotes.values()]
        .filter((v) => v.energizer_id === energizer_id)
        .sort((a, b) => a.created_at - b.created_at)
        .map((v) => ({ voter_id: v.voter_id, value: v.value, created_at: v.created_at }))
      return { results: rows as unknown as T[] }
    }
    if (this.sql.startsWith('SELECT voter_id, SUM(correct) as score FROM team_quiz_responses')) {
      const [energizer_id] = this.args as [string]
      const totals = new Map<string, number>()
      for (const r of this.db.teamQuizResponses.values()) {
        if (r.energizer_id === energizer_id) totals.set(r.voter_id, (totals.get(r.voter_id) ?? 0) + r.correct)
      }
      const rows = [...totals.entries()]
        .map(([voter_id, score]) => ({ voter_id, score }))
        .sort((a, b) => b.score - a.score)
      return { results: rows as unknown as T[] }
    }
    throw new Error(`d1-mock: unsupported all(): ${this.sql}`)
  }
}
