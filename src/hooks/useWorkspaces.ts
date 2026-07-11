import { useCallback, useState } from 'react'
import { api } from '../api/client'
import { useApiQuery } from './useApiQuery'

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
  const listPath = teamId ? `/api/teams/${teamId}/workspaces${kind ? `?kind=${kind}` : ''}` : undefined
  const { data, error, status, loading, reload } = useApiQuery<{ workspaces: WorkspaceSummary[] }>(listPath)
  // A 403 on a mutation also reveals the plan gate, independent of the list query.
  const [mutationPlanGated, setMutationPlanGated] = useState(false)
  const planGated = status === 403 || mutationPlanGated

  const createWorkspace = useCallback(
    async (payload: { kind: WorkspaceKind; title: string; cadence?: string }) => {
      if (!teamId) return { ok: false as const, message: 'No team' }
      const res = await api<{ workspace: { id: string } }>(`/api/teams/${teamId}/workspaces`, {
        method: 'POST',
        body: payload,
      })
      if (!res.ok) {
        if (res.status === 403) setMutationPlanGated(true)
        return { ok: false as const, message: res.error.message }
      }
      await reload()
      return { ok: true as const, id: res.data.workspace.id }
    },
    [teamId, reload],
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
    workspaces: data?.workspaces ?? [],
    loading,
    planGated,
    error: error && status !== 403 ? error.message : null,
    refresh: reload,
    createWorkspace,
    startInstance,
    loadInstances,
  }
}
