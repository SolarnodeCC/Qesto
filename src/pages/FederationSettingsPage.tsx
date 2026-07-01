/**
 * FEDERATION-01 — team federation link management (UI skeleton).
 */
import { useState } from 'react'
import MainLayout from '../layouts/MainLayout'

export default function FederationSettingsPage() {
  const [teamId, setTeamId] = useState('')
  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-pulse-900 dark:text-[var(--text-primary)]">Federation</h1>
        <p className="mt-2 text-sm text-pulse-600 dark:text-[var(--text-muted)]">
          Connect trusted organizations to share templates and co-host sessions. Requires Chorus plan.
        </p>
        <label className="mt-6 block text-sm font-medium">
          Team ID
          <input
            className="mt-1 w-full rounded border border-pulse-200 px-3 py-2 dark:bg-pulse-900"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          />
        </label>
        <p className="mt-4 text-xs text-pulse-500">
          API: GET /api/federation/links?teamId=… · POST /api/federation/links/:id/consent
        </p>
      </div>
    </MainLayout>
  )
}
