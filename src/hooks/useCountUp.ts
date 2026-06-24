import { useEffect, useRef, useState } from 'react'

/**
 * useCountUp — tweens a displayed integer from its previous value to `target`
 * using requestAnimationFrame (Finding 5 #1, the number half of live-data
 * microinteractions, complementing the existing bar-width transitions).
 *
 *  - `prefers-reduced-motion: reduce`, SSR, or no rAF → returns `target`
 *    immediately (no animation), matching the global reduced-motion contract.
 *  - Re-targets smoothly when `target` changes mid-flight (animates from the
 *    currently displayed value, so live updates never snap backwards).
 */

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Matches --motion-duration-slow (300ms) doubled for a readable number sweep.
const DEFAULT_DURATION = 600

// cubic ease-out, mirrors the feel of --motion-ease-slow.
const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3)

export function useCountUp(target: number, durationMs: number = DEFAULT_DURATION): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof requestAnimationFrame === 'undefined' ||
      prefersReducedMotion() ||
      durationMs <= 0
    ) {
      fromRef.current = target
      setValue(target)
      return
    }

    const from = fromRef.current
    if (from === target) return

    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const current = from + (target - from) * easeOut(progress)
      setValue(Math.round(current))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = target
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      // Remember where we stopped so a re-target animates from here.
      fromRef.current = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs])

  return value
}
