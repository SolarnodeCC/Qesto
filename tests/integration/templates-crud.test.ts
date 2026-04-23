import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import { signJwt } from '../../functions/api/lib/jwt'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

const SECRET = 'integration-test-secret-at-least-32-bytes!'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(db: D1Mock): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: SECRET,
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
  const token = await signJwt({ sub: userId, email }, SECRET, 3600)
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
