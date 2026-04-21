import { useEffect, useMemo, useState } from 'react'
import { BUILD_INFO } from '../buildInfo'

type HealthResponse = {
  ok: boolean
  data?: {
    commit?: string
    env?: string
  }
}

export default function BuildStamp() {
  const [apiCommit, setApiCommit] = useState<string>('unknown')
  const [apiEnv, setApiEnv] = useState<string>('unknown')

  useEffect(() => {
    let cancelled = false

    async function loadHealth() {
      try {
        const res = await fetch('/api/admin/health')
        if (!res.ok) return
        const body = (await res.json()) as HealthResponse
        if (!cancelled && body.ok) {
          setApiCommit(body.data?.commit ?? 'unknown')
          setApiEnv(body.data?.env ?? 'unknown')
        }
      } catch {
        // Keep defaults when health endpoint is unreachable.
      }
    }

    void loadHealth()
    return () => {
      cancelled = true
    }
  }, [])

  const mismatch = useMemo(() => {
    return apiCommit !== 'unknown' && BUILD_INFO.frontendCommit !== 'unknown' && apiCommit !== BUILD_INFO.frontendCommit
  }, [apiCommit])

  return (
    <p className="text-[11px] text-pulse-500 text-center">
      FE {BUILD_INFO.frontendCommit} ({BUILD_INFO.frontendBuildTime}) · API {apiCommit} [{apiEnv}]
      {mismatch ? ' · version mismatch' : ''}
    </p>
  )
}
