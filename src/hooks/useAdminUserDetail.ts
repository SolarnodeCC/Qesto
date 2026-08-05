import { useCallback } from 'react'
import { api } from '../api/client'
import { API_BASE_URL } from '../config/api'
import { useApiQuery } from './useApiQuery'

export type UserDetail = {
  account: {
    id: string
    email: string
    display_name: string | null
    created_at: number
    last_login_at: number | null
    suspended_at: number | null
    role: 'admin' | 'host'
  }
  subscription: {
    plan: 'free' | 'starter' | 'team'
    stripe_customer_id: string | null
    has_stripe: boolean
    live_sync_available: boolean
  }
  activity: {
    hosted_sessions: { total: number; live: number; closed: number; draft: number; archived: number }
    recent_sessions: Array<{ id: string; title: string; status: string; created_at: number }>
    joined_sessions: null
  }
  audit_trail: Array<{
    ts: number
    action: string
    actor_id: string | null
    subject_type: string | null
    subject_id: string | null
    trace_id: string | null
  }>
}

export type ImpersonationGrant = {
  expires_in: number
  impersonating: { id: string; email: string; display_name: string | null }
  actor_id: string | null
}

/** Module 3 — fetch a single user's support detail + privileged actions. */
export function useAdminUserDetail(userId: string | null) {
  const path = userId ? `/api/admin/users/${userId}/detail` : undefined
  const { data: detail, loading, error: apiError, reload: refresh } = useApiQuery<UserDetail>(path)
  const error = apiError?.message ?? null

  const impersonate = useCallback(async () => {
    if (!userId) return null
    const res = await api<ImpersonationGrant>(`/api/admin/users/${userId}/impersonate`, { method: 'POST', body: {} })
    return res
  }, [userId])

  const gdprDeleteUser = useCallback(async () => {
    if (!userId) return null
    return api<{ sessionsDeleted: number; userRowDeleted: boolean; vectorsDeleted: number }>(
      `/api/admin/users/${userId}/gdpr-delete`,
      { method: 'POST', body: { confirm: true } },
    )
  }, [userId])

  /** Trigger a browser download of the admin-initiated GDPR export. */
  const downloadExport = useCallback(() => {
    if (!userId) return
    window.open(`${API_BASE_URL}/api/admin/users/${userId}/gdpr-export`, '_blank', 'noopener')
  }, [userId])

  return { detail, loading, error, refresh, impersonate, gdprDeleteUser, downloadExport }
}
