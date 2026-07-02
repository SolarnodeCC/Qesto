import { useCallback, useState } from 'react'
import { api } from '../api/client'
import { useApiQuery } from './useApiQuery'

export type AdminUser = {
  id: string
  email: string
  display_name: string | null
  plan: 'free' | 'starter' | 'team'
  created_at: number
  last_login_at: number | null
  suspended_at: number | null
  admin_role: 'owner' | 'admin' | null
}

export type UsersListResult = {
  users: AdminUser[]
  total: number
}

export function useAdminUsers() {
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 50

  const path = (() => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (search) params.set('search', search)
    return `/api/admin/users?${params}`
  })()

  const { data, loading, error: apiError, reload } = useApiQuery<UsersListResult>(path)
  const users = data?.users ?? []
  const total = data?.total ?? 0
  const error = apiError?.message ?? null

  const refresh = useCallback(() => reload(), [reload])

  const createUser = useCallback(async (data: {
    email: string
    display_name?: string | null | undefined
    plan?: string | undefined
    admin_role?: 'admin' | 'owner' | null | undefined
  }) => {
    const res = await api<AdminUser>('/api/admin/users', { method: 'POST', body: data })
    if (res.ok) {
      await refresh()
    }
    return res
  }, [refresh])

  const updateUser = useCallback(async (id: string, data: { display_name?: string | null | undefined; plan?: string | undefined; admin_role?: 'admin' | 'owner' | null | undefined }) => {
    const res = await api<AdminUser>(`/api/admin/users/${id}`, { method: 'PATCH', body: data })
    if (res.ok) {
      await reload()
    }
    return res
  }, [reload])

  const suspendUser = useCallback(async (id: string) => {
    const res = await api<{ suspended_at: number }>(`/api/admin/users/${id}/suspend`, { method: 'POST' })
    if (res.ok) {
      await reload()
    }
    return res
  }, [reload])

  const restoreUser = useCallback(async (id: string) => {
    const res = await api<{ suspended_at: null }>(`/api/admin/users/${id}/restore`, { method: 'POST' })
    if (res.ok) {
      await reload()
    }
    return res
  }, [reload])

  return {
    users,
    total,
    loading,
    error,
    search,
    setSearch,
    offset,
    setOffset,
    limit,
    createUser,
    updateUser,
    suspendUser,
    restoreUser,
    refresh,
  }
}
