import { describe, expect, it } from 'vitest'
import {
  WizardAIError,
  WizardValidationError,
  generateQuestions,
  streamQuestions,
  __internal,
} from '../../functions/api/lib/ai-wizard'
import type { GeneratedQuestion } from '../../functions/api/lib/ai-wizard'

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

  it('throws WizardValidationError when required prompt text is missing', async () => {
    const ai = mockAi({
      response: JSON.stringify({
        questions: [
          { kind: 'poll', prompt: '', options: [{ label: 'x' }, { label: 'y' }] },
          { kind: 'poll', prompt: '', options: [{ label: 'x' }, { label: 'y' }] },
          { kind: 'poll', prompt: '', options: [{ label: 'x' }, { label: 'y' }] },
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
    expect(callCount).toBe(4)
  })

  it('falls back to secondary model when primary fails all retries', async () => {
    const calledModels: string[] = []
    const ai: Ai = {
      run: async (model: string) => {
        calledModels.push(model as string)
        if (model === __internal.FAST_MODEL) {
          throw new Error('primary model unavailable')
        }
        return { response: VALID_QUESTIONS_JSON }
      },
    } as unknown as Ai

    const result = await generateQuestions(ai, { sessionTitle: 'T', sessionGoal: 'G' })
    expect(result.questions).toHaveLength(5)
    expect(calledModels).toContain(__internal.FAST_MODEL)
    expect(calledModels).toContain(__internal.QUALITY_FALLBACK_MODEL)
  })

  it('uses parallel fast-model batches and compact generation settings by default', async () => {
    const calls: Array<{ model: string; max_tokens: number | undefined; prompt: string }> = []
    const ai: Ai = {
      run: async (model: string, opts: { messages: Array<{ role: string; content: string }>; max_tokens?: number }) => {
        calls.push({ model, max_tokens: opts.max_tokens, prompt: opts.messages.map((m) => m.content).join('\n') })
        return { response: VALID_QUESTIONS_JSON }
      },
    } as unknown as Ai

    await generateQuestions(ai, { sessionTitle: 'T', sessionGoal: 'G' })
    expect(calls).toHaveLength(2)
    expect(calls[0].model).toBe(__internal.FAST_MODEL)
    expect(calls[0].max_tokens).toBe(700)
    expect(calls[0].prompt).toContain('3 to 4')
    expect(calls[0].prompt).toContain('Batch focus:')
    expect(calls[1].prompt).toContain('Batch focus:')
  })

  it('merges unique questions from parallel batches up to the target count', async () => {
    const batchA = JSON.stringify({
      questions: [
        Q('Question A?'),
        Q('Question B?'),
        Q('Question C?'),
        Q('Question D?'),
      ],
    })
    const batchB = JSON.stringify({
      questions: [
        Q('Question D?'),
        Q('Question E?'),
        Q('Question F?'),
        Q('Question G?'),
        Q('Question H?'),
      ],
    })
    let call = 0
    const ai: Ai = {
      run: async () => ({ response: call++ === 0 ? batchA : batchB }),
    } as unknown as Ai

    const result = await generateQuestions(ai, { sessionTitle: 'T', sessionGoal: 'G' })
    expect(result.questions.map((q) => q.prompt)).toEqual([
      'Question A?',
      'Question B?',
      'Question C?',
      'Question D?',
      'Question E?',
      'Question F?',
      'Question G?',
      'Question H?',
    ])
    expect(result.questions).toHaveLength(__internal.TARGET_QUESTION_COUNT)
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

// ── Streaming generation (token streaming + incremental parsing) ──────────────

const { extractCompleteQuestionObjects } = __internal

describe('ai-wizard/extractCompleteQuestionObjects', () => {
  it('returns nothing while the first object is still streaming', () => {
    const partial = '{"questions":[{"kind":"poll","prompt":"Question A?","options":[{"label":"x"}'
    const { objects } = extractCompleteQuestionObjects(partial, 0)
    expect(objects).toEqual([])
  })

  it('extracts each balanced object once it closes', () => {
    const raw = '{"questions":[{"kind":"poll","prompt":"Question A?","options":[{"label":"x"},{"label":"y"}]},{"kind":"open","prompt":"Question B?","options":[{"label":"p"},{"label":"q"}]}]}'
    const { objects } = extractCompleteQuestionObjects(raw, 0)
    expect(objects).toHaveLength(2)
    expect(JSON.parse(objects[0]).prompt).toBe('Question A?')
    expect(JSON.parse(objects[1]).prompt).toBe('Question B?')
  })

  it('does not let braces inside string literals corrupt the depth count', () => {
    const raw = '{"questions":[{"kind":"poll","prompt":"Use {curly} {braces}?","options":[{"label":"a"},{"label":"b"}]}]}'
    const { objects } = extractCompleteQuestionObjects(raw, 0)
    expect(objects).toHaveLength(1)
    expect(JSON.parse(objects[0]).prompt).toBe('Use {curly} {braces}?')
  })

  it('advances the cursor so a follow-up scan only yields new objects', () => {
    const first = '{"questions":[{"kind":"poll","prompt":"Question A?","options":[{"label":"x"},{"label":"y"}]}'
    const r1 = extractCompleteQuestionObjects(first, 0)
    expect(r1.objects).toHaveLength(1)

    const second = first + ',{"kind":"open","prompt":"Question B?","options":[{"label":"p"},{"label":"q"}]}]}'
    const r2 = extractCompleteQuestionObjects(second, r1.cursor)
    expect(r2.objects).toHaveLength(1)
    expect(JSON.parse(r2.objects[0]).prompt).toBe('Question B?')
  })
})

const sq = (n: number) => ({
  kind: 'poll',
  prompt: `Question number ${n}?`,
  options: [{ label: 'Aaa' }, { label: 'Bbb' }],
})
const batchJson = (nums: number[]) => JSON.stringify({ questions: nums.map(sq) })

// Mock Ai whose run() returns a Workers-AI-style SSE ReadableStream, splitting
// the JSON into small deltas to exercise incremental parsing. Each call returns
// the next entry in jsonByCall (the FAST_MODEL path runs two parallel batches).
function sseStreamAi(jsonByCall: string[]): Ai {
  let call = 0
  return {
    run: async () => {
      const json = jsonByCall[Math.min(call, jsonByCall.length - 1)]
      call++
      const enc = new TextEncoder()
      const deltas: string[] = []
      for (let i = 0; i < json.length; i += 17) deltas.push(json.slice(i, i + 17))
      return new ReadableStream<Uint8Array>({
        start(controller) {
          for (const d of deltas) {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ response: d })}\n\n`))
          }
          controller.enqueue(enc.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })
    },
  } as unknown as Ai
}

describe('ai-wizard/streamQuestions', () => {
  it('invokes the callback once per question as it completes', async () => {
    const ai = sseStreamAi([batchJson([1, 2, 3]), batchJson([1, 2, 3])])
    const seen: GeneratedQuestion[] = []
    const result = await streamQuestions(ai, { sessionTitle: 'T', sessionGoal: 'G' }, (q) => {
      seen.push(q)
    })
    // Both batches return the same three prompts → deduped to three.
    expect(seen).toHaveLength(3)
    expect(result.questions).toHaveLength(3)
    expect(seen.map((q) => q.id)).toEqual(result.questions.map((q) => q.id))
    expect(seen[0].options[0].id).toBeTruthy()
  })

  it('caps emitted questions at the target count across batches', async () => {
    const ai = sseStreamAi([batchJson([1, 2, 3, 4, 5]), batchJson([6, 7, 8, 9, 10])])
    let count = 0
    const result = await streamQuestions(ai, { sessionTitle: 'T', sessionGoal: 'G' }, () => {
      count++
    })
    expect(result.questions).toHaveLength(__internal.TARGET_QUESTION_COUNT)
    expect(count).toBe(__internal.TARGET_QUESTION_COUNT)
  })

  it('falls back to a single delta when run() ignores stream:true', async () => {
    // Some environments/mocks return a plain envelope instead of a stream.
    const ai = mockAi({ response: batchJson([1, 2, 3]) })
    const seen: GeneratedQuestion[] = []
    const result = await streamQuestions(ai, { sessionTitle: 'T', sessionGoal: 'G' }, (q) => {
      seen.push(q)
    })
    expect(seen).toHaveLength(3)
    expect(result.questions).toHaveLength(3)
  })

  it('throws when every batch fails', async () => {
    const ai = { run: async () => { throw new Error('boom') } } as unknown as Ai
    await expect(
      streamQuestions(ai, { sessionTitle: 'T', sessionGoal: 'G' }, () => {}),
    ).rejects.toBeInstanceOf(Error)
  })
})
