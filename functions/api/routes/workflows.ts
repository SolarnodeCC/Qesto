/**
 * WORKFLOW-ENGINE-01 — team workflow definitions (Team plan).
 */
import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/validate'
import {
  WorkflowTriggerSchema,
  WorkflowActionSchema,
  createTeamWorkflow,
  listTeamWorkflows,
} from '../lib/workflow-engine'
import type { Env } from '../types'

type Vars = AuthVariables & PlanVariables

const CreateWorkflowSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(1).max(120),
  trigger: WorkflowTriggerSchema,
  actions: z.array(WorkflowActionSchema).min(1),
})

export function mountWorkflowRoutes(parent: Hono<{ Bindings: Env; Variables: Vars }>) {
  const app = new Hono<{ Bindings: Env; Variables: Vars }>()
  app.use('*', authMiddleware)
  app.use('*', planMiddleware)

  app.get('/', async (c) => {
    const teamId = c.req.query('teamId')
    if (!teamId || !c.env.INTEGRATIONS_KV) {
      return c.json({ ok: false, error: { code: 'bad_request', message: 'teamId required' }, trace_id: c.get('trace_id') }, 400)
    }
    const workflows = await listTeamWorkflows(c.env.INTEGRATIONS_KV, teamId)
    return c.json({ ok: true, data: { workflows }, trace_id: c.get('trace_id') })
  })

  app.post('/', async (c) => {
    if (c.get('plan') !== 'team') {
      return c.json(
        { ok: false, error: { code: 'upgrade_required', message: 'Workflows require Team plan' }, trace_id: c.get('trace_id') },
        403,
      )
    }
    if (!c.env.INTEGRATIONS_KV) {
      return c.json({ ok: false, error: { code: 'kv_unavailable', message: 'INTEGRATIONS_KV required' }, trace_id: c.get('trace_id') }, 503)
    }
    const parsed = await validateBody(c, CreateWorkflowSchema)
    if ('error' in parsed) return parsed.error
    const workflow = await createTeamWorkflow(c.env.INTEGRATIONS_KV, parsed.data)
    return c.json({ ok: true, data: { workflow }, trace_id: c.get('trace_id') }, 201)
  })

  parent.route('/api/workflows', app)
}
