// Facilitator (presenter) board for IDEATE sessions (FE-IDEATE-BOARD-01).
//
// Renders:
//   - Dot-vote overlay: facilitator can cast their own dot votes (respects dotVoteLimit)
//   - Clustering view: theme clusters with idea cards (collapse/expand per cluster)
//   - Unclustered ideas with cluster assignment affordance (via existing WS merge)
//   - Prioritization: reveal ranking, sorted list
//   - Moderation: dismiss + merge
//
// Uses the existing useIdeateSession hook — no new transport invented.
// Consistent with RetroPresent column layout convention.

import { useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { ideasForCluster, unclusteredIdeas, type IdeateCluster, type IdeateIdea, type IdeateRankingEntry } from '../hooks/useIdeateSession'
import { CLUSTER_BORDER_COLORS, CLUSTER_BG_COLORS } from './cluster-colors'

type TFn = (key: string, vars?: Record<string, string | number>) => string

// ─── Dot vote tally bar ───────────────────────────────────────────────────────

function DotVoteMeter({
  dotsUsed,
  dotVoteLimit,
  t,
}: {
  dotsUsed: number
  dotVoteLimit: number
  t: TFn
}) {
  const pct = dotVoteLimit > 0 ? (dotsUsed / dotVoteLimit) * 100 : 0
  return (
    <div
      className="flex items-center gap-3"
      role="meter"
      aria-label={t('board.dotMeterAria')}
      aria-valuenow={dotsUsed}
      aria-valuemin={0}
      aria-valuemax={dotVoteLimit}
    >
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-pulse-200 dark:bg-pulse-700">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <span className="shrink-0 text-xs text-pulse-500 dark:text-pulse-400">
        {t('board.dotsUsed', { used: dotsUsed, limit: dotVoteLimit })}
      </span>
    </div>
  )
}

// ─── Ranking list ─────────────────────────────────────────────────────────────

function RankingPanel({ ranking, t }: { ranking: IdeateRankingEntry[]; t: TFn }) {
  if (ranking.length === 0) return null
  return (
    <section
      aria-labelledby="ranking-heading"
      className="rounded-xl border-2 border-violet-300 bg-violet-50 p-4 dark:border-violet-700 dark:bg-violet-900/20"
    >
      <h2
        id="ranking-heading"
        className="mb-3 text-sm font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300"
      >
        {t('prioritize.title')}
      </h2>
      <ol className="space-y-2" aria-label={t('prioritize.title')}>
        {ranking.map((entry) => (
          <li key={entry.ideaId} className="flex items-start gap-3 text-sm">
            <span
              aria-label={`${t('board.rankLabel')} ${entry.rank}`}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white"
            >
              {entry.rank}
            </span>
            <span className="flex-1 text-pulse-800 dark:text-pulse-100">{entry.body}</span>
            <span
              aria-label={t('vote.count', { count: entry.upvotes })}
              className="text-xs text-violet-600 dark:text-violet-400"
            >
              {entry.upvotes} {entry.upvotes === 1 ? t('board.voteSingular') : t('board.votePlural')}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ─── Idea card with facilitator controls ──────────────────────────────────────

type IdeaCardProps = {
  idea: IdeateIdea
  myUpvotes: string[]
  dotsUsed: number
  dotVoteLimit: number
  showCounts: boolean
  mergeSourceId: string | null
  onUpvote: (id: string) => void
  onDismiss: (id: string) => void
  onMergeSelect: (id: string) => void
  onMergeInto: (targetId: string) => void
  t: TFn
}

function FacilitatorIdeaCard({
  idea,
  myUpvotes,
  dotsUsed,
  dotVoteLimit,
  showCounts,
  mergeSourceId,
  onUpvote,
  onDismiss,
  onMergeSelect,
  onMergeInto,
  t,
}: IdeaCardProps) {
  const upvoted = myUpvotes.includes(idea.id)
  const canVote = !upvoted && dotsUsed < dotVoteLimit
  const isMergeSource = mergeSourceId === idea.id
  const canMergeHere = mergeSourceId !== null && mergeSourceId !== idea.id

  return (
    <article
      aria-label={idea.body}
      className={`rounded-lg border px-3 py-2.5 ${
        isMergeSource
          ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20'
          : 'border-pulse-200 bg-white dark:border-pulse-700 dark:bg-pulse-900/30'
      }`}
    >
      <p className="text-sm text-pulse-800 dark:text-pulse-100">{idea.body}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {/* Dot vote */}
        <button
          type="button"
          disabled={!canVote || upvoted}
          onClick={() => onUpvote(idea.id)}
          aria-label={t('vote.aria', { body: idea.body })}
          aria-pressed={upvoted}
          className={`inline-flex min-h-[32px] min-w-[32px] items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
            upvoted
              ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
              : 'bg-pulse-100 text-pulse-700 hover:bg-violet-100 hover:text-violet-700 dark:bg-pulse-800 dark:text-pulse-200'
          } disabled:opacity-50`}
        >
          <span aria-hidden="true">●</span>
          {showCounts ? idea.upvotes : upvoted ? t('vote.voted') : t('vote.dot')}
        </button>

        {/* Dismiss */}
        <button
          type="button"
          onClick={() => onDismiss(idea.id)}
          className="min-h-[32px] rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          aria-label={t('board.dismissAria', { body: idea.body })}
        >
          {t('moderate.dismiss')}
        </button>

        {/* Merge select */}
        {!mergeSourceId && (
          <button
            type="button"
            onClick={() => onMergeSelect(idea.id)}
            className="min-h-[32px] rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
            aria-label={t('board.mergeSelectAria', { body: idea.body })}
          >
            {t('moderate.merge')}
          </button>
        )}

        {/* Merge target */}
        {canMergeHere && (
          <button
            type="button"
            onClick={() => onMergeInto(idea.id)}
            className="min-h-[32px] rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
            aria-label={t('board.mergeIntoAria', { body: idea.body })}
          >
            {t('moderate.mergeHere')}
          </button>
        )}
      </div>
    </article>
  )
}

// ─── Cluster panel ────────────────────────────────────────────────────────────

type ClusterPanelProps = {
  cluster: IdeateCluster
  clusterIndex: number
  ideas: IdeateIdea[]
  myUpvotes: string[]
  dotsUsed: number
  dotVoteLimit: number
  showCounts: boolean
  mergeSourceId: string | null
  onUpvote: (id: string) => void
  onDismiss: (id: string) => void
  onMergeSelect: (id: string) => void
  onMergeInto: (targetId: string) => void
  t: TFn
}

function ClusterPanel({
  cluster,
  clusterIndex,
  ideas,
  myUpvotes,
  dotsUsed,
  dotVoteLimit,
  showCounts,
  mergeSourceId,
  onUpvote,
  onDismiss,
  onMergeSelect,
  onMergeInto,
  t,
}: ClusterPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const clusterIdeas = ideasForCluster(ideas, cluster.id)
  const borderClass = CLUSTER_BORDER_COLORS[clusterIndex % CLUSTER_BORDER_COLORS.length]
  const bgClass = CLUSTER_BG_COLORS[clusterIndex % CLUSTER_BG_COLORS.length]
  const panelId = `cluster-panel-${cluster.id}`

  return (
    <section
      aria-labelledby={`cluster-heading-${cluster.id}`}
      className={`rounded-xl border-2 p-4 ${borderClass} ${bgClass}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3
            id={`cluster-heading-${cluster.id}`}
            className="font-semibold text-pulse-900 dark:text-pulse-100"
          >
            {cluster.label}
          </h3>
          <p className="text-xs text-pulse-500">
            {t('clusters.count', { count: clusterIdeas.length })}
          </p>
        </div>
        <button
          type="button"
          aria-controls={panelId}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
          className="min-h-[44px] min-w-[44px] rounded-lg p-2 text-pulse-500 hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:bg-white/5"
          aria-label={collapsed ? t('board.expandCluster') : t('board.collapseCluster')}
        >
          <ChevronUp
            aria-hidden="true"
            size={16}
            className={`transition-transform duration-150 ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {!collapsed && (
        <div id={panelId} className="mt-3 space-y-2">
          {clusterIdeas.length === 0 ? (
            <p className="text-xs text-pulse-500">{t('board.clusterEmpty')}</p>
          ) : (
            clusterIdeas.map((idea) => (
              <FacilitatorIdeaCard
                key={idea.id}
                idea={idea}
                myUpvotes={myUpvotes}
                dotsUsed={dotsUsed}
                dotVoteLimit={dotVoteLimit}
                showCounts={showCounts}
                mergeSourceId={mergeSourceId}
                onUpvote={onUpvote}
                onDismiss={onDismiss}
                onMergeSelect={onMergeSelect}
                onMergeInto={onMergeInto}
                t={t}
              />
            ))
          )}
        </div>
      )}
    </section>
  )
}

// ─── Main facilitator board export ───────────────────────────────────────────

export type IdeateFacilitatorBoardProps = {
  ideas: IdeateIdea[]
  clusters: IdeateCluster[]
  dotVoteLimit: number
  dotsUsed: number
  myUpvotes: string[]
  rankingRevealed: boolean
  ranking: IdeateRankingEntry[]
  onUpvote: (id: string) => void
  onDismiss: (id: string) => void
  onMerge: (targetId: string, sourceId: string) => void
  onRevealRanking: () => void
  t: TFn
}

export function IdeateFacilitatorBoard({
  ideas,
  clusters,
  dotVoteLimit,
  dotsUsed,
  myUpvotes,
  rankingRevealed,
  ranking,
  onUpvote,
  onDismiss,
  onMerge,
  onRevealRanking,
  t,
}: IdeateFacilitatorBoardProps) {
  const [mergeSourceId, setMergeSourceId] = useState<string | null>(null)
  const activeIdeas = ideas.filter((i) => i.status === 'active')
  const unclustered = unclusteredIdeas(activeIdeas)

  function handleMergeInto(targetId: string) {
    if (!mergeSourceId) return
    onMerge(targetId, mergeSourceId)
    setMergeSourceId(null)
  }

  return (
    <div className="space-y-5" aria-live="polite">
      {/* Dot vote meter */}
      <div className="rounded-lg border border-pulse-200 bg-white p-3 dark:border-pulse-700 dark:bg-pulse-900/40">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-pulse-600 dark:text-pulse-400">
          {t('board.dotVoteTitle')}
        </p>
        <DotVoteMeter dotsUsed={dotsUsed} dotVoteLimit={dotVoteLimit} t={t} />
      </div>

      {/* Merge hint banner */}
      {mergeSourceId && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
        >
          {t('moderate.mergeHint')}{' '}
          <button
            type="button"
            onClick={() => setMergeSourceId(null)}
            className="font-medium underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            {t('moderate.mergeCancel')}
          </button>
        </div>
      )}

      {/* Reveal / refresh ranking */}
      <button
        type="button"
        onClick={onRevealRanking}
        className="min-h-[44px] rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
      >
        {rankingRevealed ? t('prioritize.refresh') : t('prioritize.reveal')}
      </button>

      {/* Ranking panel */}
      {rankingRevealed && <RankingPanel ranking={ranking} t={t} />}

      {/* Cluster columns */}
      {clusters.length > 0 && (
        <section aria-labelledby="clusters-heading">
          <h2
            id="clusters-heading"
            className="mb-3 text-sm font-bold uppercase tracking-wide text-pulse-500"
          >
            {t('clusters.title')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {clusters.map((cluster, idx) => (
              <ClusterPanel
                key={cluster.id}
                cluster={cluster}
                clusterIndex={idx}
                ideas={activeIdeas}
                myUpvotes={myUpvotes}
                dotsUsed={dotsUsed}
                dotVoteLimit={dotVoteLimit}
                showCounts={rankingRevealed}
                mergeSourceId={mergeSourceId}
                onUpvote={onUpvote}
                onDismiss={onDismiss}
                onMergeSelect={setMergeSourceId}
                onMergeInto={handleMergeInto}
                t={t}
              />
            ))}
          </div>
        </section>
      )}

      {/* Unclustered ideas */}
      {unclustered.length > 0 && (
        <section aria-labelledby="unclustered-heading">
          <h3
            id="unclustered-heading"
            className="mb-2 text-sm font-medium text-pulse-600 dark:text-pulse-400"
          >
            {t('clusters.uncategorized')}
          </h3>
          <div className="space-y-2">
            {unclustered.map((idea) => (
              <FacilitatorIdeaCard
                key={idea.id}
                idea={idea}
                myUpvotes={myUpvotes}
                dotsUsed={dotsUsed}
                dotVoteLimit={dotVoteLimit}
                showCounts={rankingRevealed}
                mergeSourceId={mergeSourceId}
                onUpvote={onUpvote}
                onDismiss={onDismiss}
                onMergeSelect={setMergeSourceId}
                onMergeInto={handleMergeInto}
                t={t}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {clusters.length === 0 && unclustered.length === 0 && (
        <p className="text-center text-sm text-pulse-500">{t('board.empty')}</p>
      )}
    </div>
  )
}
