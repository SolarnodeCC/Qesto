import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspaces, type WorkspaceKind } from '../../hooks/useWorkspaces'
import { WorkspaceHealthPanel } from './WorkspaceHealthPanel'

type Props = {
  teamId: string | undefined
  enabled?: boolean
}

const KIND_LABELS: Record<WorkspaceKind, string> = {
  retro: 'Retrospective',
  ideate: 'Ideation',
  event: 'Event',
}

export function WorkspacePanel({ teamId, enabled = true }: Props) {
  const { workspaces, loading, planGated, createWorkspace, startInstance } = useWorkspaces(teamId)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<WorkspaceKind>('retro')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedHealthId, setExpandedHealthId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (!enabled || !teamId) return null

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setMessage(null)
    const result = await createWorkspace({ kind, title: title.trim(), cadence: 'sprint' })
    setCreating(false)
    if (result.ok) {
      setTitle('')
      setMessage('Workspace created')
    } else {
      setMessage(result.message)
    }
  }

  async function handleStart(workspaceId: string, kind: WorkspaceKind) {
    setBusyId(workspaceId)
    setMessage(null)
    const result = await startInstance(workspaceId)
    setBusyId(null)
    if (result.ok) {
      const path =
        kind === 'retro'
          ? `/sessions/${result.sessionId}/retro`
          : kind === 'ideate'
            ? `/sessions/${result.sessionId}/ideate`
            : kind === 'event'
              ? `/sessions/${result.sessionId}/present`
              : `/sessions/${result.sessionId}/present`
      window.location.href = path
    } else {
      setMessage(result.message)
    }
  }

  if (planGated) {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-900/20 dark:border-violet-700 p-5 space-y-3">
        <h3 className="text-heading-s font-semibold text-violet-900 dark:text-violet-200">Recurring workspaces</h3>
        <p className="text-body-s text-violet-700 dark:text-violet-300">
          Run retros, ideation boards, and multi-session programs with Team plan.
        </p>
        <Link
          to="/pricing"
          className="inline-flex items-center rounded-md bg-violet-600 text-white px-4 py-2 text-sm font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          View plans
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-pulse-200 dark:border-pulse-700 bg-white dark:bg-pulse-900/40 p-5 space-y-4">
      <div>
        <h3 className="text-heading-s font-semibold text-pulse-900 dark:text-pulse-100">Recurring workspaces</h3>
        <p className="text-body-s text-pulse-500 dark:text-pulse-400 mt-1">
          Retros, ideation programs, and hybrid events that span multiple sessions.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1 text-sm flex-1 min-w-0">
          <span className="font-medium text-pulse-700 dark:text-pulse-300">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sprint 42 retro"
            maxLength={120}
            className="min-h-11 rounded-md border border-pulse-300 dark:border-pulse-600 bg-white dark:bg-pulse-800 px-3 text-pulse-900 dark:text-pulse-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-pulse-700 dark:text-pulse-300">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as WorkspaceKind)}
            className="min-h-11 rounded-md border border-pulse-300 dark:border-pulse-600 bg-white dark:bg-pulse-800 px-3"
          >
            <option value="retro">Retro</option>
            <option value="ideate">Ideate</option>
            <option value="event">Event</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="min-h-11 rounded-md bg-pulse-800 text-white px-4 text-sm font-medium hover:bg-pulse-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500"
        >
          {creating ? 'Creating…' : 'Create workspace'}
        </button>
      </form>

      {message && (
        <p className="text-body-s text-pulse-600 dark:text-pulse-300" role="status">
          {message}
        </p>
      )}

      {loading ? (
        <div className="h-16 rounded-md bg-pulse-100 dark:bg-pulse-800 skeleton-shimmer" aria-hidden="true" />
      ) : workspaces.length === 0 ? (
        <p className="text-body-s text-pulse-500">No workspaces yet — create one to start a recurring program.</p>
      ) : (
        <ul className="divide-y divide-pulse-100 dark:divide-pulse-800">
          {workspaces.map((ws) => (
            <li key={ws.id} className="py-3 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-pulse-900 dark:text-pulse-100 truncate">{ws.title}</p>
                  <p className="text-body-s text-pulse-500">
                    {KIND_LABELS[ws.kind]}
                    {ws.cadence ? ` · ${ws.cadence}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {ws.kind === 'event' && teamId && (
                    <a
                      href={`/teams/${teamId}/workspaces/${ws.id}/event`}
                      className="min-h-11 inline-flex items-center rounded-md border border-teal-300 dark:border-teal-600 px-4 text-sm font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                    >
                      Agenda
                    </a>
                  )}
                  {ws.kind === 'retro' && (
                    <button
                      type="button"
                      onClick={() => setExpandedHealthId((id) => (id === ws.id ? null : ws.id))}
                      className="min-h-11 rounded-md border border-pulse-300 dark:border-pulse-600 px-4 text-sm font-medium hover:bg-pulse-50 dark:hover:bg-pulse-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500"
                      aria-expanded={expandedHealthId === ws.id}
                    >
                      {expandedHealthId === ws.id ? 'Hide health' : 'Team health'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleStart(ws.id, ws.kind)}
                    disabled={busyId === ws.id}
                    className="min-h-11 rounded-md border border-pulse-300 dark:border-pulse-600 px-4 text-sm font-medium hover:bg-pulse-50 dark:hover:bg-pulse-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pulse-500"
                  >
                    {busyId === ws.id ? 'Starting…' : 'Start next session'}
                  </button>
                </div>
              </div>
              {ws.kind === 'retro' && expandedHealthId === ws.id && teamId && (
                <WorkspaceHealthPanel
                  teamId={teamId}
                  workspaceId={ws.id}
                  workspaceTitle={ws.title}
                  enabled={enabled}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
