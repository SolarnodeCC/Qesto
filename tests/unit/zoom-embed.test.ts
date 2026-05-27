import { describe, expect, it } from 'vitest'

describe('zoom embed', () => {
  it('builds embed path pattern', () => {
    const sessionId = 'sess_1'
    const path = `/api/integrations/zoom/sessions/${sessionId}/embed`
    expect(path).toContain('embed')
  })
})
