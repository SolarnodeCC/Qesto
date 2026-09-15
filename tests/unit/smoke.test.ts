/**
 * Requirement: knowledge-base/quality/testing/QA_FULL.md §2 — toolchain smoke: the Vitest lane itself runs.
 */
import { describe, expect, it } from 'vitest'

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
