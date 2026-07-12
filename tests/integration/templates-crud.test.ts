import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const TEST_JWT_SECRET = 'integration-test-secret-at-least-32-bytes!'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: TEST_JWT_SECRET,
    DB: db as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
  } as unknown as Env
}

async function cookieFor(userId: string, email: string): Promise<string> {
  const token = await signJwt({ sub: userId, email }, TEST_JWT_SECRET, 3600)
  return `qesto_session=${token}`
}

describe('Templates CRUD', () => {
  it('lists public Qesto templates without auth', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)

    const res = await app.fetch(
      new Request('http://local/api/templates', {
        headers: { 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.data.templates)).toBe(true)
    // Should have at least some seed templates
    expect(body.data.templates.length).toBeGreaterThan(0)
  })

  it('filters templates by category', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)

    const res = await app.fetch(
      new Request('http://local/api/templates?category=team', {
        headers: { 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)
    // Should have team category templates
    expect(body.data.templates.length).toBeGreaterThan(0)
    expect(body.data.templates.every((t: any) => t.category === 'team')).toBe(true)
  })

  it('ships minimum Qesto starter coverage per catalogue topic', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)

    const res = await app.fetch(
      new Request('http://local/api/templates', {
        headers: { 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    const templates = body.data.templates as any[]
    const requiredTopics = ['team', 'product', 'learning']

    for (const topic of requiredTopics) {
      const topicTemplates = templates.filter((t) => t.topic === topic)
      expect(topicTemplates.length, `${topic} topic coverage`).toBeGreaterThanOrEqual(3)
      expect(topicTemplates.every((t) => t.type === 'qesto')).toBe(true)
      expect(topicTemplates.every((t) => typeof t.previewAlt === 'string' && t.previewAlt.length > 20)).toBe(true)
      expect(topicTemplates.every((t) => Array.isArray(t.questions) && t.questions.length >= 3)).toBe(true)
    }
  })

  it('fetches single Qesto template by id', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)

    // First list to find a template ID
    const listRes = await app.fetch(
      new Request('http://local/api/templates', {
        headers: { 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )
    const listBody = (await listRes.json()) as any
    const templateId = listBody.data.templates[0].id

    // Fetch single template
    const res = await app.fetch(
      new Request(`http://local/api/templates/${templateId}`, {
        headers: { 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)
    expect(body.data.template.id).toBe(templateId)
    expect(body.data.template.questions).toBeDefined()
    expect(Array.isArray(body.data.template.questions)).toBe(true)
  })

  it('gets empty customer templates for new user', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/templates/mine', {
        headers: { cookie, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)
    expect(body.data.templates).toEqual([])
  })

  it('saves a closed session as a template', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')

    // Create and close a session first
    const sessionId = 'sess_01KPX33NP0NRKHTNYX83G8DBZQ'
    db.sessions.set(sessionId, {
      id: sessionId,
      owner_id: 'user_1',
      code: 'ABCDEF',
      title: 'Test Session',
      status: 'closed',
      anonymity: 'anonymous',
      created_at: Date.now(),
      started_at: Date.now(),
      closed_at: Date.now(),
      archived_at: null,
    })

    // Add questions to the session
    const questionId = 'q_01KPX33NP0NRKHTNYX83G8DBZQ'
    db.questions.set(questionId, {
      id: questionId,
      session_id: sessionId,
      position: 0,
      kind: 'poll',
      prompt: 'What is your mood?',
      options_json: JSON.stringify([
        { id: 'happy', label: 'Happy' },
        { id: 'sad', label: 'Sad' },
      ]),
      created_at: Date.now(),
    })

    // Save as template
    const res = await app.fetch(
      new Request('http://local/api/templates/mine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({
          sessionId,
          name: 'My Custom Template',
          description: 'A template I created',
        }),
      }),
      env,
    )

    expect(res.status).toBe(201)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)
    expect(body.data.template.name).toBe('My Custom Template')
    expect(body.data.template.userId).toBe('user_1')
    expect(body.data.template.type).toBe('customer')
    expect(body.data.template.topic).toBe('customer')
    expect(body.data.template.previewAlt).toContain('My Custom Template')
    expect(body.data.template.questions).toHaveLength(1)
  })

  it('lists customer templates for authenticated user', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')

    // Create and close a session
    const sessionId = 'sess_01KPX33NP0NRKHTNYX83G8DBZQ'
    db.sessions.set(sessionId, {
      id: sessionId,
      owner_id: 'user_1',
      code: 'ABCDEF',
      title: 'Test Session',
      status: 'closed',
      anonymity: 'anonymous',
      created_at: Date.now(),
      started_at: Date.now(),
      closed_at: Date.now(),
      archived_at: null,
    })

    // Create a template by saving the session
    const createRes = await app.fetch(
      new Request('http://local/api/templates/mine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({
          sessionId,
          name: 'Template A',
          description: 'First template',
        }),
      }),
      env,
    )
    expect(createRes.status).toBe(201)

    // List templates
    const listRes = await app.fetch(
      new Request('http://local/api/templates/mine', {
        headers: { cookie, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(listRes.status).toBe(200)
    const body = (await listRes.json()) as any
    expect(body.ok).toBe(true)
    expect(body.data.templates).toHaveLength(1)
    expect(body.data.templates[0].name).toBe('Template A')
  })

  it('deletes customer template', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')

    // Create and close a session
    const sessionId = 'sess_01KPX33NP0NRKHTNYX83G8DBZQ'
    db.sessions.set(sessionId, {
      id: sessionId,
      owner_id: 'user_1',
      code: 'ABCDEF',
      title: 'Test Session',
      status: 'closed',
      anonymity: 'anonymous',
      created_at: Date.now(),
      started_at: Date.now(),
      closed_at: Date.now(),
      archived_at: null,
    })

    // Create template
    const createRes = await app.fetch(
      new Request('http://local/api/templates/mine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({
          sessionId,
          name: 'Delete Me',
          description: 'temp',
        }),
      }),
      env,
    )
    const created = (await createRes.json()) as any
    const templateId = created.data.template.id

    // Delete template
    const deleteRes = await app.fetch(
      new Request(`http://local/api/templates/mine/${templateId}`, {
        method: 'DELETE',
        headers: { cookie, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    expect(deleteRes.status).toBe(200)
    const body = (await deleteRes.json()) as any
    expect(body.ok).toBe(true)

    // Verify template is gone
    const listRes = await app.fetch(
      new Request('http://local/api/templates/mine', {
        headers: { cookie, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )
    const listBody = (await listRes.json()) as any
    expect(listBody.data.templates).toHaveLength(0)
  })

  async function createTemplateFor(app: ReturnType<typeof createApp>, env: Env, cookie: string, db: D1Mock, name: string) {
    const sessionId = 'sess_01KPX33NP0NRKHTNYX83G8DBZQ'
    if (!db.sessions.has(sessionId)) {
      db.sessions.set(sessionId, {
        id: sessionId,
        owner_id: 'user_1',
        code: 'ABCDEF',
        title: 'Test Session',
        status: 'closed',
        anonymity: 'anonymous',
        created_at: Date.now(),
        started_at: Date.now(),
        closed_at: Date.now(),
        archived_at: null,
      })
    }
    const res = await app.fetch(
      new Request('http://local/api/templates/mine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ sessionId, name, description: 'desc' }),
      }),
      env,
    )
    return (await res.json()) as any
  }

  it('snapshots the prior version on PATCH and bumps version (MKTP-003)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')
    const created = await createTemplateFor(app, env, cookie, db, 'Original name')
    const templateId = created.data.template.id

    const patchRes = await app.fetch(
      new Request(`http://local/api/templates/mine/${templateId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'Renamed' }),
      }),
      env,
    )
    expect(patchRes.status).toBe(200)
    const patched = (await patchRes.json()) as any
    expect(patched.data.template.name).toBe('Renamed')
    expect(patched.data.template.version).toBe(2)
    // parentId references the prior version snapshot, not itself.
    expect(patched.data.template.parentId).toBe(`${templateId}@v1`)
    // The prior version was preserved (rollback-capable).
    const snapshot = (env.TEMPLATES_KV as unknown as KVMock).getRaw(`customer_template_v:user_1:${templateId}:1`)
    expect(snapshot).toBeTruthy()
    expect(JSON.parse(snapshot!).name).toBe('Original name')
  })

  it('returns 409 on a stale expectedVersion (optimistic concurrency)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')
    const created = await createTemplateFor(app, env, cookie, db, 'Name')
    const templateId = created.data.template.id

    const res = await app.fetch(
      new Request(`http://local/api/templates/mine/${templateId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ name: 'X', expectedVersion: 99 }),
      }),
      env,
    )
    expect(res.status).toBe(409)
  })

  it('rejects an empty PATCH body (MKTP-019 validation)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')
    const created = await createTemplateFor(app, env, cookie, db, 'Name')
    const templateId = created.data.template.id

    const res = await app.fetch(
      new Request(`http://local/api/templates/mine/${templateId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({}),
      }),
      env,
    )
    expect(res.status).toBe(400)
  })

  it('soft-deletes: record is preserved in KV but hidden from listing (MKTP-004)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')
    const created = await createTemplateFor(app, env, cookie, db, 'Name')
    const templateId = created.data.template.id

    await app.fetch(
      new Request(`http://local/api/templates/mine/${templateId}`, {
        method: 'DELETE',
        headers: { cookie, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    // Gone from the listing…
    const listRes = await app.fetch(
      new Request('http://local/api/templates/mine', { headers: { cookie, 'cf-connecting-ip': '127.0.0.1' } }),
      env,
    )
    expect((await listRes.json() as any).data.templates).toHaveLength(0)
    // …but the record itself is retained with archivedAt set (not hard-deleted).
    const raw = (env.TEMPLATES_KV as unknown as KVMock).getRaw(`customer_template:user_1:${templateId}`)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!).archivedAt).toBeGreaterThan(0)
  })

  it('does not set a TTL on customer template writes (MKTP-004)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')
    const putSpy: Array<{ key: string; opts: { expirationTtl?: number } | undefined }> = []
    const realKv = env.TEMPLATES_KV as unknown as KVMock
    const origPut = realKv.put.bind(realKv)
    ;(realKv as unknown as { put: KVMock['put'] }).put = (async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      putSpy.push({ key, opts })
      return origPut(key, value, opts)
    }) as KVMock['put']

    await createTemplateFor(app, env, cookie, db, 'Name')

    const templateWrites = putSpy.filter((w) => w.key.startsWith('customer_template'))
    expect(templateWrites.length).toBeGreaterThan(0)
    expect(templateWrites.every((w) => w.opts?.expirationTtl === undefined)).toBe(true)
  })

  it('rejects invalid template creation (missing sessionId)', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie = await cookieFor('user_1', 'user1@example.com')

    const res = await app.fetch(
      new Request('http://local/api/templates/mine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({
          name: 'Test',
          description: 'Missing sessionId',
        }),
      }),
      env,
    )

    expect(res.status).toBe(400)
  })

  it('rejects unauthenticated template creation', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)

    const createRes = await app.fetch(
      new Request('http://local/api/templates/mine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ sessionId: 'test', name: 'test' }),
      }),
      env,
    )
    expect(createRes.status).toBe(401)
  })

  it('isolates customer templates between users', async () => {
    const db = new D1Mock()
    const app = createApp()
    const env = makeEnv(db)
    const cookie1 = await cookieFor('user_1', 'user1@example.com')
    const cookie2 = await cookieFor('user_2', 'user2@example.com')

    // User 1 creates and saves a template
    const sessionId = 'sess_01KPX33NP0NRKHTNYX83G8DBZQ'
    db.sessions.set(sessionId, {
      id: sessionId,
      owner_id: 'user_1',
      code: 'ABCDEF',
      title: 'Test Session',
      status: 'closed',
      anonymity: 'anonymous',
      created_at: Date.now(),
      started_at: Date.now(),
      closed_at: Date.now(),
      archived_at: null,
    })

    await app.fetch(
      new Request('http://local/api/templates/mine', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: cookie1, 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({
          sessionId,
          name: 'User 1 Template',
          description: 'private',
        }),
      }),
      env,
    )

    // User 2 should see empty list
    const user2List = await app.fetch(
      new Request('http://local/api/templates/mine', {
        headers: { cookie: cookie2, 'cf-connecting-ip': '127.0.0.1' },
      }),
      env,
    )

    const body = (await user2List.json()) as any
    expect(body.data.templates).toHaveLength(0)
  })
})
