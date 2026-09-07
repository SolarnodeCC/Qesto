import { describe, expect, it } from 'vitest'
import { queryDecisionGrounding } from '../../functions/api/lib/agent-grounding'
import { DECISIONS_EMBED_DIM, DECISIONS_EMBED_MODEL } from '../../functions/api/lib/insights-vectorize'

const vector = Array.from({ length: DECISIONS_EMBED_DIM }, (_, i) => i / DECISIONS_EMBED_DIM)

type QueryOpts = { topK: number; returnMetadata: string; filter?: Record<string, string> }
type GroundingEnv = Parameters<typeof queryDecisionGrounding>[0]

function makeEnv(matches: unknown[], onQuery?: (opts: QueryOpts) => void) {
  const aiCalls: string[] = []
  const env = {
    AI: {
      run: async (model: string) => {
        aiCalls.push(model)
        return { data: [vector] }
      },
    },
    DECISIONS_VECTORIZE: {
      query: async (_values: number[], opts: QueryOpts) => {
        onQuery?.(opts)
        return { matches }
      },
    },
  } as unknown as GroundingEnv
  return { env, aiCalls }
}

describe('queryDecisionGrounding — tenant scope (audit #4)', () => {
  it('returns nothing and never touches AI or Vectorize without a teamId', async () => {
    let queried = false
    const { env, aiCalls } = makeEnv(
      [{ id: 's1', score: 0.9, metadata: { title: 'Acme pricing', team_id: 'team-2' } }],
      () => {
        queried = true
      },
    )

    const out = await queryDecisionGrounding(env, 'pricing strategy', 5)

    expect(out).toEqual([])
    expect(queried).toBe(false)
    expect(aiCalls).toEqual([])
  })

  it('sends the team filter and the v2 string returnMetadata (audit #8)', async () => {
    let seen: QueryOpts | undefined
    const { env, aiCalls } = makeEnv(
      [{ id: 's1', score: 0.9, metadata: { title: 'Our retro', team_id: 'team-1', session_id: 's1' } }],
      (opts) => {
        seen = opts
      },
    )

    await queryDecisionGrounding(env, 'retro themes', 8, 'team-1')

    expect(seen?.filter).toEqual({ team_id: 'team-1' })
    // The legacy boolean form throws on a v2 index.
    expect(seen?.returnMetadata).toBe('all')
    expect(seen?.topK).toBe(8)
    expect(aiCalls).toEqual([DECISIONS_EMBED_MODEL])
  })

  it('drops rows from other teams even when Vectorize returns them', async () => {
    // Simulates a missing metadata index: the filter is accepted but ignored.
    const { env } = makeEnv([
      { id: 'theirs', score: 0.99, metadata: { title: 'Acme layoffs', team_id: 'team-2', session_id: 'theirs' } },
      { id: 'ours', score: 0.80, metadata: { title: 'Our retro', team_id: 'team-1', session_id: 'ours' } },
      { id: 'untagged', score: 0.95, metadata: { title: 'Legacy session' } },
    ])

    const out = await queryDecisionGrounding(env, 'retro', 8, 'team-1')

    expect(out).toEqual([{ id: 'ours', score: 0.8, text: 'Our retro', sessionId: 'ours' }])
  })

  it('reads the metadata keys the upsert actually writes (audit #9)', async () => {
    const { env } = makeEnv([
      { id: 'sess-42', score: 0.88, metadata: { title: 'Q3 planning', team_id: 'team-1', session_id: 'sess-42' } },
    ])

    const out = await queryDecisionGrounding(env, 'planning', 5, 'team-1')

    // Previously `.text`/`.sessionId` were read — neither is ever written, so
    // every chunk degraded to the raw vector id.
    expect(out[0].text).toBe('Q3 planning')
    expect(out[0].sessionId).toBe('sess-42')
  })

  it('skips rows with no usable title rather than echoing the vector id', async () => {
    const { env } = makeEnv([{ id: 'sess-9', score: 0.9, metadata: { team_id: 'team-1' } }])
    const out = await queryDecisionGrounding(env, 'anything', 5, 'team-1')
    expect(out).toEqual([])
  })
})
