// Token Health — connection status for the 3 marketing platforms, kept current
// by the daily proactive-refresh cron (functions/api/lib/marketing/token-status.ts).

import { useOauthStatus, type MentionPlatform, type TokenStatusRow } from '../../hooks/useMarketingApi'
import { Heading, Body, Card, Caption, EmptyState, SkeletonCard } from '../../ui/components'

const PLATFORM_LABEL: Record<MentionPlatform, string> = {
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  youtube: 'YouTube',
}

const AUTH_PATH: Record<MentionPlatform, string> = {
  linkedin: '/linkedin-auth',
  reddit: '/reddit-auth',
  youtube: '/youtube-auth',
}

function formatTimestamp(ts: number | null): string {
  return ts ? new Date(ts).toLocaleString() : '—'
}

function PlatformCard({ row }: { row: TokenStatusRow }) {
  const connected = row.connected === 1
  const erroring = !!row.last_refresh_error

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <Heading level="s">{PLATFORM_LABEL[row.platform]}</Heading>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            erroring
              ? 'bg-red-100 text-red-700'
              : connected
                ? 'bg-green-100 text-green-600'
                : 'bg-pulse-100 text-pulse-600'
          }`}
        >
          {erroring ? 'Refresh error' : connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <div className="space-y-1">
        <Caption>Expires</Caption>
        <Body size="s">{formatTimestamp(row.expires_at)}</Body>
      </div>
      <div className="space-y-1">
        <Caption>Last refreshed</Caption>
        <Body size="s">{formatTimestamp(row.last_refreshed_at)}</Body>
      </div>
      {row.last_refresh_error && (
        <Body size="s" className="text-signal-error">{row.last_refresh_error}</Body>
      )}
      <a
        href={AUTH_PATH[row.platform]}
        className="inline-block text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
      >
        {connected ? 'Reconnect' : 'Connect'}
      </a>
    </Card>
  )
}

export default function TokenHealthTab() {
  const { platforms, loading, error, refresh } = useOauthStatus()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Heading level="m" className="border-l-4 border-teal-500 pl-3">Token Health</Heading>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="h-40" />
          ))}
        </div>
      ) : error ? (
        <Body className="text-signal-error">{error}</Body>
      ) : platforms.length === 0 ? (
        <EmptyState title="No token status yet" description="Run the daily oauth-token-refresh cron, or connect a platform below." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {platforms.map((row) => (
            <PlatformCard key={row.platform} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}
