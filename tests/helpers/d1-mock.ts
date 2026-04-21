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
  password_hash: string | null
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
  anonymity: 'anonymous' | 'identified'
  created_at: number
  started_at: number | null
  closed_at: number | null
  archived_at: number | null
}

type QuestionRow = {
  id: string
  session_id: string
  position: number
  kind: 'poll' | 'ranking' | 'consent' | 'open'
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

export class D1Mock {
  readonly magicLinks = new Map<string, MagicLink>()
  readonly users = new Map<string, User>()
  readonly sessions = new Map<string, SessionRow>()
  readonly questions = new Map<string, QuestionRow>()
  readonly votes = new Map<string, VoteRow>()

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
      if (this.sql.includes('password_hash')) {
        // Password signup: bind args are (id, email, display_name, password_hash, created_at)
        const [id, email, display_name, password_hash, created_at] = this.args as [
          string,
          string,
          string | null,
          string,
          number,
        ]
        this.db.users.set(id, {
          id,
          email,
          display_name,
          password_hash,
          created_at,
          last_login_at: created_at,
          plan: 'free',
        })
      } else {
        // Magic-link / OAuth upsert: bind args are (id, email, created_at)
        const [id, email, created_at] = this.args as [string, string, number]
        this.db.users.set(id, {
          id,
          email,
          display_name: null,
          password_hash: null,
          created_at,
          last_login_at: created_at,
          plan: 'free',
        })
      }
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
      const [id, owner_id, code, title, created_at] = this.args as [
        string,
        string,
        string,
        string,
        number,
      ]
      if ([...this.db.sessions.values()].some((s) => s.code === code)) {
        throw new Error('UNIQUE constraint failed: sessions.code')
      }
      this.db.sessions.set(id, {
        id,
        owner_id,
        code,
        title,
        status: 'draft',
        anonymity: 'anonymous',
        created_at,
        started_at: null,
        closed_at: null,
        archived_at: null,
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
    if (this.sql.startsWith("UPDATE sessions SET status = 'live'")) {
      const [started_at, id, owner_id] = this.args as [number, string, string]
      const row = this.db.sessions.get(id)
      if (!row || row.owner_id !== owner_id) return { meta: { changes: 0 } }
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
      const [id, session_id, kind, prompt, options_json, created_at] = this.args as [
        string,
        string,
        'poll' | 'ranking' | 'consent' | 'open',
        string,
        string,
        number,
      ]
      this.db.questions.set(id, {
        id,
        session_id,
        position: 0,
        kind,
        prompt,
        options_json,
        created_at,
      })
      return { meta: { changes: 1 } }
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
    if (this.sql.startsWith('SELECT id, password_hash FROM users WHERE email')) {
      const [email] = this.args as [string]
      for (const u of this.db.users.values()) {
        if (u.email === email) return { id: u.id, password_hash: u.password_hash } as T
      }
      return null
    }
    if (this.sql.startsWith('SELECT email FROM users WHERE id')) {
      const [id] = this.args as [string]
      const u = this.db.users.get(id)
      return (u ? { email: u.email } : null) as T
    }
    if (this.sql.startsWith('SELECT id, owner_id, code, title, status, anonymity')) {
      // Single-row lookup: WHERE id = ?1 AND owner_id = ?2
      const [id, owner_id] = this.args as [string, string]
      const row = this.db.sessions.get(id)
      return (row && row.owner_id === owner_id ? (row as unknown as T) : null)
    }
    throw new Error(`d1-mock: unsupported first(): ${this.sql}`)
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
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
    throw new Error(`d1-mock: unsupported all(): ${this.sql}`)
  }
}
