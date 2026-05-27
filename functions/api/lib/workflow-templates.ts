/**
 * CUSTOM-WORKFLOW-TEMPLATES-01 — curated workflow starters.
 */
import type { WorkflowDefinition } from './workflow-engine'

export type WorkflowTemplate = {
  id: string
  name: string
  description: string
  trigger: WorkflowDefinition['trigger']
  actions: WorkflowDefinition['actions']
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'post-session-slack',
    name: 'Post-session Slack summary',
    description: 'When a session closes, enqueue insights and notify webhook.',
    trigger: 'session.closed',
    actions: [
      { type: 'enqueue_ai_insights', config: {} },
      { type: 'notify_webhook', config: { channel: 'slack' } },
    ],
  },
  {
    id: 'export-failure-dlq',
    name: 'Export failure alert',
    description: 'On webhook failure, tag session for review.',
    trigger: 'webhook.failed',
    actions: [{ type: 'tag_session', config: { tag: 'webhook_failed' } }],
  },
]
