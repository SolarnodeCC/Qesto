import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import type { KbSyncRecord } from '../../functions/api/types/knowledge-base'

// Must satisfy KB_ADMIN_KEY_MIN_LENGTH (32) — the route fails closed on a weak key.
const ADMIN_KEY = 'kb-admin-key-at-least-32-chars-long'

/** Records every prepare/bind/run/batch so the test can assert what D1 saw. */
class RecordingD1 {
  readonly statements: Array<{ sql: string; args: unknown[] }> = []
  /** Rows returned by `.all()`, keyed by an SQL fragment the caller matches. */
  readonly selectRows = new Map<string, unknown[]>()

  prepare(sql: string) {
    const self = this
    const entry = { sql: sql.trim(), args: [] as unknown[] }
    return {
      bind(...args: unknown[]) {
        entry.args = args
        return this
      },
      async run() {
        self.statements.push(entry)
        return { meta: { changes: 1 } }
      },
      async all() {
        self.statements.push(entry)
        for (const [fragment, rows] of self.selectRows) {
          if (entry.sql.includes(fragment)) return { results: rows }
        }
        return { results: [] }
      },
      __entry: entry,
    }
  }

  async batch(stmts: Array<{ run: () => Promise<unknown>; __entry: { sql: string; args: unknown[] } }>) {
    const out = []
    for (const s of stmts) {
      this.statements.push(s.__entry)
      out.push({ meta: { changes: 1 } })
    }
    return out
  }

  /** Statements whose SQL contains a fragment (whitespace-insensitive-ish). */
  matching(fragment: string) {
    return this.statements.filter((s) => s.sql.includes(fragment))
  }
}

class RecordingVectorize {
  readonly upserted: Array<{ id: string; values: number[]; metadata: unknown }> = []
  async upsert(batch: Array<{ id: string; values: number[]; metadata: unknown }>) {
    this.upserted.push(...batch)
    return { mutationId: 'm', count: batch.length }
  }
  readonly deleted: string[] = []
  async deleteByIds(ids: string[]) {
    this.deleted.push(...ids)
    return { mutationId: 'm', count: ids.length }
  }
}

function makeEnv(db: RecordingD1, vec: RecordingVectorize): Env {
  return {
    ENV: 'dev',
    KB_ADMIN_KEY: ADMIN_KEY,
    DB: db as unknown as D1Database,
    KB_VECTORIZE: vec as unknown as VectorizeIndex,
  } as unknown as Env
}

function record(docId: string, idx: number, chunkCount: number): KbSyncRecord {
  const chunkId = `${docId}#${idx}`
  return {
    id: chunkId,
    values: new Array(1024).fill(0.01),
    metadata: {
      doc_id: docId,
      chunk_id: chunkId,
      type: 'adr',
      domain: 'infrastructure',
      status: 'accepted',
      tags: ['kb', 'vector'],
      heading_path: 'Architecture > Runtime',
    },
    document: {
      file_path: `knowledge-base/adr/${docId}.md`,
      type: 'adr',
      domain: 'infrastructure',
      category: null,
      status: 'accepted',
      version: '1.0.0',
      owner: 'architect',
      title: `Title ${docId}`,
      tags: ['kb', 'vector'],
      relates_to: ['ADR-001'],
      size_bytes: 1234,
      doc_hash: 'deadbeef',
      chunk_count: chunkCount,
      created_at: 1000,
      updated_at: 2000,
    },
    chunk: {
      chunk_index: idx,
      heading_path: 'Architecture > Runtime',
      start_line: idx * 10 + 1,
      end_line: idx * 10 + 9,
      text: `chunk ${idx} text`,
      token_estimate: 42,
      chunk_hash: `hash-${idx}`,
      embedded_at: 3000,
    },
  }
}

function postSync(env: Env, body: unknown, headers: Record<string, string> = {}) {
  return createApp().fetch(
    new Request('http://local/api/admin/kb-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY, ...headers },
      body: JSON.stringify(body),
    }),
    env,
  )
}

describe('POST /api/admin/kb-sync — writes Vectorize AND D1', () => {
  it('upserts vectors and the kb_documents/kb_chunks rows', async () => {
    const db = new RecordingD1()
    const vec = new RecordingVectorize()
    const env = makeEnv(db, vec)

    const body = [record('ADR-040', 0, 2), record('ADR-040', 1, 2)]
    const res = await postSync(env, body)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: Record<string, number> }

    // Vectorize got the two chunks (without the D1-only fields).
    expect(vec.upserted).toHaveLength(2)
    expect(vec.upserted[0]).not.toHaveProperty('document')
    expect(vec.upserted[0]).not.toHaveProperty('chunk')
    expect(vec.upserted[0].id).toBe('ADR-040#0')

    // Response counts: 1 unique doc, 2 chunks.
    expect(json.data.vectors_upserted).toBe(2)
    expect(json.data.documents_upserted).toBe(1)
    expect(json.data.chunks_upserted).toBe(2)

    // D1 saw one document upsert (deduped by doc_id), two chunk upserts, one prune.
    expect(db.matching('INSERT INTO kb_documents')).toHaveLength(1)
    expect(db.matching('INSERT INTO kb_chunks')).toHaveLength(2)
    const prune = db.matching('DELETE FROM kb_chunks WHERE doc_id')
    expect(prune).toHaveLength(1)
    // Prune uses the authoritative chunk_count (2) to drop stale chunks.
    expect(prune[0].args).toEqual(['ADR-040', 2])

    // The document upsert preserves created_at via ON CONFLICT (no created_at in SET).
    const doc = db.matching('INSERT INTO kb_documents')[0]
    expect(doc.sql).toContain('ON CONFLICT(doc_id) DO UPDATE')
    expect(doc.sql).not.toMatch(/created_at = excluded\.created_at/)
  })

  it('deletes the vectors of chunks a shrinking doc left behind (audit #11)', async () => {
    const db = new RecordingD1()
    // The doc used to have 4 chunks; this sync declares chunk_count = 2, so
    // ADR-040#2 and ADR-040#3 are pruned from D1 — and must go from Vectorize.
    db.selectRows.set('SELECT chunk_id FROM kb_chunks', [
      { chunk_id: 'ADR-040#2' },
      { chunk_id: 'ADR-040#3' },
    ])
    const vec = new RecordingVectorize()
    const env = makeEnv(db, vec)

    const res = await postSync(env, [record('ADR-040', 0, 2), record('ADR-040', 1, 2)])
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: Record<string, number> }

    expect(vec.deleted).toEqual(['ADR-040#2', 'ADR-040#3'])
    expect(json.data.vectors_pruned).toBe(2)
  })

  it('does not fail the sync when the vector prune errors', async () => {
    const db = new RecordingD1()
    db.selectRows.set('SELECT chunk_id FROM kb_chunks', [{ chunk_id: 'ADR-040#2' }])
    const vec = new RecordingVectorize()
    vec.deleteByIds = async () => {
      throw new Error('vectorize unavailable')
    }
    const env = makeEnv(db, vec)

    const res = await postSync(env, [record('ADR-040', 0, 2)])
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: Record<string, number> }
    expect(json.data.vectors_pruned).toBe(0)
    expect(json.data.vectors_upserted).toBe(1)
  })

  it('keeps D1 consistent with Vectorize when a later batch fails (audit #14)', async () => {
    const db = new RecordingD1()
    const vec = new RecordingVectorize()
    // Fail the second Vectorize batch. The first must still have both its
    // vectors AND its D1 rows; the second must have neither.
    let calls = 0
    const realUpsert = vec.upsert.bind(vec)
    vec.upsert = async (batch: Array<{ id: string; values: number[]; metadata: unknown }>) => {
      calls++
      if (calls === 2) throw new Error('vectorize rejected batch 2')
      return realUpsert(batch)
    }
    const env = makeEnv(db, vec)

    // 150 records => two batches of 100 + 50.
    const body = Array.from({ length: 150 }, (_, i) => record(`DOC-${i}`, 0, 1))
    const res = await postSync(env, body)

    // A partial sync must not report success.
    expect(res.status).toBe(500)
    const json = (await res.json()) as {
      error: { code: string }
      data: Record<string, number>
    }
    expect(json.error.code).toBe('sync_partial')
    expect(json.data.batches_failed).toBe(1)

    // Exactly the first batch landed, in BOTH stores.
    expect(vec.upserted).toHaveLength(100)
    expect(json.data.vectors_upserted).toBe(100)
    expect(db.matching('INSERT INTO kb_chunks')).toHaveLength(100)
  })

  it('rejects a wrong admin key with 401', async () => {
    const env = makeEnv(new RecordingD1(), new RecordingVectorize())
    const res = await postSync(env, [record('ADR-040', 0, 1)], { 'x-admin-key': 'wrong' })
    expect(res.status).toBe(401)
  })

  it('rejects a missing admin-key header with 401', async () => {
    const env = makeEnv(new RecordingD1(), new RecordingVectorize())
    const res = await createApp().fetch(
      new Request('http://local/api/admin/kb-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([record('ADR-040', 0, 1)]),
      }),
      env,
    )
    expect(res.status).toBe(401)
  })

  it('fails closed with 503 when KB_ADMIN_KEY is unset', async () => {
    const vec = new RecordingVectorize()
    const env = { ...makeEnv(new RecordingD1(), vec), KB_ADMIN_KEY: undefined } as unknown as Env
    const res = await postSync(env, [record('ADR-040', 0, 1)])
    expect(res.status).toBe(503)
    expect(vec.upserted).toHaveLength(0)
  })

  it('fails closed with 503 on the previously published key, even though it is presented correctly', async () => {
    const leaked = 'qesto-kb-admin-phase1'
    const vec = new RecordingVectorize()
    const env = { ...makeEnv(new RecordingD1(), vec), KB_ADMIN_KEY: leaked } as unknown as Env
    const res = await postSync(env, [record('ADR-040', 0, 1)], { 'x-admin-key': leaked })
    expect(res.status).toBe(503)
    const json = (await res.json()) as { error: { code: string } }
    expect(json.error.code).toBe('kb_admin_key_weak')
    expect(vec.upserted).toHaveLength(0)
  })

  it('fails closed with 503 on a too-short key', async () => {
    const short = 'short-key-123'
    const vec = new RecordingVectorize()
    const env = { ...makeEnv(new RecordingD1(), vec), KB_ADMIN_KEY: short } as unknown as Env
    const res = await postSync(env, [record('ADR-040', 0, 1)], { 'x-admin-key': short })
    expect(res.status).toBe(503)
    expect(vec.upserted).toHaveLength(0)
  })

  it('guards kb-sync-delete with the same key policy', async () => {
    const leaked = 'qesto-kb-admin-phase1'
    const env = { ...makeEnv(new RecordingD1(), new RecordingVectorize()), KB_ADMIN_KEY: leaked } as unknown as Env
    const res = await createApp().fetch(
      new Request('http://local/api/admin/kb-sync-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': leaked },
        body: JSON.stringify({ vector_ids: ['ADR-040#0'] }),
      }),
      env,
    )
    expect(res.status).toBe(503)
  })

  it('still upserts vectors for legacy vector-only records (no D1 writes)', async () => {
    const db = new RecordingD1()
    const vec = new RecordingVectorize()
    const env = makeEnv(db, vec)

    const legacy = {
      id: 'ADR-001#0',
      values: new Array(1024).fill(0),
      metadata: { doc_id: 'ADR-001', chunk_id: 'ADR-001#0', type: 'adr', domain: 'x', status: 'accepted', tags: [], heading_path: '' },
    }
    const res = await postSync(env, [legacy])
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: Record<string, number> }

    expect(vec.upserted).toHaveLength(1)
    expect(json.data.documents_upserted).toBe(0)
    expect(json.data.chunks_upserted).toBe(0)
    expect(db.statements).toHaveLength(0)
  })
})

describe('GET /api/admin/kb-sync/status — platform-admin guarded', () => {
  const JWT_SECRET = 'kb-status-test-secret-at-least-32-bytes!!'

  function statusEnv(extra: Partial<Env> = {}): Env {
    return {
      ENV: 'dev',
      JWT_SECRET,
      DB: new RecordingD1() as unknown as D1Database,
      ...extra,
    } as unknown as Env
  }

  it('rejects an unauthenticated request with 401 (no longer public)', async () => {
    const res = await createApp().fetch(
      new Request('http://local/api/admin/kb-sync/status'),
      statusEnv(),
    )
    expect(res.status).toBe(401)
  })

  it('allows a platform admin (env allowlist) with 200', async () => {
    const env = statusEnv({ SUPERUSER_EMAIL: 'root@example.com' } as Partial<Env>)
    const jwt = await signJwt(
      { sub: 'root-id', email: 'root@example.com', jti: 'j1' },
      JWT_SECRET,
      3600,
    )
    const res = await createApp().fetch(
      new Request('http://local/api/admin/kb-sync/status', {
        headers: { authorization: `Bearer ${jwt}` },
      }),
      env,
    )
    expect(res.status).toBe(200)
  })
})
