/**
 * IDEATE-CLUSTER-01 — greedy semantic clustering for live ideation boards.
 * Uses embedding cosine similarity when vectors are available; falls back to
 * token overlap for local dev / AI-unavailable environments.
 */

import type { IdeateCluster, IdeateIdea } from './session-room-ideate'
import { ulid } from './ulid'

export const IDEATE_CLUSTER_THRESHOLD = 0.72

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length !== a.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  )
}

export function tokenOverlapScore(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / Math.max(ta.size, tb.size)
}

export function keywordClusterLabel(bodies: string[]): string {
  const words = bodies
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
  if (words.length === 0) return 'Ideas'
  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w)
  return top.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' & ') || 'Ideas'
}

type ClusterSeed = { id: string; centroid: number[] | null; bodies: string[]; ideaIds: string[] }

export function clusterIdeas(
  ideas: IdeateIdea[],
  vectors: Map<string, number[]>,
  threshold = IDEATE_CLUSTER_THRESHOLD,
): IdeateCluster[] {
  const active = ideas.filter((i) => i.status === 'active')
  if (active.length === 0) return []

  const seeds: ClusterSeed[] = []

  for (const idea of active) {
    const vector = vectors.get(idea.id) ?? null
    let best: ClusterSeed | null = null
    let bestScore = threshold

    for (const seed of seeds) {
      let score = 0
      if (vector && seed.centroid) {
        score = cosineSimilarity(vector, seed.centroid)
      } else {
        score = Math.max(...seed.bodies.map((b) => tokenOverlapScore(idea.body, b)))
      }
      if (score > bestScore) {
        bestScore = score
        best = seed
      }
    }

    if (best) {
      best.ideaIds.push(idea.id)
      best.bodies.push(idea.body)
      if (vector && best.centroid) {
        const n = best.ideaIds.length
        best.centroid = best.centroid.map((v, i) => (v * (n - 1) + vector[i]!) / n)
      } else if (vector) {
        best.centroid = vector
      }
    } else {
      seeds.push({
        id: ulid(),
        centroid: vector,
        bodies: [idea.body],
        ideaIds: [idea.id],
      })
    }
  }

  const now = Date.now()
  return seeds.map((s) => ({
    id: s.id,
    label: keywordClusterLabel(s.bodies),
    ideaIds: s.ideaIds,
    updatedAt: now,
  }))
}

export function assignClusterIds(ideas: IdeateIdea[], clusters: IdeateCluster[]): IdeateIdea[] {
  const byIdea = new Map<string, string>()
  for (const c of clusters) for (const id of c.ideaIds) byIdea.set(id, c.id)
  return ideas.map((i) => ({ ...i, clusterId: byIdea.get(i.id) ?? null }))
}
