// Lightweight in-memory D1 stub covering the exact SQL statements used by
// the Phase 1 auth routes. Not a general-purpose D1 implementation — the
// query strings are pattern-matched literally. Extend it as new queries land.

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

export class D1Mock {
  readonly magicLinks = new Map<string, MagicLink>()
  readonly users = new Map<string, User>()

  prepare(sql: string): D1PreparedStatementMock {
    return new D1PreparedStatementMock(this, sql.trim())
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
      const [id, email, created_at] = this.args as [string, string, number]
      this.db.users.set(id, {
        id,
        email,
        display_name: null,
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
    throw new Error(`d1-mock: unsupported run(): ${this.sql}`)
  }

  async first<T = unknown>(): Promise<T | null> {
    if (this.sql.startsWith('SELECT email, expires_at, consumed_at FROM magic_links')) {
      const [token_hash] = this.args as [string]
      const row = this.db.magicLinks.get(token_hash)
      return (row ? { email: row.email, expires_at: row.expires_at, consumed_at: row.consumed_at } : null) as T | null
    }
    if (this.sql.startsWith('SELECT id FROM users WHERE email')) {
      const [email] = this.args as [string]
      for (const u of this.db.users.values()) {
        if (u.email === email) return { id: u.id } as T
      }
      return null
    }
    throw new Error(`d1-mock: unsupported first(): ${this.sql}`)
  }

  async all<T = unknown>(): Promise<{ results: T[] }> {
    throw new Error(`d1-mock: unsupported all(): ${this.sql}`)
  }
}
