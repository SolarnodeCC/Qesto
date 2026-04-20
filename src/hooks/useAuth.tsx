import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AuthUser = { id: string; email: string }

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthUser }

type AuthApi = AuthState & {
  requestMagicLink: (email: string) => Promise<'sent' | 'invalid' | 'error'>
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.status === 200) {
        const body = (await res.json()) as { ok: boolean; data: AuthUser }
        if (body.ok) {
          setState({ status: 'authenticated', user: body.data })
          return
        }
      }
      setState({ status: 'anonymous' })
    } catch {
      setState({ status: 'anonymous' })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const requestMagicLink = useCallback(async (email: string): Promise<'sent' | 'invalid' | 'error'> => {
    try {
      const res = await fetch('/api/auth/request', {
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

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setState({ status: 'anonymous' })
  }, [])

  const value = useMemo<AuthApi>(() => ({ ...state, requestMagicLink, refresh, logout }), [state, requestMagicLink, refresh, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
