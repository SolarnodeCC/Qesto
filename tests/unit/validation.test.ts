import { describe, expect, it } from 'vitest'
import {
  CreateSessionSchema,
  PatchSessionSchema,
  PollQuestionSchema,
} from '../../functions/api/lib/domain-schemas'

describe('CreateSessionSchema', () => {
  it('accepts a trimmed non-empty title', () => {
    const parsed = CreateSessionSchema.safeParse({ title: '  Planning  ' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.title).toBe('Planning')
  })

  it('rejects empty title', () => {
    expect(CreateSessionSchema.safeParse({ title: '   ' }).success).toBe(false)
    expect(CreateSessionSchema.safeParse({ title: '' }).success).toBe(false)
  })

  it('rejects titles over 120 chars', () => {
    expect(CreateSessionSchema.safeParse({ title: 'a'.repeat(121) }).success).toBe(false)
  })

  it('rejects missing title', () => {
    expect(CreateSessionSchema.safeParse({}).success).toBe(false)
  })
})

describe('PollQuestionSchema', () => {
  const valid = {
    kind: 'poll' as const,
    prompt: 'What next?',
    options: [
      { id: 'a', label: 'Ship v1' },
      { id: 'b', label: 'Gather feedback' },
    ],
  }

  it('accepts a 2-option poll', () => {
    expect(PollQuestionSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects <2 options', () => {
    expect(PollQuestionSchema.safeParse({ ...valid, options: [valid.options[0]] }).success).toBe(false)
  })

  it('rejects >10 options', () => {
    const options = Array.from({ length: 11 }, (_, i) => ({ id: `o${i}`, label: `opt ${i}` }))
    expect(PollQuestionSchema.safeParse({ ...valid, options }).success).toBe(false)
  })

  it('rejects empty option label', () => {
    expect(
      PollQuestionSchema.safeParse({
        ...valid,
        options: [
          { id: 'a', label: '' },
          { id: 'b', label: 'ok' },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects non-poll kind', () => {
    expect(PollQuestionSchema.safeParse({ ...valid, kind: 'ranking' }).success).toBe(false)
  })
})

describe('PatchSessionSchema', () => {
  it('accepts title only', () => {
    expect(PatchSessionSchema.safeParse({ title: 'Updated' }).success).toBe(true)
  })

  it('accepts question only', () => {
    expect(
      PatchSessionSchema.safeParse({
        question: {
          kind: 'poll',
          prompt: 'Hi?',
          options: [
            { id: 'a', label: 'x' },
            { id: 'b', label: 'y' },
          ],
        },
      }).success,
    ).toBe(true)
  })

  it('rejects empty object', () => {
    expect(PatchSessionSchema.safeParse({}).success).toBe(false)
  })
})
