/**
 * RETRO-BOARD-01 — retro session mode configuration.
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { requireDraft } from '../lib/session-lifecycle'
import { SESSION_SEED_TTL_SECONDS } from '../lib/constants'
import { readKvJson, writeKvJson } from '../lib/kv'
import { DEFAULT_RETRO_TEMPLATE } from '../lib/workspace-types'
import type { Env, Session } from '../types'
import type { ParentApp } from './parent-app'

type Vars = AuthVariables & PlanVariables

const RetroConfigSchema = z.object({
  dotVoteLimit: z.number().int().min(1).max(10).optional(),
  anonymity: z.enum(['full', 'partial', 'none', 'zero_knowledge']).optional(),
})

export type RetroSessionSeed = {
  dotVoteLimit: number
  carriedActions: string[]
}

export function retroSeedKey(sessionId: string): string {
  return `retro-seed:${sessionId}`
}

export function mountRetroSessionRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/sessions/:id/retro/config', async (c) => {
    const id = c.req.param('id')
    const row = await c.env.DB.prepare(
      `SELECT id, session_mode, status, title, code, workspace_id FROM sessions WHERE id = ?1 AND owner_id = ?2`,
    )
      .bind(id, c.get('user').sub)
      .first<{ id: string; session_mode: string; status: string; title: string; code: string; workspace_id: string | null }>()
    if (!row) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
    }
    const seed = await readKvJson<RetroSessionSeed>(c.env.SESSIONS_KV, retroSeedKey(id))
    return c.json({
      ok: true,
      data: {
        sessionId: row.id,
        sessionMode: row.session_mode,
        status: row.status,
        title: row.title,
        code: row.code,
        workspaceId: row.workspace_id,
        retroReady: row.session_mode === 'retro',
        dotVoteLimit: seed?.dotVoteLimit ?? DEFAULT_RETRO_TEMPLATE.dotVoteLimit,
        carriedActions: seed?.carriedActions ?? [],
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/sessions/:id/retro/config', async (c) => {
    const id = c.req.param('id')
    const body = RetroConfigSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return errorResponse(c, 400, 'validation', 'Invalid retro config')
    }
    const row = await c.env.DB.prepare(`SELECT id, status, owner_id, workspace_id FROM sessions WHERE id = ?1`)
      .bind(id)
      .first<{ id: string; status: string; owner_id: string; workspace_id: string | null }>()
    if (!row || row.owner_id !== c.get('user').sub) {
      return errorResponse(c, 404, 'not_found', 'Session not found')
    }
    const draftGate = requireDraft({ status: row.status } as Session, 'retro_config')
    if (!draftGate.ok) {
      return errorResponse(c, 409, draftGate.error.code, draftGate.error.message)
    }
    if (body.data.anonymity) {
      await c.env.DB.prepare(`UPDATE sessions SET anonymity = ?1, session_mode = 'retro' WHERE id = ?2`)
        .bind(body.data.anonymity, id)
        .run()
    } else {
      await c.env.DB.prepare(`UPDATE sessions SET session_mode = 'retro' WHERE id = ?1`).bind(id).run()
    }
    const existing = (await readKvJson<RetroSessionSeed>(c.env.SESSIONS_KV, retroSeedKey(id))) ?? {
      dotVoteLimit: DEFAULT_RETRO_TEMPLATE.dotVoteLimit,
      carriedActions: [],
    }
    await writeKvJson(
      c.env.SESSIONS_KV,
      retroSeedKey(id),
      {
        ...existing,
        dotVoteLimit: body.data.dotVoteLimit ?? existing.dotVoteLimit,
      },
      { expirationTtl: SESSION_SEED_TTL_SECONDS },
    )
    return c.json({
      ok: true,
      data: { sessionMode: 'retro', dotVoteLimit: body.data.dotVoteLimit ?? existing.dotVoteLimit },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api', app)
}
