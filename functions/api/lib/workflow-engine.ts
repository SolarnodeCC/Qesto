/**
 * WORKFLOW-ENGINE-01 — declarative team workflows stored in INTEGRATIONS_KV.
 */
import type { Env } from '../types'
import { z } from 'zod'
import { readKvJson, writeKvJson } from './kv'
import { ulid } from './ulid'

export const WorkflowTriggerSchema = z.enum(['session.closed', 'export.completed', 'webhook.failed'])
export const WorkflowActionSchema = z.object({
  type: z.enum(['notify_webhook', 'enqueue_ai_insights', 'tag_session']),
  config: z.record(z.string(), z.unknown()).default({}),
})

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  trigger: WorkflowTriggerSchema,
  actions: z.array(WorkflowActionSchema).min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>

export function teamWorkflowIndexKey(teamId: string): string {
  return `workflow:index:${teamId}`
}

export function workflowRecordKey(workflowId: string): string {
  return `workflow:def:${workflowId}`
}

export async function listTeamWorkflows(kv: KVNamespace, teamId: string): Promise<WorkflowDefinition[]> {
  const index = (await readKvJson<string[]>(kv, teamWorkflowIndexKey(teamId))) ?? []
  const out: WorkflowDefinition[] = []
  for (const id of index) {
    const raw = await readKvJson<unknown>(kv, workflowRecordKey(id))
    const parsed = raw ? WorkflowDefinitionSchema.safeParse(raw) : null
    if (parsed?.success) out.push(parsed.data)
  }
  return out
}

export async function createTeamWorkflow(
  kv: KVNamespace,
  params: { teamId: string; name: string; trigger: z.infer<typeof WorkflowTriggerSchema>; actions: WorkflowDefinition['actions'] },
): Promise<WorkflowDefinition> {
  const now = Date.now()
  const def: WorkflowDefinition = {
    id: ulid(),
    teamId: params.teamId,
    name: params.name,
    enabled: true,
    trigger: params.trigger,
    actions: params.actions,
    createdAt: now,
    updatedAt: now,
  }
  await writeKvJson(kv, workflowRecordKey(def.id), def)
  const index = (await readKvJson<string[]>(kv, teamWorkflowIndexKey(params.teamId))) ?? []
  if (!index.includes(def.id)) {
    index.push(def.id)
    await writeKvJson(kv, teamWorkflowIndexKey(params.teamId), index)
  }
  return def
}

export async function dispatchWorkflowTrigger(
  kv: KVNamespace | undefined,
  workflowsBinding: Env['WORKFLOWS'],
  teamId: string,
  trigger: z.infer<typeof WorkflowTriggerSchema>,
  payload: Record<string, unknown>,
): Promise<{ queued: number; skipped: number }> {
  if (!kv) return { queued: 0, skipped: 0 }
  const defs = (await listTeamWorkflows(kv, teamId)).filter((d) => d.enabled && d.trigger === trigger)
  let queued = 0
  let skipped = 0
  for (const def of defs) {
    if (workflowsBinding) {
      await workflowsBinding.create({
        id: `workflow-${def.id}-${Date.now()}`,
        params: { workflowId: def.id, teamId, trigger, payload, actions: def.actions },
      })
      queued++
    } else {
      skipped++
    }
  }
  return { queued, skipped }
}
