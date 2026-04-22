import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api/client'

interface Team {
  id: string
  name: string
}

interface TeamsData {
  teams: Team[]
}

const ACTIVE_TEAM_KEY = 'activeTeamId'

function getActiveTeamId(): string | null {
  return localStorage.getItem(ACTIVE_TEAM_KEY)
}

function setActiveTeamId(id: string): void {
  localStorage.setItem(ACTIVE_TEAM_KEY, id)
  window.dispatchEvent(new CustomEvent('teamswitch', { detail: { teamId: id } }))
}

export default function TeamSwitcher() {
  const [teams, setTeams] = useState<Team[]>([])
  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(getActiveTeamId)
  const [open, setOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // ── Load teams ─────────────────────────────────────────────────────────────

  const loadTeams = useCallback(() => {
    void api<TeamsData>('/api/teams').then((res) => {
      if (res.ok) {
        setTeams(res.data.teams)
        // Auto-select first team if nothing is stored
        if (!getActiveTeamId() && res.data.teams.length > 0) {
          const firstId = res.data.teams[0].id
          setActiveTeamId(firstId)
          setActiveTeamIdState(firstId)
        }
      } else {
        setLoadError(true)
      }
    })
  }, [])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  // ── Focus management for modal ─────────────────────────────────────────────

  useEffect(() => {
    if (showCreateModal) {
      // Small defer to ensure element is in DOM before focusing
      const t = setTimeout(() => nameInputRef.current?.focus(), 32)
      return () => clearTimeout(t)
    }
  }, [showCreateModal])

  // ── Close dropdown on outside click ───────────────────────────────────────

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // ── Close dropdown on Escape ───────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  // ── Modal Escape ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!showCreateModal) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowCreateModal(false)
        setNewTeamName('')
        setCreateError(null)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showCreateModal])

  // ── Switch team ────────────────────────────────────────────────────────────

  function handleSwitch(teamId: string) {
    setActiveTeamId(teamId)
    setActiveTeamIdState(teamId)
    setOpen(false)
  }

  // ── Create team ────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const name = newTeamName.trim()
    if (!name) return
    setCreating(true)
    setCreateError(null)
    const res = await api<{ team: Team }>('/api/teams', {
      method: 'POST',
      body: { name },
    })
    setCreating(false)
    if (res.ok) {
      const created = res.data.team
      setTeams((prev) => [...prev, created])
      setActiveTeamId(created.id)
      setActiveTeamIdState(created.id)
      setNewTeamName('')
      setShowCreateModal(false)
    } else {
      setCreateError(res.error.message)
    }
  }

  const activeTeam = teams.find((t) => t.id === activeTeamId)

  // ── Derived label ──────────────────────────────────────────────────────────

  let label: string
  if (loadError) {
    label = 'Teams unavailable'
  } else if (teams.length === 0) {
    label = 'Create your first team'
  } else {
    label = activeTeam?.name ?? 'Select team'
  }

  return (
    <>
      {/* ── Trigger button ───────────────────────────────────────────────── */}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Active team: ${label}. Switch team`}
          onClick={() => {
            if (teams.length === 0 && !loadError) {
              setShowCreateModal(true)
            } else {
              setOpen((v) => !v)
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-pulse-200 bg-white px-3 py-1.5 text-sm font-medium text-pulse-800 hover:border-teal-400 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 min-h-[44px]"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-pulse-400 shrink-0" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M9.586 2.586a2 2 0 112.828 2.828l-6 6a2 2 0 000 2.828l6 6a2 2 0 102.828-2.828L9.414 12H15a1 1 0 100-2H9.414l3.828-3.828a2 2 0 000-2.828z"
              clipRule="evenodd"
            />
          </svg>
          <span className="max-w-[140px] truncate">{label}</span>
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-pulse-400 shrink-0" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* ── Dropdown listbox ────────────────────────────────────────────── */}
        {open && (
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="Teams"
            className="absolute right-0 top-full mt-1 z-40 w-56 rounded-xl border border-pulse-200 bg-white shadow-lg py-1 animate-page-enter"
          >
            {teams.map((team) => (
              <button
                key={team.id}
                role="option"
                aria-selected={team.id === activeTeamId}
                type="button"
                onClick={() => handleSwitch(team.id)}
                className={[
                  'w-full text-left px-4 py-2 text-sm flex items-center gap-2 min-h-[44px]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500',
                  team.id === activeTeamId
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-pulse-700 hover:bg-pulse-50',
                ].join(' ')}
              >
                {team.id === activeTeamId && (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {team.id !== activeTeamId && <span className="w-4 shrink-0" />}
                <span className="truncate">{team.name}</span>
              </button>
            ))}

            <div className="border-t border-pulse-100 my-1" />

            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setShowCreateModal(true)
              }}
              className="w-full text-left px-4 py-2 text-sm text-teal-600 hover:bg-teal-50 flex items-center gap-2 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              Create team
            </button>
          </div>
        )}
      </div>

      {/* ── Create team modal ─────────────────────────────────────────────── */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-team-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false)
              setNewTeamName('')
              setCreateError(null)
            }
          }}
        >
          <div
            ref={modalRef}
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-page-enter space-y-4"
          >
            <h2 id="create-team-modal-title" className="text-xl font-semibold">
              {teams.length === 0 ? 'Create your first team' : 'Create team'}
            </h2>
            <form onSubmit={(e) => void handleCreate(e)} className="flex flex-col gap-3">
              <label htmlFor="new-team-name" className="text-sm font-medium">
                Team name
              </label>
              <input
                ref={nameInputRef}
                id="new-team-name"
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="e.g. Engineering"
                maxLength={100}
                disabled={creating}
                className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50"
              />
              {createError ? (
                <p role="alert" className="text-sm text-red-600">
                  {createError}
                </p>
              ) : null}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewTeamName('')
                    setCreateError(null)
                  }}
                  className="px-4 py-2 rounded-lg border border-pulse-300 text-pulse-700 hover:bg-pulse-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || newTeamName.trim().length === 0}
                  className="px-4 py-2 rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 min-h-[44px]"
                >
                  {creating ? 'Creating…' : 'Create team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
