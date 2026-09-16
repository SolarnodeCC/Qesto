/**
 * Requirement: knowledge-base/quality/audits/DS_DAY60_ADOPTION_2026-09-16.md — SessionWizard reducer.
 */
import { describe, expect, it } from 'vitest'
import { wizardReducer, WIZARD_INITIAL } from '../../src/components/sessionWizard.reducer'

describe('wizardReducer', () => {
  it('RESET clears to initial when no template', () => {
    const dirty = wizardReducer(WIZARD_INITIAL, { type: 'SET_TITLE', value: 'x' })
    const next = wizardReducer(dirty, { type: 'RESET', template: null })
    expect(next).toEqual(WIZARD_INITIAL)
  })

  it('RESET seeds from template', () => {
    const next = wizardReducer(WIZARD_INITIAL, {
      type: 'RESET',
      template: {
        id: 't1',
        name: 'Retro',
        description: 'Weekly',
        questions: [{ kind: 'poll', prompt: 'Q?', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }],
      },
    })
    expect(next.title).toBe('Retro')
    expect(next.goal).toBe('Weekly')
    expect(next.step2Mode).toBe('template')
    expect(next.questions).toHaveLength(1)
    expect(next.questions[0].accepted).toBe(true)
  })

  it('ADVANCE_AFTER_JUMP_OR returns to overview when jumped', () => {
    let s = wizardReducer(WIZARD_INITIAL, { type: 'JUMP_TO_STEP', step: 2 })
    expect(s.jumpedFrom5).toBe(true)
    s = wizardReducer(s, { type: 'ADVANCE_AFTER_JUMP_OR', next: 3 })
    expect(s.step).toBe(5)
    expect(s.jumpedFrom5).toBe(false)
  })

  it('SET_QUESTIONS accepts updater fn', () => {
    const withOne = wizardReducer(WIZARD_INITIAL, {
      type: 'SET_QUESTIONS',
      value: [{ id: '1', kind: 'open', prompt: 'a', options: [], fromAI: false, dismissed: false, accepted: false }],
    })
    const next = wizardReducer(withOne, {
      type: 'SET_QUESTIONS',
      value: (prev) => [...prev, { id: '2', kind: 'open', prompt: 'b', options: [], fromAI: false, dismissed: false, accepted: false }],
    })
    expect(next.questions.map((q) => q.id)).toEqual(['1', '2'])
  })
})
