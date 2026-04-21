import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/client'

export type AuthUser = { id: string; email: string }

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthUser }

type AuthApi = AuthState & {
  requestMagicLink: (email: string) => Promise<'sent' | 'invalid' | 'error'>
  loginWithPassword: (email: string, password: string) => Promise<'ok' | 'invalid_credentials' | 'error'>
  signupWithPassword: (email: string, password: string, name?: string) => Promise<'ok' | 'email_taken' | 'error'>
  requestPasswordReset: (email: string) => Promise<'sent' | 'invalid' | 'error'>
  confirmPasswordReset: (token: string, password: string) => Promise<'ok' | 'invalid_token' | 'invalid' | 'error'>
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    const result = await api<AuthUser>('/api/auth/me')
    if (result.ok) {
      setState({ status: 'authenticated', user: result.data })
    } else {
      setState({ status: 'anonymous' })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const requestMagicLink = useCallback(async (email: string): Promise<'sent' | 'invalid' | 'error'> => {
    const result = await api('/api/auth/request', { method: 'POST', body: { email } })
    if (result.ok) return 'sent'
    if (result.status === 400) return 'invalid'
    return 'error'
  }, [])

  const loginWithPassword = useCallback(
    async (email: string, password: string): Promise<'ok' | 'invalid_credentials' | 'error'> => {
      const result = await api('/api/auth/password/login', { method: 'POST', body: { email, password } })
      if (result.ok) {
        await refresh()
        return 'ok'
      }
      if (result.status === 401) return 'invalid_credentials'
      return 'error'
    },
    [refresh],
  )

  const signupWithPassword = useCallback(
    async (email: string, password: string, name?: string): Promise<'ok' | 'email_taken' | 'error'> => {
      const result = await api('/api/auth/password/signup', { method: 'POST', body: { email, password, name } })
      if (result.ok) {
        await refresh()
        return 'ok'
      }
      if (result.status === 409) return 'email_taken'
      return 'error'
    },
    [refresh],
  )

  const requestPasswordReset = useCallback(async (email: string): Promise<'sent' | 'invalid' | 'error'> => {
    try {
      const res = await fetch('/api/auth/password/reset-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 202) return 'sent'
      if (res.status === 400) return 'invalid'
      return 'error'
    } catch {
      return 'error'
    }
  }, [])

  const confirmPasswordReset = useCallback(
    async (token: string, password: string): Promise<'ok' | 'invalid_token' | 'invalid' | 'error'> => {
      try {
        const res = await fetch('/api/auth/password/reset-confirm', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, password }),
          credentials: 'include',
        })
        if (res.status === 200) {
          await refresh()
          return 'ok'
        }
        if (res.status === 400) {
          const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null
          if (body?.error?.code === 'invalid_token') return 'invalid_token'
          return 'invalid'
        }
        return 'error'
      } catch {
        return 'error'
      }
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' })
    setState({ status: 'anonymous' })
  }, [])

  const value = useMemo<AuthApi>(
    () => ({
      ...state,
      requestMagicLink,
      loginWithPassword,
      signupWithPassword,
      requestPasswordReset,
      confirmPasswordReset,
      refresh,
      logout,
    }),
    [state, requestMagicLink, loginWithPassword, signupWithPassword, requestPasswordReset, confirmPasswordReset, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
