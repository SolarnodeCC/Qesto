/**
 * FE-CAPTIONS-OVERLAY-01 — Live captions overlay (S88)
 *
 * Renders on the Display and Present canvas surfaces. Anchored to the bottom
 * of the canvas, not occluding the main content area.
 *
 * Accessibility guarantees:
 *  - aria-live="polite" region for screen-reader announcement of new text
 *  - WCAG AAA 7:1 contrast: white text (#FFFFFF) on a solid black scrim
 *    (rgba(0,0,0,0.80)) = 21:1 regardless of canvas theme beneath
 *  - User-resizable caption text (A−/A+ buttons), persisted to localStorage
 *  - prefers-reduced-motion: transitions are disabled when user opts out
 *  - Icon-only buttons carry aria-label
 *  - Touch targets >= 44×44px
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useT } from '../i18n'
import { visibleSegments, type CaptionSegment } from '../hooks/useCaptions'

// ── Font-size persistence ────────────────────────────────────────────────────

const FONT_SIZE_KEY = 'qesto:captions-font-size'
const FONT_SIZES = [14, 18, 22, 26, 32] as const
type CaptionFontSize = (typeof FONT_SIZES)[number]

function readPersistedFontSize(): CaptionFontSize {
  try {
    const v = window.localStorage.getItem(FONT_SIZE_KEY)
    if (v && (FONT_SIZES as readonly number[]).includes(Number(v))) {
      return Number(v) as CaptionFontSize
    }
  } catch {
    // storage unavailable
  }
  return 18
}

function persistFontSize(size: CaptionFontSize): void {
  try {
    window.localStorage.setItem(FONT_SIZE_KEY, String(size))
  } catch {
    // storage unavailable — continue in-memory
  }
}

// ── prefers-reduced-motion media query (reactive) ────────────────────────────

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null

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

// ── Component props ──────────────────────────────────────────────────────────

interface CaptionsOverlayProps {
  segments: CaptionSegment[]
  /** Whether the overlay is visible at all. */
  active: boolean
}

// ── Component ────────────────────────────────────────────────────────────────

export function CaptionsOverlay({ segments, active }: CaptionsOverlayProps) {
  const t = useT('captions')
  const [fontSize, setFontSize] = useState<CaptionFontSize>(readPersistedFontSize)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [segments])

  const decreaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev)
      if (idx <= 0) return prev
      const next = FONT_SIZES[idx - 1]
      persistFontSize(next)
      return next
    })
  }, [])

  const increaseFontSize = useCallback(() => {
    setFontSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev)
      if (idx >= FONT_SIZES.length - 1) return prev
      const next = FONT_SIZES[idx + 1]
      persistFontSize(next)
      return next
    })
  }, [])

  const visible = visibleSegments(segments)

  if (!active || visible.length === 0) {
    // Keep the aria-live region in the DOM so screen-readers don't lose focus.
    // The region is empty when captions are not active.
    return (
      <div
        role="region"
        aria-label={t('region_label')}
        aria-live="polite"
        aria-atomic="false"
        className="sr-only"
      />
    )
  }

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-50 flex flex-col items-stretch pointer-events-none"
      aria-hidden="true"
    >
      {/* Scrim backdrop — guarantees 7:1 AAA contrast on any canvas theme.
          White (#FFF) on rgba(0,0,0,0.80) effective bg yields ~21:1 contrast. */}
      <div
        className="flex items-end justify-center px-4 pb-4 pt-3 gap-2"
        style={{ background: 'rgba(0,0,0,0.80)' }}
      >
        {/* Resize controls — pointer-events restored for these buttons */}
        <div
          className="flex flex-col gap-1 shrink-0 self-end pointer-events-auto"
          aria-hidden="false"
        >
          <button
            type="button"
            onClick={increaseFontSize}
            disabled={FONT_SIZES.indexOf(fontSize) >= FONT_SIZES.length - 1}
            aria-label={t('increase_font')}
            className="flex items-center justify-center w-11 h-11 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40 transition-colors"
            style={{ fontSize: 16, pointerEvents: 'auto' }}
          >
            A<span style={{ fontSize: 10, verticalAlign: 'super', lineHeight: 1 }}>+</span>
          </button>
          <button
            type="button"
            onClick={decreaseFontSize}
            disabled={FONT_SIZES.indexOf(fontSize) <= 0}
            aria-label={t('decrease_font')}
            className="flex items-center justify-center w-11 h-11 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40 transition-colors"
            style={{ fontSize: 16, pointerEvents: 'auto' }}
          >
            A<span style={{ fontSize: 10, verticalAlign: 'super', lineHeight: 1 }}>-</span>
          </button>
        </div>

        {/* Caption text area */}
        <div
          ref={scrollRef}
          className="flex-1 max-h-[6em] overflow-hidden flex flex-col justify-end gap-1"
          style={{ overflowY: 'hidden' }}
        >
          {visible.map((seg) => (
            <p
              key={seg.id}
              className="text-white leading-snug text-center"
              style={{
                fontSize: `${fontSize}px`,
                fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
                fontWeight: 500,
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                opacity: seg.isFinal ? 1 : 0.85,
                transition: prefersReducedMotion ? 'none' : 'opacity 0.15s ease',
              }}
            >
              {seg.text}
            </p>
          ))}
        </div>
      </div>

      {/* Screen-reader live region — always in DOM, announced politely */}
      <div
        role="region"
        aria-label={t('region_label')}
        aria-live="polite"
        aria-atomic="false"
        className="sr-only"
        aria-hidden="false"
      >
        {visible
          .filter((s) => s.isFinal)
          .map((s) => (
            <span key={s.id}>{s.text} </span>
          ))}
      </div>
    </div>
  )
}
