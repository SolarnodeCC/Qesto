// AI eval golden set — session→template anonymisation gates (REV-10, MKTP-008).
//
// The pipeline publishes rewritten customer questions to a public, search-indexed
// gallery. The similarity and proper-noun gates are the privacy controls that
// keep company/person-identifying text out. The invariant this locks in is
// FAIL-CLOSED: any ambiguous or malformed model verdict must NOT admit a
// question. Regressing that (e.g. defaulting an unparseable score to 0) would
// silently leak PII, so this fixture guards the boundary.
import { describe, expect, it } from 'vitest'
import { similarityGateAdmits, properNounGateAdmits } from '../../functions/api/lib/template-gates'
import golden from './fixtures/template-gates-golden.json'

describe('eval: template anonymisation gates (fail-closed)', () => {
  it.each(golden.similarity)('similarity: $name', ({ response, admits }) => {
    expect(similarityGateAdmits(response)).toBe(admits)
  })

  it.each(golden.properNoun)('proper-noun: $name', ({ response, admits }) => {
    expect(properNounGateAdmits(response)).toBe(admits)
  })

  it('never admits on empty/garbage input (fail-closed invariant)', () => {
    for (const garbage of ['', '   ', 'null', 'undefined', '<html>', '{}', '[]']) {
      expect(similarityGateAdmits(garbage)).toBe(false)
      expect(properNounGateAdmits(garbage)).toBe(false)
    }
  })
})
