// AI eval golden set — governance guard matrix (REV-06).
import { describe, expect, it } from 'vitest'
import { checkInsightsAllowed } from '../../functions/api/lib/insights-guards'

describe('eval: insights governance guard', () => {
  it('blocks zero-knowledge sessions', () => {
    const r = checkInsightsAllowed({ anonymity: 'zero_knowledge', ai_generated: 0, ai_consent_at: null })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.code).toBe('zk_not_supported')
  })

  it('blocks ZK even when consent exists (ZK wins)', () => {
    const r = checkInsightsAllowed({ anonymity: 'zero_knowledge', ai_generated: 1, ai_consent_at: Date.now() })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.code).toBe('zk_not_supported')
  })

  it('blocks AI-generated sessions without consent', () => {
    const r = checkInsightsAllowed({ anonymity: 'full', ai_generated: 1, ai_consent_at: null })
    expect(r.allowed).toBe(false)
    if (!r.allowed) expect(r.code).toBe('consent_required')
  })

  it('allows AI-generated sessions with recorded consent', () => {
    expect(checkInsightsAllowed({ anonymity: 'full', ai_generated: 1, ai_consent_at: 1700000000000 }).allowed).toBe(true)
  })

  it('allows plain (non-AI-generated) sessions in any non-ZK anonymity mode', () => {
    for (const anonymity of ['full', 'partial', 'none'] as const) {
      expect(checkInsightsAllowed({ anonymity, ai_generated: 0, ai_consent_at: null }).allowed).toBe(true)
    }
  })

  it('treats missing fields as a plain session (allowed)', () => {
    expect(checkInsightsAllowed({}).allowed).toBe(true)
  })
})
