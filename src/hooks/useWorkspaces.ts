import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'

export type WorkspaceKind = 'retro' | 'ideate' | 'event'

export type WorkspaceSummary = {
  id: string
  teamId: string
  kind: WorkspaceKind
  title: string
  cadence: string | null
  lastInstanceAt: number | null
  createdAt: number
}

export type WorkspaceInstance = {
  id: string
  title: string
  status: string
  workspaceSeq: number | null
  createdAt: number
  closedAt: number | null
}

export function useWorkspaces(teamId: string | undefined, kind?: WorkspaceKind) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [planGated, setPlanGated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    setError(null)
    const q = kind ? `?kind=${kind}` : ''
    const res = await api<{ workspaces: WorkspaceSummary[] }>(`/api/teams/${teamId}/workspaces${q}`)
    setLoading(false)
    if (!res.ok) {
      if (res.status === 403) setPlanGated(true)
      else setError(res.error.message)
      return
    }
    setWorkspaces(res.data.workspaces)
  }, [teamId, kind])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createWorkspace = useCallback(
    async (payload: { kind: WorkspaceKind; title: string; cadence?: string }) => {
      if (!teamId) return { ok: false as const, message: 'No team' }
      const res = await api<{ workspace: { id: string } }>(`/api/teams/${teamId}/workspaces`, {
        method: 'POST',
        body: payload,
      })
      if (!res.ok) {
        if (res.status === 403) setPlanGated(true)
        return { ok: false as const, message: res.error.message }
      }
      await refresh()
      return { ok: true as const, id: res.data.workspace.id }
    },
    [teamId, refresh],
  )

  const startInstance = useCallback(
    async (workspaceId: string) => {
      if (!teamId) return { ok: false as const, message: 'No team' }
      const res = await api<{ session: { id: string; code: string } }>(
        `/api/teams/${teamId}/workspaces/${workspaceId}/instances`,
        { method: 'POST' },
      )
      if (!res.ok) return { ok: false as const, message: res.error.message }
      return { ok: true as const, sessionId: res.data.session.id, code: res.data.session.code }
    },
    [teamId],
  )

  const loadInstances = useCallback(
    async (workspaceId: string) => {
      if (!teamId) return []
      const res = await api<{ instances: WorkspaceInstance[] }>(
        `/api/teams/${teamId}/workspaces/${workspaceId}/instances`,
      )
      return res.ok ? res.data.instances : []
    },
    [teamId],
  )

  return {
    workspaces,
    loading,
    planGated,
    error,
    refresh,
    createWorkspace,
    startInstance,
    loadInstances,
  }
}
