import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useT } from '../i18n'

interface AuditEvent {
  id: string
  ts: number
  actor_id: string
  actor_ip: string
  action: string
  subject_type: string
  subject_id: string
  before_snapshot: string
  after_snapshot: string
  trace_id: string
  idempotency_key: string | null
}

interface AuditResponse {
  events: AuditEvent[]
  total: number
}

const ACTIONS = [
  'session.create',
  'session.start',
  'session.close',
  'session.archive',
  'session.update',
  'question.create',
  'question.update',
  'question.delete',
  'user.role_change',
  'team.create',
  'team.update',
  'team.delete',
  'auth.login',
  'auth.logout',
  'billing.plan_change',
  'insights.generate',
  'energizer.create',
  'energizer.advance',
  'energizer.activate',
  'energizer.complete',
  'energizer.activation_denied',
  'ws.energizer_activated',
  'ws.energizer_activation_denied',
  'ws.energizer_advanced',
  'ws.energizer_completed',
  'ws.energizer_answered',
]

const ACTION_LABELS: Record<string, string> = {
  'energizer.activate': 'Energizer — activate (REST)',
  'energizer.advance': 'Energizer — advance question',
  'energizer.complete': 'Energizer — complete',
  'energizer.activation_denied': 'Energizer — activation denied',
  'ws.energizer_activated': 'WS — energizer activated',
  'ws.energizer_activation_denied': 'WS — activation denied (permission)',
  'ws.energizer_answered': 'WS — participant answered',
  'ws.energizer_advanced': 'WS — question advanced',
  'ws.energizer_completed': 'WS — energizer completed',
}

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

const SUBJECT_TYPES = ['session', 'question', 'user', 'team', 'auth', 'billing', 'insights', 'energizer']

export default function AuditLogViewer() {
  const t = useT('admin')
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [filters, setFilters] = useState({
    action: '',
    subjectType: '',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })
  const [exporting, setExporting] = useState(false)

  const offset = (page - 1) * pageSize
  const totalPages = Math.ceil(total / pageSize)

  useEffect(() => {
    loadAuditLogs()
  }, [page, filters])

  async function loadAuditLogs() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('offset', offset.toString())
      params.set('limit', pageSize.toString())

      if (filters.action) params.set('action', filters.action)
      if (filters.subjectType) params.set('subject_type', filters.subjectType)

      const startTs = new Date(filters.startDate).getTime()
      const endTs = new Date(filters.endDate).getTime() + 86400000 // Include entire day
      params.set('since_ts', startTs.toString())
      params.set('until_ts', endTs.toString())

      const res = await api<AuditResponse>(`/api/admin/audit?${params}`, { method: 'GET' })
      if (res.ok) {
        setEvents(res.data.events ?? [])
        setTotal(res.data.total ?? 0)
      } else {
        setError(res.error.message)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleExportCSV() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('offset', '0')
      params.set('limit', '10000') // Export up to 10k records

      if (filters.action) params.set('action', filters.action)
      if (filters.subjectType) params.set('subject_type', filters.subjectType)

      const startTs = new Date(filters.startDate).getTime()
      const endTs = new Date(filters.endDate).getTime() + 86400000
      params.set('since_ts', startTs.toString())
      params.set('until_ts', endTs.toString())

      const res = await api<AuditResponse>(`/api/admin/audit?${params}`, { method: 'GET' })
      if (!res.ok) {
        setError('Export failed')
        return
      }

      const csvRows = [
        ['Timestamp', 'User ID', 'Action', 'Subject Type', 'Subject ID', 'Before', 'After'].join(','),
        ...(res.data.events ?? []).map((e) =>
          [
            new Date(e.ts).toISOString(),
            e.actor_id || 'unknown',
            e.action,
            e.subject_type,
            e.subject_id,
            e.before_snapshot.slice(0, 50),
            e.after_snapshot.slice(0, 50),
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(','),
        ),
      ].join('\n')

      const a = document.createElement('a')
      a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRows)
      a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      setError('Export failed: ' + (err as Error).message)
    } finally {
      setExporting(false)
    }
  }

  function resetFilters() {
    setFilters({
      action: '',
      subjectType: '',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    })
    setPage(1)
  }

  const formatSnapshot = (snapshot: string) => {
    try {
      const obj = JSON.parse(snapshot)
      return JSON.stringify(obj).slice(0, 60) + '...'
    } catch {
      return 'Invalid JSON'
    }
  }

  const getActionBadge = (action: string) => {
    if (action.startsWith('ws.energizer_activation_denied') || action.startsWith('ws.energizer_advance_denied')) {
      return 'rounded bg-red-100 px-2 py-1 text-xs text-red-700 font-mono'
    }
    if (action.startsWith('ws.energizer_activated') || action.startsWith('energizer.activate')) {
      return 'rounded bg-teal-100 px-2 py-1 text-xs text-teal-700 font-mono'
    }
    if (action.startsWith('ws.energizer_completed') || action.startsWith('energizer.complete')) {
      return 'rounded bg-violet-100 px-2 py-1 text-xs text-violet-700 font-mono'
    }
    if (action.startsWith('ws.energizer_advanced') || action.startsWith('energizer.advance')) {
      return 'rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 font-mono'
    }
    if (action.startsWith('ws.energizer_answered') || action.startsWith('ws.energizer')) {
      return 'rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 font-mono'
    }
    if (action.startsWith('energizer.')) {
      return 'rounded bg-teal-50 px-2 py-1 text-xs text-teal-700 font-mono border border-teal-200'
    }
    return 'rounded bg-pulse-100 px-2 py-1 text-xs text-pulse-700 font-mono'
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">{t('auditLog')}</h2>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label htmlFor="action-filter" className="block text-xs font-medium text-pulse-700 dark:text-[#A8B3CC] mb-1">
              Action
            </label>
            <select
              id="action-filter"
              value={filters.action}
              onChange={(e) => {
                setFilters({ ...filters, action: e.target.value })
                setPage(1)
              }}
              className="w-full rounded-md border border-pulse-200 bg-white dark:bg-[#1C2540] px-3 py-2 text-sm text-pulse-800 dark:text-[#F0F2F8] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20"
            >
              <option value="">All actions</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {formatActionLabel(a)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="subject-filter" className="block text-xs font-medium text-pulse-700 dark:text-[#A8B3CC] mb-1">
              Subject Type
            </label>
            <select
              id="subject-filter"
              value={filters.subjectType}
              onChange={(e) => {
                setFilters({ ...filters, subjectType: e.target.value })
                setPage(1)
              }}
              className="w-full rounded-md border border-pulse-200 bg-white dark:bg-[#1C2540] px-3 py-2 text-sm text-pulse-800 dark:text-[#F0F2F8] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20"
            >
              <option value="">All types</option>
              {SUBJECT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="start-date" className="block text-xs font-medium text-pulse-700 dark:text-[#A8B3CC] mb-1">
              Start Date
            </label>
            <input
              id="start-date"
              type="date"
              value={filters.startDate}
              onChange={(e) => {
                setFilters({ ...filters, startDate: e.target.value })
                setPage(1)
              }}
              className="w-full rounded-md border border-pulse-200 bg-white dark:bg-[#1C2540] px-3 py-2 text-sm text-pulse-800 dark:text-[#F0F2F8] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20"
            />
          </div>

          <div>
            <label htmlFor="end-date" className="block text-xs font-medium text-pulse-700 dark:text-[#A8B3CC] mb-1">
              End Date
            </label>
            <input
              id="end-date"
              type="date"
              value={filters.endDate}
              onChange={(e) => {
                setFilters({ ...filters, endDate: e.target.value })
                setPage(1)
              }}
              className="w-full rounded-md border border-pulse-200 bg-white dark:bg-[#1C2540] px-3 py-2 text-sm text-pulse-800 dark:text-[#F0F2F8] focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-md border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-transparent text-pulse-700 dark:text-[#A8B3CC] px-4 py-2 text-sm font-medium hover:bg-teal-50 dark:hover:bg-teal-900/20 hover:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 text-sm text-pulse-600 dark:text-[#A8B3CC] hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* Table */}
      {error && (
        <div role="alert" className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-pulse-100 skeleton-shimmer" aria-hidden="true" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-md border border-pulse-200 p-6 text-center text-sm text-pulse-500">
          No audit events found
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-pulse-200 dark:border-[#1E2A45]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pulse-200 dark:border-[#1E2A45] bg-pulse-50 dark:bg-[#0F1525]">
                  <th className="px-4 py-3 text-left font-medium text-pulse-700 dark:text-[#A8B3CC]">Timestamp</th>
                  <th className="px-4 py-3 text-left font-medium text-pulse-700 dark:text-[#A8B3CC]">User</th>
                  <th className="px-4 py-3 text-left font-medium text-pulse-700 dark:text-[#A8B3CC]">Action</th>
                  <th className="px-4 py-3 text-left font-medium text-pulse-700 dark:text-[#A8B3CC]">Subject</th>
                  <th className="px-4 py-3 text-left font-medium text-pulse-700 dark:text-[#A8B3CC]">Subject ID</th>
                  <th className="px-4 py-3 text-left font-medium text-pulse-700 dark:text-[#A8B3CC]">{t('changeSummary')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pulse-200 dark:divide-[#1E2A45]">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-pulse-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3 text-pulse-700 dark:text-[#A8B3CC]">
                      {new Date(event.ts).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-pulse-700 dark:text-[#A8B3CC] font-mono text-xs">
                      {event.actor_id || 'system'}
                    </td>
                    <td className="px-4 py-3">
                      <code className={getActionBadge(event.action)} title={event.action}>
                        {formatActionLabel(event.action)}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-pulse-700 dark:text-[#A8B3CC]">{event.subject_type}</td>
                    <td className="px-4 py-3 text-pulse-700 dark:text-[#A8B3CC] font-mono text-xs">
                      {event.subject_id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-pulse-600 dark:text-[#8A96B0] text-xs">
                      {event.before_snapshot && event.after_snapshot
                        ? `before: ${formatSnapshot(event.before_snapshot)}`
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-pulse-600 dark:text-[#8A96B0]">
              Showing {offset + 1}–{Math.min(offset + pageSize, total)} of {total} entries
            </div>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="rounded-md border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-transparent text-pulse-700 dark:text-[#A8B3CC] px-3 py-2 text-sm font-medium hover:bg-teal-50 dark:hover:bg-teal-900/20 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                Previous
              </button>
              <div className="flex items-center gap-1 text-xs text-pulse-600 dark:text-[#8A96B0]">
                Page {page} of {totalPages || 1}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-md border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-transparent text-pulse-700 dark:text-[#A8B3CC] px-3 py-2 text-sm font-medium hover:bg-teal-50 dark:hover:bg-teal-900/20 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
