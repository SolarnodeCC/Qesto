import { describe, expect, it } from 'vitest'
import { __test, SENTIMENT_MIN_RESPONSES } from '../../functions/api/lib/ai/sentiment'
import { buildAiRecapProvenance } from '../../functions/api/lib/ai/recap-provenance'
import type { Session } from '../../functions/api/types'

describe('sentiment (AI-SENTIMENT-01)', () => {
  it('requires minimum response count constant', () => {
    expect(SENTIMENT_MIN_RESPONSES).toBe(5)
  })

  it('detects mostly English text', () => {
    expect(__test.isMostlyEnglish('Great session, very helpful')).toBe(true)
    expect(__test.isMostlyEnglish('')).toBe(false)
    expect(__test.isMostlyEnglish('很好')).toBe(false)
  })

  it('maps distilbert labels to session mood', () => {
    expect(
      __test.moodFromLabels([
        { label: 'POSITIVE' },
        { label: 'POSITIVE' },
        { label: 'POSITIVE' },
        { label: 'NEGATIVE' },
        { label: 'NEGATIVE' },
      ]),
    ).toBe('positive')
    expect(
      __test.moodFromLabels([
        { label: 'NEGATIVE' },
        { label: 'NEGATIVE' },
        { label: 'NEGATIVE' },
        { label: 'POSITIVE' },
      ]),
    ).toBe('concerning')
    expect(__test.moodFromLabels([{ label: 'POSITIVE' }, { label: 'NEGATIVE' }])).toBe('neutral')
  })
})

describe('buildAiRecapProvenance', () => {
  it('marks host_edited when ai_recap_edited_at is set', () => {
    const session = {
      id: 's1',
      owner_id: 'u1',
      title: 'T',
      status: 'closed',
      created_at: 1,
      ai_generated: 1,
      ai_recap_edited_at: 99,
    } as Session
    const prov = buildAiRecapProvenance(session)
    expect(prov.host_edited).toBe(true)
    expect(prov.ai_generated).toBe(true)
  })
})
