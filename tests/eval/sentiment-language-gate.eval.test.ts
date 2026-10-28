// AI eval golden set — sentiment input gate (issue #528).
// SENTIMENT_MODEL is English-only (DistilBERT SST-2): non-English responses
// must never reach it, or the presenter's mood indicator reports noise for
// Dutch, German, French and Spanish rooms. Corpus: fixtures/sentiment-language.json.
import { describe, expect, it } from 'vitest'
import { __test } from '../../functions/api/lib/ai/sentiment'
import corpus from './fixtures/sentiment-language.json'

describe('eval: sentiment language gate', () => {
  it.each(corpus.english)('passes English: %s', (text) => {
    expect(__test.isMostlyEnglish(text)).toBe(true)
  })

  it.each(corpus.other)('filters non-English: %s', (text) => {
    expect(__test.isMostlyEnglish(text)).toBe(false)
  })
})
