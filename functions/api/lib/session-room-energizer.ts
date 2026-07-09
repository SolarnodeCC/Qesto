/**
 * session-room-energizer.ts
 * Pure helper functions for energizer scoring, ranking, leaderboard building.
 * Previously inline in SessionRoom.ts — extracted as part of TD-01 refactor.
 * See TECH_DEBT_AUDIT_2026-05.md TD-01.
 */

import type { LiveEnergizerState } from '../realtime'

// ── Validation ───────────────────────────────────────────────────────────────

export function isValidLiveEnergizer(value: unknown): value is LiveEnergizerState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<LiveEnergizerState>
  const baseValid =
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.title === 'string' &&
    candidate.title.length > 0 &&
    ['quick_finger', 'team_quiz', 'emoji_poll', 'word_cloud', 'bracket', 'battle_royale'].includes(
      candidate.kind ?? '',
    ) &&
    (candidate.status === undefined || candidate.status === 'active' || candidate.status === 'completed')
  if (!baseValid) return false
  if (candidate.kind === 'team_quiz') {
    if (!Array.isArray(candidate.questions) || candidate.questions.length === 0) return false
    return candidate.questions.every((question) => {
      if (!question || typeof question !== 'object') return false
      const q = question as Partial<NonNullable<LiveEnergizerState['questions']>[number]>
      return (
        typeof q.prompt === 'string' &&
        q.prompt.trim().length > 0 &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        q.options.every((option) => typeof option === 'string' && option.trim().length > 0) &&
        typeof q.correctIndex === 'number' &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < q.options.length
      )
    })
  }
  if (candidate.kind !== 'quick_finger') return true
  if (candidate.options !== undefined) {
    if (!Array.isArray(candidate.options) || candidate.options.some((option) => typeof option !== 'string' || option.trim().length === 0)) {
      return false
    }
  }
  if (candidate.correctIndex !== undefined) {
    if (typeof candidate.correctIndex !== 'number' || !Number.isInteger(candidate.correctIndex)) return false
    if (!candidate.options || candidate.correctIndex < 0 || candidate.correctIndex >= candidate.options.length) return false
  }
  return true
}

// ── Initialisation ───────────────────────────────────────────────────────────

export function initialiseLiveEnergizer(energizer: LiveEnergizerState): LiveEnergizerState {
  if (energizer.kind === 'team_quiz') {
    return {
      ...energizer,
      status: 'active',
      startedAt: energizer.startedAt ?? Date.now(),
      currentIndex: 0,
      submissions: [],
      scores: [],
      leaderboard: [],
      badges: {},
    }
  }
  return {
    ...energizer,
    status: 'active',
    startedAt: energizer.startedAt ?? Date.now(),
    answers: [],
    leaderboard: [],
    badges: {},
  }
}

// ── Ranking ───────────────────────────────────────────────────────────────────

export function rankQuickFingerAnswers(
  answers: NonNullable<LiveEnergizerState['answers']>,
): NonNullable<LiveEnergizerState['answers']> {
  const correct = answers
    .filter((a) => a.correct)
    .sort((a, b) => a.speedMs - b.speedMs)
    .map((a, i) => ({ ...a, rank: i + 1 }))
  const incorrect = answers
    .filter((a) => !a.correct)
    .sort((a, b) => a.speedMs - b.speedMs)
    .map((a) => ({ ...a, rank: 0 }))
  return [...correct, ...incorrect]
}

export function rankTeamQuizScores(
  submissions: NonNullable<LiveEnergizerState['submissions']>,
): NonNullable<LiveEnergizerState['scores']> {
  const totals = new Map<string, number>()
  for (const s of submissions) {
    totals.set(s.voterId, (totals.get(s.voterId) ?? 0) + (s.correct ? 1 : 0))
  }
  return [...totals.entries()]
    .map(([voterId, score]) => ({ voterId, score, rank: 0 }))
    .sort((a, b) => b.score - a.score || a.voterId.localeCompare(b.voterId))
    .map((s, i) => ({ ...s, rank: i + 1 }))
}

// ── Score artifacts ───────────────────────────────────────────────────────────

export function withScoreArtifacts(
  energizer: LiveEnergizerState,
  display: 'names' | 'aliases' | 'hidden' = 'names',
  sessionId = '',
): LiveEnergizerState {
  if (energizer.kind === 'quick_finger') return withQuickFingerScoreArtifacts(energizer, display, sessionId)
  if (energizer.kind === 'team_quiz') return withTeamQuizScoreArtifacts(energizer, display, sessionId)
  return energizer
}

function withQuickFingerScoreArtifacts(
  energizer: LiveEnergizerState,
  display: 'names' | 'aliases' | 'hidden',
  sessionId: string,
): LiveEnergizerState {
  const answers = energizer.answers ?? []
  const startedAt = energizer.startedAt ?? 0
  const totals = new Map<string, number>()
  for (const a of answers) {
    const speedBonus = a.rank > 0 ? Math.max(1, 4 - a.rank) : 0
    totals.set(a.voterId, (totals.get(a.voterId) ?? 0) + (a.correct ? 10 + speedBonus : 0))
  }
  const badges = new Map<string, NonNullable<LiveEnergizerState['badges']>[string]>()
  const firstAnswer = [...answers].sort((a, b) => a.speedMs - b.speedMs)[0]
  if (firstAnswer) addBadge(badges, firstAnswer.voterId, energizer.id, 'first_answer', 'First answer', startedAt)
  for (const a of answers.filter((e) => e.rank > 0 && e.rank <= 3)) {
    addBadge(badges, a.voterId, energizer.id, 'speedster', 'Speedster', startedAt)
  }
  return {
    ...energizer,
    badges: Object.fromEntries(badges),
    leaderboard: buildLeaderboard(totals, badges, display, sessionId),
  }
}

function withTeamQuizScoreArtifacts(
  energizer: LiveEnergizerState,
  display: 'names' | 'aliases' | 'hidden',
  sessionId: string,
): LiveEnergizerState {
  const submissions = energizer.submissions ?? []
  const startedAt = energizer.startedAt ?? 0
  const scores = rankTeamQuizScores(submissions)
  const badges = new Map<string, NonNullable<LiveEnergizerState['badges']>[string]>()
  const first = submissions[0]
  if (first) addBadge(badges, first.voterId, energizer.id, 'first_answer', 'First answer', startedAt)
  const byVoter = new Map<string, typeof submissions>()
  for (const s of submissions) byVoter.set(s.voterId, [...(byVoter.get(s.voterId) ?? []), s])
  const totalQ = energizer.questions?.length ?? 0
  for (const [voterId, vs] of byVoter) {
    if (vs.length >= 2) addBadge(badges, voterId, energizer.id, 'engaged', 'Engaged', startedAt)
    if (energizer.status === 'completed' && totalQ > 0 && vs.length >= totalQ && vs.every((s) => s.correct)) {
      addBadge(badges, voterId, energizer.id, 'perfect_trivia', 'Perfect trivia', startedAt)
    }
  }
  const totals = new Map(scores.map((s) => [s.voterId, s.score]))
  return {
    ...energizer,
    scores,
    badges: Object.fromEntries(badges),
    leaderboard: buildLeaderboard(totals, badges, display, sessionId),
  }
}

// ── Viewer redaction ──────────────────────────────────────────────────────────

// How many ranked answers voters may see (the quick-finger podium row).
const VOTER_VISIBLE_RANKS = 3

/**
 * Project an energizer state down to what a given viewer is allowed to see.
 * Presenters get the full state. Voters get a redacted view:
 *  - answer keys (`correctIndex`, per-question `correctIndex`) are stripped
 *    while the energizer is active (revealed once completed),
 *  - `answers` keep only the viewer's own entry plus the top-3 podium
 *    (other voters' raw answer values are blanked),
 *  - `submissions`, `scores` and `badges` keep only the viewer's own rows,
 *  - `leaderboard` passes through (already capped at 10 and display-mode aware).
 * This both closes the answer-key leak and keeps voter payloads O(1) in the
 * participant count instead of shipping every accumulated answer to everyone.
 */
export function redactEnergizerForViewer(
  energizer: LiveEnergizerState,
  viewer: { role: 'presenter' | 'voter'; voterId: string },
): LiveEnergizerState {
  if (viewer.role === 'presenter') return energizer

  const revealAnswers = energizer.status === 'completed'
  const view: LiveEnergizerState = { ...energizer }

  if (!revealAnswers) {
    delete view.correctIndex
    if (view.questions) {
      view.questions = view.questions.map((q) => {
        const { correctIndex: _hidden, ...rest } = q
        return rest as typeof q
      })
    }
  }

  if (view.answers) {
    view.answers = view.answers
      .filter((a) => a.voterId === viewer.voterId || (a.rank >= 1 && a.rank <= VOTER_VISIBLE_RANKS))
      .map((a) => (a.voterId === viewer.voterId ? a : { ...a, value: '' }))
  }
  if (view.submissions) {
    view.submissions = view.submissions.filter((s) => s.voterId === viewer.voterId)
  }
  if (view.scores) {
    view.scores = view.scores.filter((s) => s.voterId === viewer.voterId)
  }
  if (view.badges) {
    const own = view.badges[viewer.voterId]
    view.badges = own ? { [viewer.voterId]: own } : {}
  }
  return view
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function addBadge(
  badges: Map<string, NonNullable<LiveEnergizerState['badges']>[string]>,
  voterId: string,
  energizerId: string,
  kind: NonNullable<LiveEnergizerState['badges']>[string][number]['kind'],
  label: string,
  awardedAt: number,
): void {
  const existing = badges.get(voterId) ?? []
  const id = `${energizerId}:${kind}:${voterId}`
  if (existing.some((b) => b.id === id)) return
  badges.set(voterId, [...existing, { id, kind, label, awardedAt }])
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

const ALIAS_ADJECTIVES = ['Swift', 'Bold', 'Calm', 'Keen', 'Wise', 'Bright', 'Brave', 'Quick', 'Sharp', 'Cool']
const ALIAS_NOUNS = ['Falcon', 'Tiger', 'River', 'Cloud', 'Stone', 'Spark', 'Comet', 'Eagle', 'Frost', 'Blaze']

export function deterministicAlias(voterId: string, sessionId: string): string {
  let h = 5381
  const s = `${sessionId}:${voterId}`
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  const adj = ALIAS_ADJECTIVES[Math.abs(h) % ALIAS_ADJECTIVES.length]
  const noun = ALIAS_NOUNS[Math.abs(h >> 4) % ALIAS_NOUNS.length]
  return `${adj} ${noun}`
}

export function buildLeaderboard(
  totals: Map<string, number>,
  badges: Map<string, NonNullable<LiveEnergizerState['badges']>[string]>,
  display: 'names' | 'aliases' | 'hidden' = 'names',
  sessionId = '',
): NonNullable<LiveEnergizerState['leaderboard']> {
  if (display === 'hidden') return []
  return [...totals.entries()]
    .map(([voterId, score]) => ({ voterId, score }))
    .sort((a, b) => b.score - a.score || a.voterId.localeCompare(b.voterId))
    .slice(0, 10)
    .map((entry, i) => ({
      voterId: display === 'aliases' ? deterministicAlias(entry.voterId, sessionId) : entry.voterId,
      label: display === 'aliases'
        ? deterministicAlias(entry.voterId, sessionId)
        : `Player ${i + 1}`,
      score: entry.score,
      rank: i + 1,
      badges: badges.get(entry.voterId) ?? [],
    }))
}
