/**
 * FE-REACTIONS-RENDER-01 — Floating reaction animation overlay (S92)
 *
 * Renders ephemeral emoji particles rising from the bottom of the canvas.
 * Uses CSS transforms (GPU-friendly) and caps particle count in the reducer.
 * Respects prefers-reduced-motion with a static aggregate badge instead.
 */

import { useEffect, useSyncExternalStore } from 'react'
import { type ReactionParticle } from '../hooks/useReactions'

const mq =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      mq?.addEventListener('change', cb)
      return () => mq?.removeEventListener('change', cb)
    },
    () => mq?.matches ?? false,
    () => false,
  )
}

interface ReactionsOverlayProps {
  particles: ReactionParticle[]
  total: number
  active: boolean
}

export function ReactionsOverlay({ particles, total, active }: ReactionsOverlayProps) {
  const prefersReducedMotion = usePrefersReducedMotion()

  if (!active || total <= 0) return null

  if (prefersReducedMotion) {
    return (
      <div
        className="pointer-events-none absolute bottom-6 right-6 z-20 rounded-full bg-black/70 px-3 py-1.5 text-sm text-white"
        aria-hidden="true"
      >
        {total} reactions
      </div>
    )
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => {
        const age = Date.now() - p.createdAt
        const progress = Math.min(1, age / 2200)
        const y = 88 - progress * 72
        const opacity = progress < 0.85 ? 1 : 1 - (progress - 0.85) / 0.15
        return (
          <span
            key={p.id}
            className="absolute text-3xl will-change-transform select-none"
            style={{
              left: `${p.x * 100}%`,
              top: `${y}%`,
              opacity,
              transform: `translate(-50%, -50%) scale(${1 + progress * 0.15})`,
            }}
          >
            {p.emojiId}
          </span>
        )
      })}
    </div>
  )
}

/** Drive particle expiry ticks (~60fps when active). */
export function useReactionsTicker(active: boolean, onTick: (now: number) => void): void {
  useEffect(() => {
    if (!active) return
    let raf = 0
    const loop = () => {
      onTick(Date.now())
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active, onTick])
}
