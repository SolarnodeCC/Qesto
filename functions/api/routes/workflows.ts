/**
 * WORKFLOW-ENGINE-01 — team workflow definitions (Team plan).
 */
import { Hono } from 'hono'
import { errorResponse } from '../lib/error-handler'
import { z } from 'zod'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import { planMiddleware, type PlanVariables } from '../middleware/plan'
import { validateBody } from '../lib/request-validation'
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
      return errorResponse(c, 400, 'bad_request', 'teamId required')
    }
    const workflows = await listTeamWorkflows(c.env.INTEGRATIONS_KV, teamId)
    return c.json({ ok: true, data: { workflows }, trace_id: c.get('trace_id') })
  })

  app.post('/', async (c) => {
    if (c.get('plan') !== 'team') {
      return errorResponse(c, 403, 'upgrade_required', 'Workflows require Team plan')
    }
    if (!c.env.INTEGRATIONS_KV) {
      return errorResponse(c, 503, 'kv_unavailable', 'INTEGRATIONS_KV required')
    }
    const parsed = await validateBody(c, CreateWorkflowSchema)
    if ('error' in parsed) return parsed.error
    const workflow = await createTeamWorkflow(c.env.INTEGRATIONS_KV, parsed.data)
    return c.json({ ok: true, data: { workflow }, trace_id: c.get('trace_id') }, 201)
  })

  parent.route('/api/workflows', app)
}
