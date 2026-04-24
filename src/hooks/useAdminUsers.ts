import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

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
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 50

  const fetchUsers = useCallback(async (q: string, off: number) => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(limit), offset: String(off) })
    if (q) params.set('search', q)
    const res = await api<UsersListResult>(`/api/admin/users?${params}`)
    if (res.ok) {
      setUsers(res.data.users)
      setTotal(res.data.total)
      setError(null)
    } else {
      setError(res.error.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers(search, offset)
  }, [fetchUsers, search, offset])

  const createUser = useCallback(async (data: { email: string; display_name?: string; plan?: string }) => {
    const res = await api<AdminUser>('/api/admin/users', { method: 'POST', body: data })
    if (res.ok) {
      await fetchUsers(search, offset)
    }
    return res
  }, [fetchUsers, search, offset])

  const updateUser = useCallback(async (id: string, data: { display_name?: string; plan?: string; admin_role?: 'admin' | 'owner' | null }) => {
    const res = await api<AdminUser>(`/api/admin/users/${id}`, { method: 'PATCH', body: data })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? res.data : u))
    }
    return res
  }, [])

  const suspendUser = useCallback(async (id: string) => {
    const res = await api<{ suspended_at: number }>(`/api/admin/users/${id}/suspend`, { method: 'POST' })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, suspended_at: res.data.suspended_at } : u))
    }
    return res
  }, [])

  const restoreUser = useCallback(async (id: string) => {
    const res = await api<{ suspended_at: null }>(`/api/admin/users/${id}/restore`, { method: 'POST' })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === id ? { ...u, suspended_at: null } : u))
    }
    return res
  }, [])

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
    refresh: () => fetchUsers(search, offset),
  }
}
