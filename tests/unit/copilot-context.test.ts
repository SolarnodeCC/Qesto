import { describe, expect, it } from 'vitest'
import { CopilotContextSchema, buildCopilotContext } from '../../functions/api/lib/copilot-context'

describe('copilot-context', () => {
  it('builds versioned context', () => {
    const ctx = buildCopilotContext({
      sessionId: 's1',
      sessionTitle: 'Retro',
      status: 'live',
      anonymity: 'full',
      questionCount: 3,
    })
    expect(ctx.schemaVersion).toBe(1)
    expect(ctx.sessionId).toBe('s1')
  })

  it('rejects invalid schema', () => {
    const r = CopilotContextSchema.safeParse({ schemaVersion: 2 })
    expect(r.success).toBe(false)
  })
})
