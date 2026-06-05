/**
 * IDEATE-BOARD-01 — ideate session mode configuration.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { requireDraft } from '../lib/session-lifecycle'
import { readKvJson, writeKvJson } from '../lib/kv'
import { DEFAULT_IDEATE_TEMPLATE } from '../lib/workspace-types'
import type { Env, Session } from '../types'

type Vars = AuthVariables & PlanVariables

const IdeateConfigSchema = z.object({
  dotVoteLimit: z.number().int().min(1).max(20).optional(),
  clusterDebounceMs: z.number().int().min(1000).max(10000).optional(),
})

export type IdeateSessionSeed = {
  dotVoteLimit: number
  clusterDebounceMs: number
}

export function ideateSeedKey(sessionId: string): string {
  return `ideate-seed:${sessionId}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountIdeateSessionRoutes(parent: any) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/sessions/:id/ideate/config', async (c) => {
    const id = c.req.param('id')
    const row = await c.env.DB.prepare(
      `SELECT id, session_mode, status, title, code, workspace_id FROM sessions WHERE id = ?1 AND owner_id = ?2`,
    )
      .bind(id, c.get('user').sub)
      .first<{ id: string; session_mode: string; status: string; title: string; code: string; workspace_id: string | null }>()
    if (!row) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const seed = await readKvJson<IdeateSessionSeed>(c.env.SESSIONS_KV, ideateSeedKey(id))
    return c.json({
      ok: true,
      data: {
        sessionId: row.id,
        sessionMode: row.session_mode,
        status: row.status,
        title: row.title,
        code: row.code,
        workspaceId: row.workspace_id,
        ideateReady: row.session_mode === 'ideate',
        dotVoteLimit: seed?.dotVoteLimit ?? DEFAULT_IDEATE_TEMPLATE.dotVoteLimit,
        clusterDebounceMs: seed?.clusterDebounceMs ?? DEFAULT_IDEATE_TEMPLATE.clusterDebounceMs,
      },
      trace_id: c.get('trace_id'),
    })
  })

  app.post('/sessions/:id/ideate/config', async (c) => {
    const id = c.req.param('id')
    const body = IdeateConfigSchema.safeParse(await c.req.json().catch(() => null))
    if (!body.success) {
      return c.json({ ok: false, error: { code: 'validation', message: 'Invalid ideate config' }, trace_id: c.get('trace_id') }, 400)
    }
    const row = await c.env.DB.prepare(`SELECT id, status, owner_id, workspace_id FROM sessions WHERE id = ?1`)
      .bind(id)
      .first<{ id: string; status: string; owner_id: string; workspace_id: string | null }>()
    if (!row || row.owner_id !== c.get('user').sub) {
      return c.json({ ok: false, error: { code: 'not_found', message: 'Session not found' }, trace_id: c.get('trace_id') }, 404)
    }
    const draftGate = requireDraft({ status: row.status } as Session, 'patch')
    if (!draftGate.ok) {
      return c.json({ ok: false, error: draftGate.error, trace_id: c.get('trace_id') }, 409)
    }
    await c.env.DB.prepare(`UPDATE sessions SET session_mode = 'ideate' WHERE id = ?1`).bind(id).run()
    const existing = (await readKvJson<IdeateSessionSeed>(c.env.SESSIONS_KV, ideateSeedKey(id))) ?? {
      dotVoteLimit: DEFAULT_IDEATE_TEMPLATE.dotVoteLimit,
      clusterDebounceMs: DEFAULT_IDEATE_TEMPLATE.clusterDebounceMs,
    }
    await writeKvJson(c.env.SESSIONS_KV, ideateSeedKey(id), {
      dotVoteLimit: body.data.dotVoteLimit ?? existing.dotVoteLimit,
      clusterDebounceMs: body.data.clusterDebounceMs ?? existing.clusterDebounceMs,
    })
    return c.json({
      ok: true,
      data: { sessionMode: 'ideate', dotVoteLimit: body.data.dotVoteLimit ?? existing.dotVoteLimit },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api', app)
}
