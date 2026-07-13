import { describe, expect, it } from 'vitest'
import { appendTurn, CopilotThreadSchema } from '../../functions/api/lib/copilot-multiturn'

describe('copilot-multiturn', () => {
  it('appends turns capped at 20', () => {
    let t = CopilotThreadSchema.parse({ sessionId: 's1', turns: [], updatedAt: 0 })
    for (let i = 0; i < 22; i++) {
      t = appendTurn(t, { role: 'user', content: `m${i}`, at: i })
    }
    expect(t.turns.length).toBe(20)
  })
})
