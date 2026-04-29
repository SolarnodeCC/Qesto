// Typed handoff DTO: all deterministic data collected before any AI call.
//
// The design principle: nothing probabilistic appears in SessionBundle.
// Every field comes from D1/KV queries. toInsightsInput() converts the bundle
// into the shape expected by extractThemes(), making the deterministic→AI
// boundary explicit, inspectable, and unit-testable without an AI mock.

import type { InsightsInput } from './ai-insights'

export type PollOptionBreakdown = {
  label: string
  votes: number
}

export type QuestionBreakdown = {
  questionId: string
  prompt: string
  kind: 'poll' | 'ranking' | 'consent'
  options: PollOptionBreakdown[]
}

export type SessionBundle = {
  sessionId: string
  sessionTitle: string
  closedAt: number
  openResponses: string[]
  pollBreakdown: QuestionBreakdown[]
  /** Titles of semantically similar past sessions from Vectorize; empty if unavailable. */
  similarSessionTitles: string[]
}

/**
 * Converts a SessionBundle into an InsightsInput suitable for extractThemes().
 * Pure function — deterministic, no I/O.
 */
export function toInsightsInput(bundle: SessionBundle): InsightsInput {
  const pollBreakdown = bundle.pollBreakdown
    .map((q) => ({
      prompt: q.prompt,
      topLabels: [...q.options]
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 3)
        .filter((o) => o.votes > 0)
        .map((o) => `${o.label} (${o.votes})`),
    }))
    .filter((pb) => pb.topLabels.length > 0)

  return {
    sessionTitle: bundle.sessionTitle,
    openResponses: bundle.openResponses,
    pollBreakdown,
    similarSessionTitles: bundle.similarSessionTitles,
  }
}
