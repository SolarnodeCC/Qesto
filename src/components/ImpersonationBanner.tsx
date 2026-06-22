import { useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'

// Platformbeheer Module 3 — global "viewing as X" banner. Impersonation state
// comes from /api/auth/me (via useAuth), which works cross-origin where a
// JS-readable cookie would not. Renders nothing when not impersonating.

export default function ImpersonationBanner() {
  const auth = useAuth()
  const [stopping, setStopping] = useState(false)

  const impersonating = auth.status === 'authenticated' ? auth.user.impersonating : undefined
  if (!impersonating) return null

  async function stop() {
    setStopping(true)
    await api('/api/admin/impersonation/stop', { method: 'POST', body: {} })
    // Full reload so the cleared cookie + restored admin session take effect.
    window.location.assign('/admin')
  }

  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-3 bg-amber-500 text-black px-4 py-2 text-sm font-medium shadow-md"
    >
      <span>
        👤 Viewing as <strong>{impersonating.email}</strong> — actions are performed as this user.
      </span>
      <button
        type="button"
        onClick={stop}
        disabled={stopping}
        className="rounded bg-black/80 text-white px-3 py-1 text-xs font-semibold hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
      >
        {stopping ? 'Stopping…' : 'Stop impersonating'}
      </button>
    </div>
  )
}
