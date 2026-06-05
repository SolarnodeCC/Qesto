import { describe, expect, it } from 'vitest'
import {
  assignClusterIds,
  clusterIdeas,
  cosineSimilarity,
  keywordClusterLabel,
  tokenOverlapScore,
} from '../../functions/api/lib/ideate-cluster'
import type { IdeateIdea } from '../../functions/api/lib/session-room-ideate'

function idea(id: string, body: string): IdeateIdea {
  return { id, body, upvotes: 0, clusterId: null, status: 'active', createdAt: 0 }
}

describe('ideate-cluster', () => {
  it('computes cosine similarity for identical vectors', () => {
    const v = [1, 0, 0]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1)
  })

  it('scores token overlap between related phrases', () => {
    const score = tokenOverlapScore('improve deployment pipeline', 'faster deployment releases')
    expect(score).toBeGreaterThan(0.2)
  })

  it('builds keyword labels from cluster bodies', () => {
    expect(keywordClusterLabel(['improve deployment speed', 'faster deployment releases'])).toMatch(/Deployment/i)
  })

  it('clusters similar ideas via token overlap when embeddings are absent', () => {
    const ideas = [
      idea('a', 'improve deployment pipeline speed'),
      idea('b', 'improve deployment pipeline quality'),
      idea('c', 'better lunch options'),
    ]
    const clusters = clusterIdeas(ideas, new Map())
    expect(clusters.length).toBeGreaterThanOrEqual(2)
    const deploymentCluster = clusters.find((c) => c.ideaIds.includes('a') && c.ideaIds.includes('b'))
    expect(deploymentCluster).toBeDefined()
  })

  it('assigns cluster ids back onto ideas', () => {
    const ideas = [idea('a', 'one'), idea('b', 'two')]
    const clusters = [{ id: 'c1', label: 'One', ideaIds: ['a', 'b'], updatedAt: 1 }]
    const updated = assignClusterIds(ideas, clusters)
    expect(updated[0]?.clusterId).toBe('c1')
    expect(updated[1]?.clusterId).toBe('c1')
  })
})
