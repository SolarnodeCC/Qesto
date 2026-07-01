// Mentions Feed — brand mentions pulled in by the Mention Monitor cron
// (LinkedIn/Reddit/YouTube official APIs), reviewed and marked here.

import { useState } from 'react'
import { useMentions, type Mention, type MentionPlatform } from '../../hooks/useMarketingApi'
import { Heading, Body, Card, EmptyState, SkeletonCard } from '../../ui/components'

function PlatformBadge({ platform }: { platform: MentionPlatform }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 capitalize">
      {platform}
    </span>
  )
}

function MentionRow({ mention, onToggleReviewed }: { mention: Mention; onToggleReviewed: (id: string, reviewed: boolean) => Promise<unknown> }) {
  const [busy, setBusy] = useState(false)
  const reviewed = mention.reviewed === 1

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={mention.platform} />
          {mention.author && (
            <span className="text-sm font-medium text-pulse-700 dark:text-[var(--text-secondary)]">{mention.author}</span>
          )}
        </div>
        <span className="text-xs text-pulse-500 dark:text-[var(--text-muted)]">
          {new Date(mention.fetched_at).toLocaleString()}
        </span>
      </div>
      <Body size="s" className="whitespace-pre-wrap">{mention.body}</Body>
      <div className="flex items-center gap-3 flex-wrap">
        {mention.url && (
          <a href={mention.url} target="_blank" rel="noopener noreferrer" className="text-sm text-teal-600 dark:text-teal-400 hover:underline">
            View source
          </a>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await onToggleReviewed(mention.id, !reviewed)
            setBusy(false)
          }}
          className={`text-sm font-medium hover:underline ${reviewed ? 'text-pulse-500 dark:text-[var(--text-muted)]' : 'text-teal-600 dark:text-teal-400'}`}
        >
          {reviewed ? 'Mark unreviewed' : 'Mark reviewed'}
        </button>
      </div>
    </Card>
  )
}

export default function MentionsFeedTab() {
  const [platformFilter, setPlatformFilter] = useState<string>('')
  const [reviewedFilter, setReviewedFilter] = useState<string>('0')
  const { mentions, loading, error, markReviewed } = useMentions({
    ...(platformFilter ? { platform: platformFilter } : {}),
    ...(reviewedFilter ? { reviewed: reviewedFilter } : {}),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Mentions Feed</Heading>
        <div className="flex items-center gap-2">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="body-s border border-pulse-300 dark:border-[var(--color-border-strong)] rounded-md px-3 py-1.5 bg-white dark:bg-[var(--color-surface-elevated)] text-pulse-900 dark:text-[var(--text-primary)]"
            aria-label="Filter by platform"
          >
            <option value="">All platforms</option>
            <option value="linkedin">LinkedIn</option>
            <option value="reddit">Reddit</option>
            <option value="youtube">YouTube</option>
          </select>
          <select
            value={reviewedFilter}
            onChange={(e) => setReviewedFilter(e.target.value)}
            className="body-s border border-pulse-300 dark:border-[var(--color-border-strong)] rounded-md px-3 py-1.5 bg-white dark:bg-[var(--color-surface-elevated)] text-pulse-900 dark:text-[var(--text-primary)]"
            aria-label="Filter by reviewed status"
          >
            <option value="0">Unreviewed</option>
            <option value="1">Reviewed</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="h-24" />
          ))}
        </div>
      ) : error ? (
        <Body className="text-signal-error">{error}</Body>
      ) : mentions.length === 0 ? (
        <EmptyState title="No mentions" description="The Mention Monitor cron hasn't found anything matching this filter yet." />
      ) : (
        <div className="space-y-3">
          {mentions.map((mention) => (
            <MentionRow key={mention.id} mention={mention} onToggleReviewed={markReviewed} />
          ))}
        </div>
      )}
    </div>
  )
}
