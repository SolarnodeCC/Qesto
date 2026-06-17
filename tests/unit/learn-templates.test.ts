import { describe, expect, it } from 'vitest'
import { listLearnTemplates, getLearnTemplate, LEARN_TEMPLATES } from '../../functions/api/lib/learn-templates'

describe('LEARN-TEMPLATES-01', () => {
  it('ships pre-quiz, formative check, and post-assessment kinds', () => {
    const kinds = listLearnTemplates().map((t) => t.kind)
    expect(kinds).toContain('pre_quiz')
    expect(kinds).toContain('formative_check')
    expect(kinds).toContain('post_assessment')
  })

  it('every template has an id, i18n key, and at least one question', () => {
    for (const t of LEARN_TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.i18nKey.startsWith('learn.templates.')).toBe(true)
      expect(t.questions.length).toBeGreaterThan(0)
    }
  })

  it('template ids are unique', () => {
    const ids = LEARN_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('getLearnTemplate looks up by id and returns null when missing', () => {
    expect(getLearnTemplate('learn-pre-quiz')?.kind).toBe('pre_quiz')
    expect(getLearnTemplate('nope')).toBeNull()
  })

  it('post-assessment carries graded weights for passback', () => {
    const post = getLearnTemplate('learn-post-assessment')!
    expect(post.questions.some((q) => q.weight > 0)).toBe(true)
  })
})
