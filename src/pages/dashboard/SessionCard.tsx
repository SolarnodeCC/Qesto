import { useState, useEffect, useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import type { SessionSummary } from '../../types/session'
import { sessionGradient } from '../../utils/sessionGradient'

// Session card, its status badge, and loading skeleton — extracted verbatim
// from Dashboard.tsx (R-05). Already-standalone components; relocating them does
// not change behaviour.

export function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-500 text-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse shrink-0" aria-hidden="true" />
        LIVE
      </span>
    )
  }
  if (status === 'closed' || status === 'archived') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
        Gesloten
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pulse-100 dark:bg-pulse-800 text-pulse-600 dark:text-[#A8B3CC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
      Concept
    </span>
  )
}

export interface SessionCardProps {
  session: SessionSummary
  actionLoading: Record<string, string>
  actionFeedback: Record<string, { message: string; isError: boolean }>
  pendingRemoveId: string | null
  onDuplicate: (id: string, title: string) => void
  onExportCSV: (id: string, title: string) => void
  onSaveAsTemplate: (id: string, title: string) => void
  onRemoveSession: (id: string) => void
  onPendingRemoveChange: (id: string | null) => void
}

export function SessionCard({
  session: s,
  actionLoading,
  actionFeedback,
  pendingRemoveId,
  onDuplicate,
  onExportCSV,
  onSaveAsTemplate,
  onRemoveSession,
  onPendingRemoveChange,
}: SessionCardProps) {
  const t = useT('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const gradient = sessionGradient(s.id)

  const cardLink =
    s.status === 'live'
      ? `/sessions/${s.id}/present`
      : s.status === 'closed' || s.status === 'archived'
      ? `/sessions/${s.id}/results`
      : `/sessions/${s.id}/launchpad`

  const formattedDate = new Date(s.created_at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <article
      className={[
        'group relative flex flex-col rounded-xl border bg-white dark:bg-[#151C2E] shadow-card',
        'hover:shadow-elevated transition-shadow duration-200',
        menuOpen ? 'z-30' : 'z-0',
        s.status === 'live' ? 'border-teal-400 dark:border-teal-600' : 'border-pulse-200 dark:border-[#1E2A45]',
        s.status === 'live' ? 'border-l-[3px] border-l-teal-500' : '',
      ].join(' ')}
      aria-label={`${s.title} — ${s.status}`}
    >
      {/* Gradient thumbnail */}
      <Link
        to={cardLink}
        tabIndex={-1}
        aria-hidden="true"
        className="block overflow-hidden rounded-t-xl"
        style={{ aspectRatio: '16/10', background: gradient }}
      />

      {/* Overlay: status badge + three-dots menu */}
      <div className="absolute top-2 left-2">
        <StatusBadge status={s.status} />
      </div>
      <div ref={menuRef} className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Opties voor ${s.title}`}
          className="flex items-center justify-center w-7 h-7 rounded-md bg-white/80 dark:bg-[#151C2E]/80 backdrop-blur-sm text-pulse-600 dark:text-[#A8B3CC] hover:bg-white dark:hover:bg-[#1C2540] border border-pulse-200 dark:border-[#1E2A45] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
        >
          <MoreHorizontal size={14} aria-hidden="true" />
        </button>
        {menuOpen && (
          <ul
            role="menu"
            className="absolute right-0 bottom-full mb-1 z-50 min-w-[180px] max-h-[min(70vh,320px)] overflow-y-auto rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#1C2540] shadow-elevated py-1 animate-page-enter"
          >
            <li role="none">
              <Link
                to={`/sessions/${s.id}/results`}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                {t('postSessionReview')}
              </Link>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                disabled={actionLoading[s.id] === 'export'}
                onClick={() => { setMenuOpen(false); onExportCSV(s.id, s.title) }}
                className="w-full text-left px-3 py-2 text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
              >
                {t('exportExcel')}
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                disabled={!!actionLoading[s.id]}
                onClick={() => { setMenuOpen(false); onDuplicate(s.id, s.title) }}
                className="w-full text-left px-3 py-2 text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
              >
                {actionLoading[s.id] === 'duplicate' ? t('duplicating') : t('duplicate')}
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                disabled={!!actionLoading[s.id]}
                onClick={() => { setMenuOpen(false); onSaveAsTemplate(s.id, s.title) }}
                className="w-full text-left px-3 py-2 text-sm text-pulse-700 dark:text-[#A8B3CC] hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-700 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50"
              >
                {actionLoading[s.id] === 'template' ? t('saving') : t('template')}
              </button>
            </li>
            <li role="separator" className="my-1 border-t border-pulse-100 dark:border-[#1E2A45]" />
            {pendingRemoveId === s.id ? (
              <li role="none" className="px-3 py-2">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1.5">{t('confirmDelete')}</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={actionLoading[s.id] === 'remove'}
                    onClick={() => { setMenuOpen(false); onRemoveSession(s.id) }}
                    className="flex-1 rounded bg-red-600 text-white text-xs font-medium px-2 py-1 hover:bg-red-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    {actionLoading[s.id] === 'remove' ? t('deleting') : t('yes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onPendingRemoveChange(null) }}
                    className="flex-1 rounded border border-pulse-200 dark:border-[#2A3858] text-xs font-medium px-2 py-1 text-pulse-600 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </li>
            ) : (
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!!actionLoading[s.id]}
                  onClick={() => { onPendingRemoveChange(s.id) }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                >
                  {t('delete')}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-3">
        <Link
          to={cardLink}
          className="block group/title focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
        >
          <p className="text-sm font-semibold text-pulse-900 dark:text-[#F0F2F8] line-clamp-2 group-hover/title:text-teal-600 dark:group-hover/title:text-teal-400 leading-snug">
            {s.title}
          </p>
        </Link>
        <div className="mt-2 flex items-center gap-2 text-xs text-pulse-500 dark:text-[#8A96B0]">
          <code className="font-mono font-semibold tracking-widest bg-pulse-100 dark:bg-pulse-800/60 text-pulse-600 dark:text-[#A8B3CC] rounded-full px-2 py-0.5">
            {s.code}
          </code>
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(s.created_at).toISOString()}>{formattedDate}</time>
        </div>
        {actionFeedback[s.id] && (
          <p className={`mt-1.5 text-xs font-medium ${actionFeedback[s.id].isError ? 'text-red-600' : 'text-teal-600'}`}>
            {actionFeedback[s.id].message}
          </p>
        )}
      </div>
    </article>
  )
}

export function SessionCardSkeleton() {
  return (
    <div className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] overflow-hidden shadow-card" aria-hidden="true">
      <div className="skeleton-shimmer bg-pulse-200 dark:bg-pulse-800" style={{ aspectRatio: '16/10' }} />
      <div className="p-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" />
        <div className="h-3 w-1/2 rounded bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" />
      </div>
    </div>
  )
}
