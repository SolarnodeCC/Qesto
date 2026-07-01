import { type ReactNode } from 'react'

/**
 * Shared "stage" surface styling for big-screen audience views. Uses the
 * `--surface-stage` token (canonical near-black) rather than the ad-hoc #0f1117
 * that had been hardcoded per page. Safe-area aware for cast/TV displays with
 * notches or bezels.
 */
const STAGE_CLASS =
  'fixed inset-0 flex flex-col bg-[var(--surface-stage)] text-white ' +
  '[padding:2.5rem] [padding-top:max(2.5rem,env(safe-area-inset-top))] ' +
  '[padding-bottom:max(2.5rem,env(safe-area-inset-bottom))]'

interface BigScreenShellProps {
  /** Page title, rendered as the `<h1>`. */
  title: string
  /** Short live-status label shown next to the pulsing dot (e.g. "Q&A"). */
  badgeLabel?: string
  /** Session/join code shown (styled) in the footer join URL. */
  code?: string
  /** URL path segment before the code, e.g. "th" for `qesto.cc/th/CODE`. */
  pathPrefix?: string
  /** Pre-resolved "Join at" label (page owns the i18n namespace). */
  joinLabel?: string
  children: ReactNode
}

/**
 * BigScreenShell — shared chrome for full-viewport audience/projector displays
 * (`*Display` pages) that previously each hand-rolled a near-identical
 * header/footer with a duplicated dark background. Provides the stage surface,
 * a title + live badge, the `<main>` landmark, and a footer that renders the
 * join code in the design-system code style (mono/uppercase/tracked/tabular).
 *
 * Extracted per DESIGN_SYSTEM_AUDIT_2026-07-01. No inline `<svg>` (ADR-0071).
 */
export default function BigScreenShell({
  title,
  badgeLabel,
  code,
  pathPrefix,
  joinLabel,
  children,
}: BigScreenShellProps) {
  return (
    <div className={STAGE_CLASS}>
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{title}</h1>
        {badgeLabel && (
          <span className="inline-flex items-center gap-2 text-sm text-teal-400" role="status">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-teal-400" aria-hidden="true" />
            {badgeLabel}
          </span>
        )}
      </header>

      <main id="main" tabIndex={-1} className="flex-1 overflow-hidden focus:outline-none">
        {children}
      </main>

      {code && (
        <footer className="mt-8 text-center text-white/50">
          {joinLabel}{' '}
          <span className="text-white">
            qesto.cc/{pathPrefix ? `${pathPrefix}/` : ''}
            <span className="font-mono font-semibold uppercase tracking-[0.1em] tabular-nums">{code}</span>
          </span>
        </footer>
      )}
    </div>
  )
}

/**
 * BigScreenFallback — matching stage-surface wrapper for the loading/error
 * early-return states of `*Display` pages, so those frames share
 * `--surface-stage` instead of a bare hardcoded background.
 */
export function BigScreenFallback({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--surface-stage)] text-white/60">
      {children}
    </div>
  )
}
