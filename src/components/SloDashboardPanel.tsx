/**
 * ANALYTICS-SLO-DASH-01 — admin SLO snapshot (fetches /api/admin/slo).
 */
import { useEffect, useState } from 'react'

type Budget = {
  sloId: string
  targetPercent: number
  observedPercent: number
  errorBudgetRemainingPercent: number
  status: string
}

export function SloDashboardPanel() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/platform/slo', { credentials: 'include' })
      .then((r) => r.json())
      .then((raw) => {
        const j = raw as { ok?: boolean; data?: { budgets?: Budget[] }; error?: { message?: string } }
        if (j.ok) setBudgets(j.data?.budgets ?? [])
        else setError(j.error?.message ?? 'Failed to load SLOs')
      })
      .catch(() => setError('Network error'))
  }, [])

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-pulse-500">
            <th className="py-2 pr-4">SLO</th>
            <th className="py-2 pr-4">Target</th>
            <th className="py-2 pr-4">Observed</th>
            <th className="py-2 pr-4">Budget left</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((b) => (
            <tr key={b.sloId} className="border-t border-pulse-100 dark:border-pulse-800">
              <td className="py-2 pr-4 font-mono text-xs">{b.sloId}</td>
              <td className="py-2 pr-4">{b.targetPercent}%</td>
              <td className="py-2 pr-4">{b.observedPercent}%</td>
              <td className="py-2 pr-4">{b.errorBudgetRemainingPercent}%</td>
              <td className="py-2 capitalize">{b.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
