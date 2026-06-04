/**
 * AGENT-MARKETPLACE-FOUNDATION-01 — agent registry stub (not public marketplace yet).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountAgentDefinitionRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/definitions', async (c) => {
    const ownerId = c.get('user').sub
    const rows = await c.env.DB.prepare(
      `SELECT id, owner_id, marketplace_listing_id, title, model, status, created_at, updated_at
         FROM agent_definitions
        WHERE owner_id = ?1
        ORDER BY updated_at DESC
        LIMIT 50`,
    )
      .bind(ownerId)
      .all<{
        id: string
        owner_id: string
        marketplace_listing_id: string | null
        title: string
        model: string
        status: string
        created_at: number
        updated_at: number
      }>()

    return c.json({
      ok: true,
      data: {
        agents: (rows.results ?? []).map((r) => ({
          id: r.id,
          title: r.title,
          model: r.model,
          status: r.status,
          marketplaceListingId: r.marketplace_listing_id,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
        note: 'Agent marketplace public launch gated on SEC-AGENT-EVAL-01',
      },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/agents', app)
}
