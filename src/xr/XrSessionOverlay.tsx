/**
 * XrSessionOverlay.tsx — opt-in immersive overlay mount point (ADR-0066).
 *
 * This is the default-exported module loaded via `React.lazy()` + dynamic
 * `import()` from the participant live view (`JoinPage.tsx`). It is NOT
 * imported eagerly anywhere — the only reference to this file's path must be
 * inside a `lazy(() => import('../xr/XrSessionOverlay'))` call, so it never
 * lands in the critical bundle (ADR-0066 D2, R4).
 *
 * XR is an opt-in overlay, never a gate (ADR-0066 D5): the existing 2D vote
 * UI keeps running underneath; this overlay can be dismissed at any time to
 * return to it. No focus trap beyond what's needed to keep keyboard users
 * inside the dialog while it's open, and Escape / the close button always
 * works.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useT } from '../i18n'
import type { LiveQuestion, XrAvatarSync } from '../hooks/useLiveSession'
import { XrSpatialScene } from './XrSpatialScene'

// Throttle the local participant's outbound pose frames. The DO batches at
// ~12.5 Hz (XR_TICK_MS=80 in session-room-xr-handler.ts) — sending faster from
// the client would just be dropped/coalesced server-side, so 200ms keeps
// client cost low while staying well inside the DO's fan-out cadence.
const LOCAL_POSE_SEND_INTERVAL_MS = 200

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

export interface XrSessionOverlayProps {
  question: LiveQuestion | null
  /** Latest merged avatar batch (ADR-0066 `xr_avatar_sync` ServerMessage), or empty before first sync. */
  avatars: XrAvatarSync['avatars']
  /** Forwards the local participant's quantized pose; caller owns the WS send. */
  onSendPose: (p: [number, number, number], q: [number, number, number, number]) => void
  /** Returns to the standard 2D view. Always available — XR never gates. */
  onClose: () => void
  /**
   * Real WebXR device-capability result from `useWebXrSupport` (ADR-0066 D5 /
   * FE-XR-LAUNCHER-01 / XR-FALLBACK-01). When `false`, the device has no
   * immersive WebXR session support, so the overlay surfaces the
   * `fallback_notice` string alongside the 2D stub scene to make clear that
   * immersive mode is optional and voting is unaffected. The 2D scene
   * (`XrSpatialScene`) renders identically either way — this only controls
   * whether the fallback explanation is shown.
   */
  isWebXrCapable: boolean
}

/** A gently drifting placeholder pose so the wire path has real frames to send. */
function nextLocalPose(t: number): { p: [number, number, number]; q: [number, number, number, number] } {
  const angle = (t / 4000) % (Math.PI * 2)
  return {
    p: [Math.sin(angle) * 0.4, 0, Math.cos(angle) * 0.4],
    q: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
  }
}

export default function XrSessionOverlay({
  question,
  avatars,
  onSendPose,
  onClose,
  isWebXrCapable,
}: XrSessionOverlayProps) {
  const t = useT('xr')
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [announced, setAnnounced] = useState(false)

  // Focus the close affordance on mount so keyboard users land inside the
  // overlay immediately; restore is handled by the caller unmounting us and
  // returning focus to the "Enter immersive mode" button it owns.
  useEffect(() => {
    closeButtonRef.current?.focus()
    setAnnounced(true)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      // Minimal focus containment: keep Tab cycling within the dialog while
      // it's open, without blocking the close path on any failure mode.
      if (e.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return
        const focusables = dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Throttled outbound pose loop. Stops cleanly on unmount (overlay close).
  useEffect(() => {
    const id = window.setInterval(() => {
      const { p, q } = nextLocalPose(Date.now())
      onSendPose(p, q)
    }, LOCAL_POSE_SEND_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [onSendPose])

  const handleClose = useCallback(() => onClose(), [onClose])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('overlay_dialog_label')}
      className="fixed inset-0 z-[60] flex flex-col bg-[#04060C]/95 text-white"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t('overlay_title')}</span>
          <span className="text-[10px] uppercase tracking-wide rounded-full bg-teal-500/20 text-teal-300 px-2 py-0.5">
            {t('beta_badge')}
          </span>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          aria-label={t('exit_button')}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg px-3 text-sm font-medium text-white bg-white/10 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        >
          {t('exit_button')}
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-8 overflow-y-auto">
        <XrSpatialScene question={question} avatars={avatars} reducedMotion={reducedMotion} />
        <p className="text-xs text-white/60 text-center max-w-sm">{t('scene_placeholder_caption')}</p>
        {!isWebXrCapable && (
          <p
            role="status"
            className="text-xs text-amber-200 bg-amber-900/30 border border-amber-500/30 rounded-lg px-3 py-2 text-center max-w-sm"
          >
            {t('fallback_notice')}
          </p>
        )}
        {reducedMotion && (
          <p role="status" className="text-xs text-white/50 text-center max-w-sm">
            {t('reduced_motion_notice')}
          </p>
        )}
      </div>

      {/* Polite live region announcing overlay entry for screen-reader users. */}
      <div className="sr-only" role="status" aria-live="polite">
        {announced ? t('overlay_title') : ''}
      </div>
    </div>
  )
}
