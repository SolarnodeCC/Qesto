import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { BUILD_INFO } from '../buildInfo'

type HealthData = { commit?: string; env?: string }

export default function BuildStamp() {
  const [apiCommit, setApiCommit] = useState<string>('unknown')
  const [apiEnv, setApiEnv] = useState<string>('unknown')

  useEffect(() => {
    let cancelled = false

    async function loadHealth() {
      const result = await api<HealthData>('/api/admin/health')
      if (!cancelled && result.ok) {
        setApiCommit(result.data.commit ?? 'unknown')
        setApiEnv(result.data.env ?? 'unknown')
      }
    }

    void loadHealth()
    return () => {
      cancelled = true
    }
  }, [])

  const mismatch = useMemo(
    () => apiCommit !== 'unknown' && BUILD_INFO.frontendCommit !== 'unknown' && apiCommit !== BUILD_INFO.frontendCommit,
    [apiCommit],
  )

  return (
    <p className="text-[11px] text-pulse-500 text-center">
      FE {BUILD_INFO.frontendCommit} ({BUILD_INFO.frontendBuildTime}) · API {apiCommit} [{apiEnv}]
      {mismatch ? ' · version mismatch' : ''}
    </p>
  )
}
