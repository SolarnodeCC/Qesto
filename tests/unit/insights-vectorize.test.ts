import { describe, expect, it } from 'vitest'
import {
  DECISIONS_EMBED_DIM,
  DECISIONS_EMBED_MODEL,
  DECISIONS_SIMILARITY_TOP_K,
  embedAndFindSimilarSessionTitles,
  upsertInsightsSessionVector,
} from '../../functions/api/lib/insights-vectorize'

const vector = Array.from({ length: DECISIONS_EMBED_DIM }, (_, i) => i / DECISIONS_EMBED_DIM)

describe('insights-vectorize', () => {
  it('embeds response context and returns similar session titles', async () => {
    const calls: string[] = []
    const env = {
      AI: {
        run: async (model: string) => {
          calls.push(model)
          return { data: [vector] }
        },
      },
      DECISIONS_VECTORIZE: {
        query: async (values: number[], opts: { topK: number; returnMetadata: string }) => {
          expect(values).toBe(vector)
          expect(opts.topK).toBe(DECISIONS_SIMILARITY_TOP_K)
          return {
            matches: [
              { id: 'current-session', score: 0.99, metadata: { title: 'Current' } },
              { id: 'similar-session', score: 0.91, metadata: { title: 'Similar retro' } },
              { id: 'weak-session', score: 0.2, metadata: { title: 'Weak match' } },
            ],
          }
        },
      },
    } as unknown as Parameters<typeof embedAndFindSimilarSessionTitles>[0]

    const result = await embedAndFindSimilarSessionTitles(env, {
      sessionId: 'current-session',
      sessionTitle: 'Retro',
      openResponses: ['CI is slow', 'Standups help'],
    })

    expect(calls).toEqual([DECISIONS_EMBED_MODEL])
    expect(result.vector).toBe(vector)
    expect(result.similarSessionTitles).toEqual(['Similar retro'])
    // No teamId ⇒ nothing surfaces to users (prompt-only titles).
    expect(result.similarSessions).toEqual([])
  })

  it('team-filters the query and surfaces scored matches when teamId is set (REV-27)', async () => {
    let queryOpts: { topK: number; returnMetadata: string; filter?: Record<string, string> } | undefined
    const env = {
      AI: { run: async () => ({ data: [vector] }) },
      DECISIONS_VECTORIZE: {
        query: async (_values: number[], opts: typeof queryOpts) => {
          queryOpts = opts
          return {
            matches: [
              { id: 'similar-session', score: 0.91, metadata: { title: 'Similar retro', team_id: 'team-1' } },
            ],
          }
        },
      },
    } as unknown as Parameters<typeof embedAndFindSimilarSessionTitles>[0]

    const result = await embedAndFindSimilarSessionTitles(env, {
      sessionId: 'current-session',
      sessionTitle: 'Retro',
      openResponses: ['CI is slow'],
      teamId: 'team-1',
    })

    // Tenant safety: the Vectorize query MUST carry the team filter whenever
    // results can become user-visible.
    expect(queryOpts?.filter).toEqual({ team_id: 'team-1' })
    expect(result.similarSessions).toEqual([{ title: 'Similar retro', score: 0.91 }])
  })

  it('upserts with an existing vector without calling AI again', async () => {
    let upserted: unknown
    const env = {
      AI: {
        run: async () => {
          throw new Error('AI should not be called when existing vector is present')
        },
      },
      DECISIONS_VECTORIZE: {
        upsert: async (records: unknown) => {
          upserted = records
        },
      },
    } as unknown as Parameters<typeof upsertInsightsSessionVector>[0]

    await upsertInsightsSessionVector(env, {
      sessionId: 'session-1',
      sessionTitle: 'Retro',
      themeCount: 3,
      existingVector: vector,
    })

    expect(upserted).toEqual([
      {
        id: 'session-1',
        values: vector,
        metadata: {
          session_id: 'session-1',
          title: 'Retro',
          ts: expect.any(String),
          theme_count: '3',
        },
      },
    ])
  })
})
