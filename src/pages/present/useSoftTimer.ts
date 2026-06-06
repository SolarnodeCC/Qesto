import { useCallback, useEffect, useRef, useState } from 'react'

export interface SoftTimer {
  remaining: number
  running: boolean
  pct: number
  start: (secs: number) => void
  stop: () => void
}

// ── Soft-timer hook ────────────────────────────────────────────────────────
export function useSoftTimer(): SoftTimer {
  const [totalSecs, setTotalSecs] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback((secs: number) => {
    setTotalSecs(secs)
    setRemaining(secs)
    setRunning(true)
  }, [])

  const stop = useCallback(() => {
    setRunning(false)
    setRemaining(0)
    setTotalSecs(0)
  }, [])

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const pct = totalSecs > 0 ? remaining / totalSecs : 0
  return { remaining, running, pct, start, stop }
}
