import { describe, expect, it } from 'vitest'
import {
  isSandboxedTool,
  assertSameSessionContext,
  assertNoPiiInOutput,
  enforceCopilotSandbox,
  SANDBOX_FORBIDDEN_TOOLS,
} from '../../functions/api/lib/copilot-sandbox'

describe('SEC-COPILOT-SANDBOX-01', () => {
  it('allows read-only L2 tools', () => {
    expect(isSandboxedTool('cluster_themes')).toBe(true)
    expect(isSandboxedTool('detect_anomaly')).toBe(true)
    expect(isSandboxedTool('recommend_followup')).toBe(true)
  })

  it('blocks mutating / cross-session tools', () => {
    for (const tool of SANDBOX_FORBIDDEN_TOOLS) {
      expect(isSandboxedTool(tool)).toBe(false)
    }
    expect(isSandboxedTool('add_question')).toBe(false)
    expect(isSandboxedTool('unknown_tool')).toBe(false)
  })

  it('blocks cross-session context reads', () => {
    const same = assertSameSessionContext('s1', { sessionId: 's1' })
    expect(same.ok).toBe(true)
    const cross = assertSameSessionContext('s1', { sessionId: 's2' })
    expect(cross.ok).toBe(false)
    if (!cross.ok) expect(cross.reason).toBe('cross_session_read_blocked')
  })

  it('rejects PII in output', () => {
    expect(assertNoPiiInOutput({ themes: [{ label: 'Pricing' }] }).ok).toBe(true)
    expect(assertNoPiiInOutput({ email: 'a@b.com' }).ok).toBe(false)
    expect(assertNoPiiInOutput({ voterId: 'voter-9' }).ok).toBe(false)
  })

  it('enforces the full gate', () => {
    const ok = enforceCopilotSandbox({
      tool: 'cluster_themes',
      sessionId: 's1',
      context: { sessionId: 's1' },
      output: { themes: [{ label: 'Cost' }] },
    })
    expect(ok.ok).toBe(true)

    const crossSession = enforceCopilotSandbox({
      tool: 'cluster_themes',
      sessionId: 's1',
      context: { sessionId: 's2' },
    })
    expect(crossSession.ok).toBe(false)

    const forbidden = enforceCopilotSandbox({
      tool: 'close_session',
      sessionId: 's1',
      context: { sessionId: 's1' },
    })
    expect(forbidden.ok).toBe(false)
    if (!forbidden.ok) expect(forbidden.reason).toBe('tool_not_sandboxed')
  })
})
