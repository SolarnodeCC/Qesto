import { useT } from '../../i18n'
import type { SessionSummary } from '../../hooks/useSessions'
import type { SessionsListState } from '../../hooks/useSessions'
import { SessionCard, SessionCardSkeleton } from './SessionCard'
import type { SessionCardProps } from './SessionCard'

type CardSharedProps = Omit<SessionCardProps, 'session'>

interface RecentSessionsSectionProps {
  state: SessionsListState
  sessions: SessionSummary[]
  cardProps: CardSharedProps
}

export function RecentSessionsSection({ state, sessions, cardProps }: RecentSessionsSectionProps) {
  const t = useT('dashboard')
  return (
    <section aria-labelledby="recent-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="recent-heading" className="text-xl font-semibold text-pulse-900 dark:text-[#F0F2F8]">
          {t('recentSessions')}
        </h2>
      </div>
      {state.status === 'loading' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SessionCardSkeleton key={i} />)}
        </div>
      ) : state.status === 'error' ? (
        <p role="alert" className="text-sm text-red-600">{state.error.message}</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('noSessionsYet')}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} {...cardProps} />
          ))}
        </div>
      )}
    </section>
  )
}
