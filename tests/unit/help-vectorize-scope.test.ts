import { describe, expect, it } from 'vitest'
import {
  HELP_EMBED_DIM,
  HELP_SIMILARITY_FETCH_K,
  HELP_SIMILARITY_TOP_K,
  embedAndFindSimilarDocuments,
} from '../../functions/api/lib/help-vectorize'

const vector = Array.from({ length: HELP_EMBED_DIM }, (_, i) => i / HELP_EMBED_DIM)

type Meta = { document_id: string; title: string; topic: string; scope: string }

function makeEnv(matches: Array<{ id: string; score: number; metadata: Meta }>) {
  let topK: number | undefined
  const env = {
    AI: { run: async () => ({ data: [vector] }) },
    HELP_VECTORIZE: {
      query: async (_v: number[], opts: { topK: number }) => {
        topK = opts.topK
        return { matches: matches.slice(0, opts.topK) }
      },
    },
  } as unknown as Parameters<typeof embedAndFindSimilarDocuments>[0]
  return { env, seenTopK: () => topK }
}

function doc(id: string, scope: string, score: number) {
  return { id, score, metadata: { document_id: id, title: `Doc ${id}`, topic: 'general', scope } }
}

describe('help scope filtering (audit #21)', () => {
  it('over-fetches candidates so scope filtering has headroom', async () => {
    const { env, seenTopK } = makeEnv([doc('a', 'free', 0.9)])
    await embedAndFindSimilarDocuments(env, { question: 'how do I vote?', userScope: 'free' })
    expect(seenTopK()).toBe(HELP_SIMILARITY_FETCH_K)
    expect(HELP_SIMILARITY_FETCH_K).toBeGreaterThan(HELP_SIMILARITY_TOP_K)
  })

  it('still answers a free user when the nearest documents are all team-scoped', async () => {
    // Previously topK was 3: these three would fill the window, all get
    // filtered out, and the user would receive nothing.
    const { env } = makeEnv([
      doc('t1', 'team', 0.95),
      doc('t2', 'team', 0.94),
      doc('t3', 'team', 0.93),
      doc('f1', 'free', 0.92),
    ])

    const { similarDocuments } = await embedAndFindSimilarDocuments(env, {
      question: 'how do I vote?',
      userScope: 'free',
    })

    expect(similarDocuments.map((d) => d.documentId)).toEqual(['f1'])
  })

  it('never returns more than HELP_SIMILARITY_TOP_K documents', async () => {
    const { env } = makeEnv(
      Array.from({ length: 10 }, (_, i) => doc(`f${i}`, 'free', 0.9 - i * 0.01)),
    )

    const { similarDocuments } = await embedAndFindSimilarDocuments(env, {
      question: 'how do I vote?',
      userScope: 'team',
    })

    expect(similarDocuments).toHaveLength(HELP_SIMILARITY_TOP_K)
  })

  it('still excludes premium documents from a free user', async () => {
    const { env } = makeEnv([doc('t1', 'team', 0.95), doc('s1', 'starter', 0.94), doc('f1', 'free', 0.93)])

    const { similarDocuments } = await embedAndFindSimilarDocuments(env, {
      question: 'billing?',
      userScope: 'free',
    })

    expect(similarDocuments.map((d) => d.scope)).toEqual(['free'])
  })
})
