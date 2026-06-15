import { describe, expect, it } from 'vitest'
import {
  evaluateEmbedTractionGate,
  LEARN_MIN_LIVE_EMBEDS,
} from '../../functions/api/lib/learn-gate'

describe('LEARN-00 EMBED traction gate', () => {
  it('proceeds at exactly the threshold with no incidents', () => {
    const d = evaluateEmbedTractionGate({ liveEmbedCount: LEARN_MIN_LIVE_EMBEDS, openSecurityIncidents: 0 })
    expect(d.proceed).toBe(true)
    expect(d.reason).toContain('embed_traction_met')
  })

  it('defers below the embed threshold', () => {
    const d = evaluateEmbedTractionGate({ liveEmbedCount: 3, openSecurityIncidents: 0 })
    expect(d.proceed).toBe(false)
    expect(d.reason).toContain('below_embed_threshold')
    expect(d.deferTarget).toBe('S96')
  })

  it('defers when there is an open security incident even with enough embeds', () => {
    const d = evaluateEmbedTractionGate({ liveEmbedCount: 50, openSecurityIncidents: 1 })
    expect(d.proceed).toBe(false)
    expect(d.reason).toContain('open_security_incidents')
  })

  it('reports both failures when below threshold and incidents open', () => {
    const d = evaluateEmbedTractionGate({ liveEmbedCount: 2, openSecurityIncidents: 2 })
    expect(d.proceed).toBe(false)
    expect(d.reason).toBe('below_embed_threshold_and_open_incidents')
  })
})
