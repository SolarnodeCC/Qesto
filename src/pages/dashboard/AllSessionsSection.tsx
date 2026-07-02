import { Search } from 'lucide-react'
import { useT } from '../../i18n'
import type { SessionSummary } from '../../hooks/useSessions'
import { inputHint } from '../../ui/input-hint'
import { SEARCH_FIELD_CLASS } from '../../ui/input-field-class'
import type { SessionsListState } from '../../hooks/useSessions'
import type { StatusFilter } from './types'
import { FilterChips } from './FilterChips'
import { SessionCard, SessionCardSkeleton } from './SessionCard'
import type { SessionCardProps } from './SessionCard'

type CardSharedProps = Omit<SessionCardProps, 'session'>

interface AllSessionsSectionProps {
  state: SessionsListState
  sessions: SessionSummary[]
  search: string
  statusFilter: StatusFilter
  onSearchChange: (s: string) => void
  onStatusFilterChange: (f: StatusFilter) => void
  cardProps: CardSharedProps
}

export function AllSessionsSection({
  state,
  sessions,
  search,
  statusFilter,
  onSearchChange,
  onStatusFilterChange,
  cardProps,
}: AllSessionsSectionProps) {
  const t = useT('dashboard')
  return (
    <section id="section-all-sessions" aria-labelledby="all-sessions-heading">
      <div className="flex items-center justify-between mb-4">
        <h2 id="all-sessions-heading" className="text-xl font-semibold text-pulse-900 dark:text-[var(--text-primary)]">
          {t('allSessions')}
        </h2>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pulse-500" />
          <input
            type="search"
            aria-label={t('searchSessions')}
            {...inputHint(t('searchPlaceholder'))}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className={SEARCH_FIELD_CLASS}
          />
        </div>
        <FilterChips value={statusFilter} onChange={onStatusFilterChange} />
      </div>
      {state.status === 'loading' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SessionCardSkeleton key={i} />)}
        </div>
      ) : state.status === 'error' ? (
        <p role="alert" className="text-sm text-red-600">{state.error.message}</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-pulse-500 dark:text-[var(--text-secondary)] py-6 text-center">
          {search || statusFilter !== 'all' ? t('noMatchingSearch') : t('noSessionsYet')}
        </p>
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
