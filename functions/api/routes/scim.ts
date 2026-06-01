/**
 * SCIM-SUPPORT-01 — minimal Users provisioning (enterprise).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { timingSafeEqual } from '../lib/shared/crypto'
import type { Env } from '../types'

const ScimUserSchema = z.object({
  userName: z.string().email(),
  active: z.boolean().default(true),
  name: z.object({ givenName: z.string().optional(), familyName: z.string().optional() }).optional(),
})

function scimAuth(c: { req: { header: (n: string) => string | undefined }; env: Env }): boolean {
  const expected = c.env.SCIM_BEARER_TOKEN
  if (!expected) return false
  const auth = c.req.header('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  // Constant-time compare to avoid leaking the token via response-timing.
  return timingSafeEqual(auth.slice(7), expected)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountScimRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env }>()

  app.use('*', async (c, next) => {
    if (!scimAuth(c)) {
      return c.json({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail: 'Unauthorized' }, 401)
    }
    await next()
  })

  app.get('/Users', async (c) => {
    const rows = await c.env.DB.prepare(`SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 200`).all()
    const Resources = ((rows.results ?? []) as Array<{ id: string; email: string }>).map((r) => ({
      id: r.id,
      userName: r.email,
      active: true,
    }))
    return c.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: Resources.length,
      Resources,
    })
  })

  app.post('/Users', async (c) => {
    const body = await c.req.json().catch(() => null)
    const parsed = ScimUserSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ detail: 'Invalid SCIM user' }, 400)
    }
    const email = parsed.data.userName.toLowerCase()
    const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`).bind(email).first()
    if (existing) {
      return c.json({ id: (existing as { id: string }).id, userName: email, active: true })
    }
    const id = crypto.randomUUID()
    const now = Date.now()
    await c.env.DB.prepare(`INSERT INTO users (id, email, created_at) VALUES (?1, ?2, ?3)`).bind(id, email, now).run()
    return c.json({ id, userName: email, active: true }, 201)
  })

  parent.route('/api/scim/v2', app)
}
