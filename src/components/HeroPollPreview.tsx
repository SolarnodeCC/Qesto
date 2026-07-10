/**
 * HeroPollPreview — looping "live results" animation for the homepage hero.
 *
 * Finding 4 (landing-page audit): the hero only *asserts* "real-time" and
 * "feel the pulse of the room" in copy. This component shows it — a fake
 * Present-mode card where vote bars fill in and a live response counter ticks
 * up, then loops, demonstrating the product's core value with motion.
 *
 * Self-contained: mock data + an internal timer only. It does NOT touch any
 * session / WebSocket code, and adds no dependencies (CSS transitions + a
 * setInterval, matching the project's no-framer-motion convention).
 *
 * Visual language mirrors the authentic stage mockup in
 * src/pages/solutions/EventsPage.tsx and the gradient-bar pattern in
 * src/pages/join/PostVoteResults.tsx so the preview reads as the real product.
 *
 * Accessibility:
 *   - Respects prefers-reduced-motion: renders a single static populated frame
 *     (no looping timer) when the user has the setting enabled.
 *   - The whole card is aria-hidden — it is purely illustrative, and the real
 *     text-equivalent claims live in the adjacent hero copy and feature strip,
 *     so the ticking counter never spams assistive technology.
 */
import { useEffect, useState } from 'react'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }

const QUESTION = 'Which sprint goal should we commit to first?'

/** Mock options with the target vote count each bar animates toward. */
const OPTIONS: ReadonlyArray<{ id: string; label: string; target: number }> = [
  { id: 'a', label: 'Ship onboarding redesign', target: 142 },
  { id: 'b', label: 'Cut checkout drop-off', target: 96 },
  { id: 'c', label: 'Pay down API debt', target: 48 },
]

const TARGET_TOTAL = OPTIONS.reduce((sum, o) => sum + o.target, 0)

/** Tick cadence for the fill animation, in ms. */
const TICK_MS = 700
/** How long the fully-populated frame holds before the loop resets, in ms. */
const HOLD_MS = 2600

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function HeroPollPreview() {
  const reduced = prefersReducedMotion()

  // When reduced motion is on, start fully populated and never animate.
  const [counts, setCounts] = useState<number[]>(() =>
    reduced ? OPTIONS.map((o) => o.target) : OPTIONS.map(() => 0),
  )

  useEffect(() => {
    if (reduced) return

    let holdTimer: ReturnType<typeof setTimeout> | undefined

    const interval = setInterval(() => {
      setCounts((prev) => {
        // Step each bar toward its target by a small random amount.
        const next = prev.map((c, i) => {
          const target = OPTIONS[i].target
          if (c >= target) return target
          const step = Math.ceil(target / 6) + Math.floor(Math.random() * 8)
          return Math.min(c + step, target)
        })

        // Once every bar has reached its target, hold, then reset to loop.
        if (next.every((c, i) => c >= OPTIONS[i].target)) {
          holdTimer = setTimeout(() => setCounts(OPTIONS.map(() => 0)), HOLD_MS)
        }
        return next
      })
    }, TICK_MS)

    return () => {
      clearInterval(interval)
      if (holdTimer) clearTimeout(holdTimer)
    }
  }, [reduced])

  const total = counts.reduce((sum, c) => sum + c, 0)

  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-[520px] mx-auto rounded-3xl p-8 sm:p-7 text-white grid overflow-hidden"
      style={{
        background: '#0A0F1E',
        aspectRatio: '16 / 11',
        gridTemplateRows: 'auto 1fr auto',
        gap: 16,
        ...shadowElevated,
      }}
    >
      {/* Teal glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 75% 15%, rgba(20,184,166,0.22), transparent 60%)' }}
      />

      {/* Header: room code + live counter */}
      <div className="relative flex justify-between items-center text-[11px] tracking-widest uppercase text-white/60">
        <span style={monoFont}>qesto · room QSTO-7K2</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80] animate-pulse" />
          <span className="tabular-nums" style={monoFont}>
            Live · {total} responses
          </span>
        </span>
      </div>

      {/* Question */}
      <div
        className="relative font-bold text-xl sm:text-2xl leading-tight tracking-tight self-center"
        style={displayFont}
      >
        {QUESTION}
      </div>

      {/* Bars */}
      <div className="relative grid gap-3">
        {OPTIONS.map((o, i) => {
          const count = counts[i]
          const pct = total === 0 ? 0 : Math.round((count / total) * 100)
          // Width is relative to the eventual total so bars settle proportionally.
          const widthPct = TARGET_TOTAL === 0 ? 0 : Math.round((count / TARGET_TOTAL) * 100)
          return (
            <div key={o.id} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0 text-white/80 font-medium truncate">{o.label}</span>
              <div className="flex-1 h-3.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${widthPct}%`, ...gradientBrand }}
                />
              </div>
              <span className="w-16 text-right text-white/80 tabular-nums" style={monoFont}>
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
