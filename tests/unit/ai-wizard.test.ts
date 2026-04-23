import { describe, expect, it } from 'vitest'
import {
  WizardAIError,
  WizardValidationError,
  generateQuestions,
  __internal,
} from '../../functions/api/lib/ai-wizard'

function mockAi(response: unknown): Ai {
  return {
    run: async () => response,
  } as unknown as Ai
}

const VALID_QUESTIONS_JSON = JSON.stringify({
  questions: [
    {
      kind: 'poll',
      prompt: 'What matters most this quarter?',
      options: [{ label: 'Growth' }, { label: 'Quality' }, { label: 'Speed' }],
    },
    {
      kind: 'poll',
      prompt: 'Biggest blocker?',
      options: [{ label: 'Process' }, { label: 'Tools' }, { label: 'People' }],
    },
    {
      kind: 'consent',
      prompt: 'Proceed with plan?',
      options: [{ label: 'Yes' }, { label: 'No' }, { label: 'Abstain' }],
    },
  ],
})

describe('ai-wizard/generateQuestions', () => {
  it('parses a clean JSON response into validated questions with ids', async () => {
    const ai = mockAi({ response: VALID_QUESTIONS_JSON })

    const result = await generateQuestions(ai, {
      sessionTitle: 'Q2 Kickoff',
      sessionGoal: 'Align the team on priorities',
    })

    expect(result.questions).toHaveLength(3)
    expect(result.questions[0].id).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/i)
    expect(result.questions[0].options[0].id).toBeTruthy()
    expect(result.confidence).toBeGreaterThan(0.7)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('strips markdown fences before parsing', async () => {
    const ai = mockAi({
      response:
        '```json\n{\n  "questions": [\n    {"kind":"poll","prompt":"First question?","options":[{"label":"x"},{"label":"y"},{"label":"z"}]},\n    {"kind":"poll","prompt":"Second question?","options":[{"label":"x"},{"label":"y"},{"label":"z"}]},\n    {"kind":"poll","prompt":"Third question?","options":[{"label":"x"},{"label":"y"},{"label":"z"}]}\n  ]\n}\n```',
    })

    const result = await generateQuestions(ai, {
      sessionTitle: 'X',
      sessionGoal: 'Y',
    })
    expect(result.questions).toHaveLength(3)
    // Confidence deducted for needing fence trimming AND minimum count.
    expect(result.confidence).toBeLessThan(1)
  })

  it('throws WizardValidationError when JSON is missing', async () => {
    const ai = mockAi({ response: 'I cannot help with that.' })
    await expect(
      generateQuestions(ai, { sessionTitle: 'x', sessionGoal: 'y' }),
    ).rejects.toBeInstanceOf(WizardValidationError)
  })

  it('throws WizardValidationError when schema fails (too few options)', async () => {
    const ai = mockAi({
      response: JSON.stringify({
        questions: [
          { kind: 'poll', prompt: 'Question A', options: [{ label: 'x' }, { label: 'y' }] },
          { kind: 'poll', prompt: 'Question B', options: [{ label: 'x' }, { label: 'y' }] },
          { kind: 'poll', prompt: 'Question C', options: [{ label: 'x' }, { label: 'y' }] },
        ],
      }),
    })
    await expect(
      generateQuestions(ai, { sessionTitle: 'x', sessionGoal: 'y' }),
    ).rejects.toBeInstanceOf(WizardValidationError)
  })

  it('throws WizardAIError when AI returns empty string', async () => {
    const ai = mockAi({ response: '' })
    await expect(
      generateQuestions(ai, { sessionTitle: 'x', sessionGoal: 'y' }),
    ).rejects.toBeInstanceOf(WizardAIError)
  })

  it('throws WizardAIError when AI.run itself throws', async () => {
    const ai = {
      run: async () => {
        throw new Error('model down')
      },
    } as unknown as Ai
    await expect(
      generateQuestions(ai, { sessionTitle: 'x', sessionGoal: 'y' }),
    ).rejects.toBeInstanceOf(WizardAIError)
  })

  it('succeeds after transient failures (retry logic)', async () => {
    let callCount = 0
    const ai: Ai = {
      run: async () => {
        callCount++
        if (callCount < 3) throw new Error('transient error')
        return { response: VALID_QUESTIONS_JSON }
      },
    } as unknown as Ai

    const result = await generateQuestions(ai, { sessionTitle: 'T', sessionGoal: 'G' })
    expect(result.questions).toHaveLength(3)
    expect(callCount).toBe(3)
  })

  it('falls back to secondary model when primary fails all retries', async () => {
    const calledModels: string[] = []
    const ai: Ai = {
      run: async (model: string) => {
        calledModels.push(model as string)
        if (model === '@cf/meta/llama-3.3-70b-instruct-fp8-fast') {
          throw new Error('primary model unavailable')
        }
        return { response: VALID_QUESTIONS_JSON }
      },
    } as unknown as Ai

    const result = await generateQuestions(ai, { sessionTitle: 'T', sessionGoal: 'G' })
    expect(result.questions).toHaveLength(3)
    expect(calledModels).toContain(__internal.FALLBACK_MODEL)
  })

  it('builds user prompt with focus area when provided', () => {
    const p = __internal.buildUserPrompt({
      sessionTitle: 'T',
      sessionGoal: 'G',
      focusArea: 'F',
    })
    expect(p).toContain('Session title: T')
    expect(p).toContain('Session goal: G')
    expect(p).toContain('Focus area: F')
  })
})
