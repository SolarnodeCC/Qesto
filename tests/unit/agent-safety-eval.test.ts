import { describe, expect, it } from 'vitest'
import {
  AGENT_ALLOWED_TOOLS,
  isAutonomousActionAllowed,
  isCopilotActionAllowed,
  parseSandboxPolicy,
  validateSandboxPolicy,
  validateToolInvocation,
} from '../../functions/api/lib/agent-safety'
import { COPILOT_ACTION_KINDS } from '../../functions/api/lib/copilot-suggest'

describe('agent-safety-eval (SEC-AGENT-EVAL-01)', () => {
  const basePolicy = {
    maxTurns: 8,
    allowedTools: [...AGENT_ALLOWED_TOOLS],
    requirePresenterConfirm: true,
    blockAutonomousSessionMutations: true,
  }

  it('rejects sandbox policies with unknown tools', () => {
    const policy = {
      ...basePolicy,
      allowedTools: ['suggest_followup', 'evil_tool'] as unknown as typeof basePolicy.allowedTools,
    }
    const errors = validateSandboxPolicy(policy)
    expect(errors.some((e) => e.startsWith('unknown_tools'))).toBe(true)
  })

  it('blocks autonomous session mutations even when listed in policy', () => {
    const result = validateToolInvocation(basePolicy, {
      tool: 'delete_session',
      sessionId: 'sess-1',
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('autonomous_mutation_blocked')
  })

  it('rejects tool payloads containing PII patterns', () => {
    const result = validateToolInvocation(basePolicy, {
      tool: 'suggest_followup',
      sessionId: 'sess-1',
      payload: { note: 'contact voter-abc@corp.com' },
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('pii_in_tool_payload')
  })

  it('requires presenter confirmation for autonomous actions when policy says so', () => {
    expect(
      isAutonomousActionAllowed(basePolicy, { tool: 'draft_poll', confirmedByPresenter: false }),
    ).toBe(false)
    expect(
      isAutonomousActionAllowed(basePolicy, { tool: 'draft_poll', confirmedByPresenter: true }),
    ).toBe(true)
  })

  it('only allows known copilot action kinds', () => {
    for (const kind of COPILOT_ACTION_KINDS) {
      expect(isCopilotActionAllowed(kind)).toBe(true)
    }
    expect(isCopilotActionAllowed('export_pii')).toBe(false)
  })

  it('parses valid sandbox policy JSON', () => {
    const policy = parseSandboxPolicy({
      maxTurns: 5,
      allowedTools: ['suggest_followup', 'draft_poll'],
      requirePresenterConfirm: true,
      blockAutonomousSessionMutations: true,
    })
    expect(policy?.maxTurns).toBe(5)
    expect(validateSandboxPolicy(policy!)).toHaveLength(0)
  })
})
