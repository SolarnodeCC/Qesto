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

const Q = (prompt: string, kind = 'poll') => ({
  kind,
  prompt,
  options: [{ label: 'x' }, { label: 'y' }, { label: 'z' }],
})

const VALID_QUESTIONS_JSON = JSON.stringify({
  questions: [
    { kind: 'poll',    prompt: 'What matters most this quarter?', options: [{ label: 'Growth' }, { label: 'Quality' }, { label: 'Speed' }] },
    { kind: 'poll',    prompt: 'Biggest blocker?',                options: [{ label: 'Process' }, { label: 'Tools' }, { label: 'People' }] },
    { kind: 'consent', prompt: 'Proceed with plan?',              options: [{ label: 'Yes' }, { label: 'No' }, { label: 'Abstain' }] },
    { kind: 'ranking', prompt: 'Prioritise these goals:',         options: [{ label: 'Quality' }, { label: 'Speed' }, { label: 'Cost' }] },
    { kind: 'open',    prompt: 'What would you change?',          options: [{ label: 'Processes' }, { label: 'Tools' }] },
  ],
})

describe('ai-wizard/generateQuestions', () => {
  it('parses a clean JSON response into validated questions with ids', async () => {
    const ai = mockAi({ response: VALID_QUESTIONS_JSON })

    const result = await generateQuestions(ai, {
      sessionTitle: 'Q2 Kickoff',
      sessionGoal: 'Align the team on priorities',
    })

    expect(result.questions).toHaveLength(5)
    expect(result.questions[0].id).toMatch(/^[0-9A-HJKMNP-TV-Z]+$/i)
    expect(result.questions[0].options[0].id).toBeTruthy()
    expect(result.confidence).toBeGreaterThan(0.7)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it('strips markdown fences before parsing', async () => {
    const fenced = [Q('Q1?'), Q('Q2?'), Q('Q3?'), Q('Q4?'), Q('Q5?')]
    const ai = mockAi({
      response: '```json\n' + JSON.stringify({ questions: fenced }) + '\n```',
    })

    const result = await generateQuestions(ai, { sessionTitle: 'X', sessionGoal: 'Y' })
    expect(result.questions).toHaveLength(5)
    // Confidence deducted for needing fence trimming AND minimum count.
    expect(result.confidence).toBeLessThan(1)
  })

  it('throws WizardValidationError when JSON is missing', async () => {
    const ai = mockAi({ response: 'I cannot help with that.' })
    await expect(
      generateQuestions(ai, { sessionTitle: 'x', sessionGoal: 'y' }),
    ).rejects.toBeInstanceOf(WizardValidationError)
  })

  it('throws WizardValidationError when schema fails (only one option per question)', async () => {
    const ai = mockAi({
      response: JSON.stringify({
        questions: [
          { kind: 'poll', prompt: 'Question A', options: [{ label: 'x' }] },
          { kind: 'poll', prompt: 'Question B', options: [{ label: 'x' }] },
          { kind: 'poll', prompt: 'Question C', options: [{ label: 'x' }] },
          { kind: 'poll', prompt: 'Question D', options: [{ label: 'x' }] },
          { kind: 'poll', prompt: 'Question E', options: [{ label: 'x' }] },
        ],
      }),
    })
    await expect(
      generateQuestions(ai, { sessionTitle: 'x', sessionGoal: 'y' }),
    ).rejects.toBeInstanceOf(WizardValidationError)
  })

  it('succeeds when AI returns an unknown kind (coerced to poll)', async () => {
    const ai = mockAi({
      response: JSON.stringify({
        questions: [
          { kind: 'multi_choice', prompt: 'Question A?', options: [{ label: 'x' }, { label: 'y' }, { label: 'z' }] },
          Q('Question B?'), Q('Question C?'), Q('Question D?'), Q('Question E?'),
        ],
      }),
    })
    const result = await generateQuestions(ai, { sessionTitle: 'x', sessionGoal: 'y' })
    expect(result.questions[0].kind).toBe('poll')
  })

  it('succeeds when AI returns a consent question with 2 options', async () => {
    const ai = mockAi({
      response: JSON.stringify({
        questions: [
          { kind: 'consent', prompt: 'Proceed?', options: [{ label: 'Yes' }, { label: 'No' }] },
          Q('Question B?'), Q('Question C?'), Q('Question D?'), Q('Question E?'),
        ],
      }),
    })
    const result = await generateQuestions(ai, { sessionTitle: 'x', sessionGoal: 'y' })
    expect(result.questions[0].kind).toBe('consent')
    expect(result.questions[0].options).toHaveLength(2)
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
    expect(result.questions).toHaveLength(5)
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
    expect(result.questions).toHaveLength(5)
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

  it('builds system prompt in Dutch when language is nl', () => {
    const p = __internal.buildSystemPrompt('nl')
    expect(p).toContain('Dutch')
  })

  it('builds system prompt in English when language is en', () => {
    const p = __internal.buildSystemPrompt('en')
    expect(p).toContain('English')
  })

  it('builds system prompt in English when language is unknown', () => {
    const p = __internal.buildSystemPrompt('xx')
    expect(p).toContain('English')
  })

  it('builds system prompt in English when language is undefined', () => {
    const p = __internal.buildSystemPrompt(undefined)
    expect(p).toContain('English')
  })

  it('passes language from input to system prompt', async () => {
    const capturedMessages: Array<{ role: string; content: string }>[] = []
    const ai: Ai = {
      run: async (_model: string, opts: { messages: Array<{ role: string; content: string }> }) => {
        capturedMessages.push(opts.messages)
        return { response: VALID_QUESTIONS_JSON }
      },
    } as unknown as Ai

    await generateQuestions(ai, { sessionTitle: 'T', sessionGoal: 'G', language: 'nl' })
    expect(capturedMessages[0][0].content).toContain('Dutch')
  })
})
