// Growth Engine public template gallery (/api/gallery) — covers the pipeline
// audit remediations: forgiving lang filter (MKTP-006), draft/publish state and
// content-hash dedup (MKTP-009), the email-capture "use" flow (MKTP-002), and
// usage counting that doesn't churn updatedAt (MKTP-016).

import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import type { Env } from '../../functions/api/types'
import type { TemplateRecord } from '../../functions/api/lib/template-schemas'
import { storeTemplate } from '../../functions/api/lib/templates-kv'
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
    MARKETING_KV: kv(),
  } as unknown as Env
}

/** MARKETING_KV is typed optional on Env; in these tests it's always bound. */
function mkt(env: Env): KVNamespace {
  return env.MARKETING_KV as KVNamespace
}

let seq = 0
function makeTemplate(overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  seq += 1
  const uniqueQuestion = `Generic question number ${seq}?`
  return {
    id: `tmpl_test_${seq}`,
    sourceSessionId: `sess_${seq}`,
    title: { en: `Template ${seq}`, nl: `Sjabloon ${seq}`, de: `Vorlage ${seq}`, fr: `Modèle ${seq}` },
    purpose: { en: 'Purpose EN', nl: 'Purpose NL', de: 'Purpose DE', fr: 'Purpose FR' },
    bestUsedFor: { en: ['team'], nl: ['team'], de: ['team'], fr: ['team'] },
    estimatedMinutes: 15,
    whatYoullLearn: { en: ['insight'], nl: ['insight'], de: ['insight'], fr: ['insight'] },
    questions: [
      {
        id: `q_${seq}`,
        text: { en: uniqueQuestion, nl: uniqueQuestion, de: uniqueQuestion, fr: uniqueQuestion },
        originalHash: 'hash',
        topic: 'team',
        type: 'open',
        options: [],
      },
    ],
    industry: 'general',
    theme: 'team-wellbeing',
    topic: 'team',
    confidence: 80,
    isPublic: true,
    isDiscarded: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('Gallery templates (/api/gallery)', () => {
  it('returns 200 for an unsupported locale instead of 400 (MKTP-006)', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    await storeTemplate(env.DB, mkt(env), makeTemplate())
    const app = createApp()

    const res = await app.fetch(new Request('http://local/api/gallery?lang=es'), env)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)
    // 'es' is unknown to the pipeline → treated as no lang filter, not an error.
    expect(body.data.templates.length).toBe(1)
    expect(body.data.total).toBe(1)
  })

  it('lists only published, non-discarded templates', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    await storeTemplate(env.DB, mkt(env), makeTemplate({ isPublic: true }))
    await storeTemplate(env.DB, mkt(env), makeTemplate({ isPublic: false }))
    await storeTemplate(env.DB, mkt(env), makeTemplate({ isDiscarded: true }))
    const app = createApp()

    const res = await app.fetch(new Request('http://local/api/gallery'), env)
    const body = (await res.json()) as any
    expect(body.data.total).toBe(1)
    expect(body.data.templates).toHaveLength(1)
  })

  it('404s a draft template on the public detail route', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const draft = makeTemplate({ isPublic: false })
    await storeTemplate(env.DB, mkt(env), draft)
    const app = createApp()

    const res = await app.fetch(new Request(`http://local/api/gallery/${draft.id}`), env)
    expect(res.status).toBe(404)
  })

  it('rejects a duplicate content hash with 409 (MKTP-009 dedup)', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const app = createApp()
    const auth = { authorization: `Bearer ${TEST_JWT_SECRET}`, 'content-type': 'application/json' }

    const first = makeTemplate()
    const dup = makeTemplate({ id: 'tmpl_dup', questions: first.questions }) // identical questions

    const r1 = await app.fetch(new Request('http://local/api/gallery', { method: 'POST', headers: auth, body: JSON.stringify(first) }), env)
    expect(r1.status).toBe(200)
    const r2 = await app.fetch(new Request('http://local/api/gallery', { method: 'POST', headers: auth, body: JSON.stringify(dup) }), env)
    expect(r2.status).toBe(409)
  })

  it('requires the internal bearer to store or publish', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const app = createApp()

    const res = await app.fetch(
      new Request('http://local/api/gallery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(makeTemplate()) }),
      env,
    )
    expect(res.status).toBe(401)
  })

  it('publishes a draft via the internal endpoint (MKTP-009)', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const draft = makeTemplate({ isPublic: false })
    await storeTemplate(env.DB, mkt(env), draft)
    const app = createApp()

    // Not visible while draft.
    let res = await app.fetch(new Request(`http://local/api/gallery/${draft.id}`), env)
    expect(res.status).toBe(404)

    res = await app.fetch(
      new Request(`http://local/api/gallery/${draft.id}/publish`, {
        method: 'POST',
        headers: { authorization: `Bearer ${TEST_JWT_SECRET}` },
      }),
      env,
    )
    expect(res.status).toBe(200)

    res = await app.fetch(new Request(`http://local/api/gallery/${draft.id}`), env)
    expect(res.status).toBe(200)
  })

  it('creates a real D1 session from a template and increments usage (MKTP-002/016)', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const tmpl = makeTemplate()
    await storeTemplate(env.DB, mkt(env), tmpl)
    const kvBefore = (mkt(env) as unknown as KVMock).getRaw(`template:${tmpl.id}`)
    const updatedAtBefore = JSON.parse(kvBefore!).updatedAt
    const app = createApp()

    const res = await app.fetch(
      new Request(`http://local/api/gallery/${tmpl.id}/use`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ email: 'visitor@example.com' }),
      }),
      env,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.ok).toBe(true)

    // A real D1 session + question now exist (the old flow wrote to unread KV keys).
    expect(db.sessions.size).toBe(1)
    expect(db.questions.size).toBe(1)
    const session = [...db.sessions.values()][0]
    expect(session.status).toBe('draft')
    // A magic link was minted in D1 for sign-in.
    expect(db.magicLinks.size).toBe(1)

    // Usage counted, but updatedAt unchanged (MKTP-016).
    const row = db.marketingTemplates.get(tmpl.id)
    expect(row?.usage_count).toBe(1)
    const kvAfter = (mkt(env) as unknown as KVMock).getRaw(`template:${tmpl.id}`)
    expect(JSON.parse(kvAfter!).updatedAt).toBe(updatedAtBefore)
  })

  it('rejects "use" without a valid email (MKTP-002)', async () => {
    const db = new D1Mock()
    const env = makeEnv(db)
    const tmpl = makeTemplate()
    await storeTemplate(env.DB, mkt(env), tmpl)
    const app = createApp()

    const res = await app.fetch(
      new Request(`http://local/api/gallery/${tmpl.id}/use`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'cf-connecting-ip': '127.0.0.1' },
        body: JSON.stringify({ email: 'not-an-email' }),
      }),
      env,
    )
    expect(res.status).toBe(400)
  })
})
