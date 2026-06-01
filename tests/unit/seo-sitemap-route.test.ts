import { describe, expect, it } from 'vitest'
import { createApp } from '../../functions/api/app'
import type { Env } from '../../functions/api/types'
import { D1Mock } from '../helpers/d1-mock'
import { KVMock } from '../helpers/kv-mock'

function kv(): KVNamespace {
  return new KVMock() as unknown as KVNamespace
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ENV: 'dev',
    PAGES_URL: 'http://local',
    API_URL: 'http://local',
    JWT_SECRET: 'integration-test-secret-at-least-32-bytes!',
    DB: new D1Mock() as unknown as D1Database,
    USERS_KV: kv(),
    SESSIONS_KV: kv(),
    TEAMS_KV: kv(),
    TEMPLATES_KV: kv(),
    DECISIONS_KV: kv(),
    AUDIT_KV: kv(),
    ACTIONS_KV: kv(),
    MARKETING_KV: kv(),
    COMMIT_SHA: 'test',
    ...overrides,
  } as unknown as Env
}

describe('SEO sitemap routes (Bing "invalid sitemap" regression)', () => {
  it('serves the dynamic template sitemap as application/xml, not text/plain or HTML', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('http://local/sitemap-templates.xml'), makeEnv())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8')

    const body = await res.text()
    // Well-formed: declaration + urlset wrapper present (empty KV ⇒ no <url> entries)
    expect(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(body).toContain('</urlset>')
  })

  it('returns a valid empty sitemap (XML content-type) when MARKETING_KV is unbound', async () => {
    const app = createApp()
    const env = makeEnv()
    delete (env as { MARKETING_KV?: KVNamespace }).MARKETING_KV
    const res = await app.fetch(new Request('http://local/sitemap-templates.xml'), env)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    expect(await res.text()).toContain('<urlset')
  })

  it('sitemap index references /sitemap.xml + /sitemap-templates.xml, never the non-existent /sitemap-static.xml', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('http://local/sitemap-index.xml'), makeEnv())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8')

    const body = await res.text()
    expect(body).toContain('<sitemapindex')
    expect(body).toContain('<loc>https://qesto.cc/sitemap.xml</loc>')
    expect(body).toContain('<loc>https://qesto.cc/sitemap-templates.xml</loc>')
    expect(body).not.toContain('sitemap-static.xml')
  })

  it('does NOT register /sitemap.xml in Hono — it is served as a static marketing file', async () => {
    const app = createApp()
    const res = await app.fetch(new Request('http://local/sitemap.xml'), makeEnv())
    // The static public/sitemap.xml is served by Pages, not Hono, so the app has no route.
    expect(res.status).toBe(404)
  })
})
