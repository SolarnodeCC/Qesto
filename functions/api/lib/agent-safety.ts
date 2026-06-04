/**
 * SEC-AGENT-EVAL-01 — agent sandbox policy checks (ADR-0046).
 * Gates autonomous tool dispatch before agent marketplace goes public.
 */
import { z } from 'zod'
import { COPILOT_ACTION_KINDS } from './copilot-suggest'

/** Tools an agent definition may expose (subset of live-session presenter actions). */
export const AGENT_ALLOWED_TOOLS = [
  'suggest_followup',
  'draft_poll',
  'disengagement_alert',
  'pacing_hint',
] as const
export type AgentAllowedTool = (typeof AGENT_ALLOWED_TOOLS)[number]

export const AgentSandboxPolicySchema = z.object({
  maxTurns: z.number().int().min(1).max(20).default(8),
  allowedTools: z.array(z.enum(AGENT_ALLOWED_TOOLS)).min(1).max(AGENT_ALLOWED_TOOLS.length),
  requirePresenterConfirm: z.boolean().default(true),
  blockAutonomousSessionMutations: z.boolean().default(true),
})
export type AgentSandboxPolicy = z.infer<typeof AgentSandboxPolicySchema>

export const AgentToolInvocationSchema = z.object({
  tool: z.string(),
  sessionId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
})
export type AgentToolInvocation = z.infer<typeof AgentToolInvocationSchema>

const BLOCKED_AUTONOMOUS_TOOLS = new Set([
  'delete_session',
  'close_session',
  'archive_session',
  'export_pii',
  'send_email_bulk',
  'stripe_payout',
  'modify_billing',
])

export function parseSandboxPolicy(raw: unknown): AgentSandboxPolicy | null {
  const parsed = AgentSandboxPolicySchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function validateSandboxPolicy(policy: AgentSandboxPolicy): string[] {
  const errors: string[] = []
  if (policy.maxTurns > 12 && !policy.requirePresenterConfirm) {
    errors.push('high_turn_autonomy_requires_presenter_confirm')
  }
  const invalid = policy.allowedTools.filter((t) => !AGENT_ALLOWED_TOOLS.includes(t))
  if (invalid.length > 0) errors.push(`unknown_tools:${invalid.join(',')}`)
  return errors
}

export function validateToolInvocation(
  policy: AgentSandboxPolicy,
  invocation: AgentToolInvocation,
): { allowed: boolean; reason?: string } {
  if (policy.blockAutonomousSessionMutations && BLOCKED_AUTONOMOUS_TOOLS.has(invocation.tool)) {
    return { allowed: false, reason: 'autonomous_mutation_blocked' }
  }
  if (!policy.allowedTools.includes(invocation.tool as AgentAllowedTool)) {
    return { allowed: false, reason: 'tool_not_in_policy' }
  }
  const payload = invocation.payload ?? {}
  if (typeof payload === 'object' && payload !== null) {
    const serialized = JSON.stringify(payload)
    if (/voter-|email|@/i.test(serialized)) {
      return { allowed: false, reason: 'pii_in_tool_payload' }
    }
  }
  return { allowed: true }
}

/** Copilot suggestion kinds are the only autonomous AI outputs today. */
export function isCopilotActionAllowed(kind: string): boolean {
  return (COPILOT_ACTION_KINDS as readonly string[]).includes(kind)
}

export function isAutonomousActionAllowed(
  policy: AgentSandboxPolicy,
  action: { tool: string; confirmedByPresenter?: boolean },
): boolean {
  if (BLOCKED_AUTONOMOUS_TOOLS.has(action.tool)) return false
  if (policy.requirePresenterConfirm && !action.confirmedByPresenter) return false
  return validateToolInvocation(policy, { tool: action.tool, sessionId: 'pending' }).allowed
}
