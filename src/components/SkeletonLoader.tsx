/**
 * SkeletonLoader — Phase 7 implementation (LAYOUT-SKELETON-01)
 *
 * Provides skeleton parity for:
 *  - InsightsTab (theme card, trend spark, loading state)
 *  - WizardAIGeneration (streaming skeleton while generating)
 *  - LaunchpadPreFlight (pre-flight checklist)
 *  - SessionList (dashboard sessions list)
 *  - ResultsPage (results/vote bars)
 *  - Generic Skeleton primitives
 *
 * All skeletons match loaded-state dimensions to eliminate CLS.
 * Animation honours prefers-reduced-motion: reduce.
 *
 * Accessibility: role="status" aria-label="Loading…" on container elements
 * so screen-readers announce the loading state once without spamming.
 */

import type { ReactNode } from 'react'

// ─── Primitive ────────────────────────────────────────────────────────────────

interface SkeletonProps {
  /** Tailwind width class e.g. "w-full" or "w-32" */
  width?: string
  /** Tailwind height class e.g. "h-4" or "h-[20px]" */
  height?: string
  /** Tailwind border-radius class — defaults to rounded-md */
  rounded?: string
  /** Extra Tailwind classes */
  className?: string
}

/**
 * Base skeleton shimmer block. Inherits its size from the
 * `width` / `height` props so callers always set explicit dimensions
 * that match the rendered content — preventing layout shift.
 */
export function Skeleton({ width = 'w-full', height = 'h-4', rounded = 'rounded-md', className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        'skeleton-shimmer',
        'bg-pulse-200',
        width,
        height,
        rounded,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────

/**
 * Matches the loaded InsightsThemeCard (title chip + body lines + confidence).
 * Fixed height 148px to match card dimensions exactly.
 */
export function InsightsThemeCardSkeleton() {
  return (
    <div className="rounded-xl border border-pulse-200 p-5 space-y-3 h-[148px]">
      {/* Theme title chip */}
      <Skeleton width="w-2/3" height="h-5" rounded="rounded-full" />
      {/* Body text — two lines */}
      <div className="space-y-2">
        <Skeleton width="w-full" height="h-3" />
        <Skeleton width="w-4/5" height="h-3" />
      </div>
      {/* Confidence chip */}
      <div className="flex items-center justify-between">
        <Skeleton width="w-24" height="h-5" rounded="rounded-full" />
        <Skeleton width="w-16" height="h-4" />
      </div>
    </div>
  )
}

/**
 * Matches the loaded TrendSpark inline chart.
 * Fixed height 56px (matches SVG spark container).
 */
export function InsightsTrendSparkSkeleton() {
  return (
    <div className="space-y-2">
      {/* Label */}
      <Skeleton width="w-32" height="h-3" />
      {/* Spark container — matches SVG 100%×40px */}
      <Skeleton width="w-full" height="h-10" rounded="rounded-lg" />
    </div>
  )
}

/**
 * Full Insights tab skeleton — theme cards + trend spark.
 * Matches: 3 theme cards stacked + 1 spark below.
 */
export function InsightsTabSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading insights…"
      aria-live="polite"
      className="space-y-4"
    >
      {/* Section heading placeholder */}
      <Skeleton width="w-40" height="h-6" rounded="rounded-lg" />

      {/* Theme cards — 3 to match typical loaded state */}
      <div className="space-y-3">
        <InsightsThemeCardSkeleton />
        <InsightsThemeCardSkeleton />
        <InsightsThemeCardSkeleton />
      </div>

      {/* Trend spark */}
      <InsightsTrendSparkSkeleton />

      <span className="sr-only">Loading insights, please wait.</span>
    </div>
  )
}

// ─── Wizard AI Generation ─────────────────────────────────────────────────────

interface WizardAIGenerationSkeletonProps {
  /** Number of question rows to render (defaults to 4 to match AI output) */
  questionCount?: number
}

/**
 * Streaming skeleton shown while the AI generates session questions.
 * Each question row mimics the loaded QuestionCard: prompt + type badge + options.
 * Heights are locked to match rendered card dims and avoid CLS.
 */
export function WizardAIGenerationSkeleton({ questionCount = 4 }: WizardAIGenerationSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Generating questions with AI…"
      aria-live="polite"
      className="space-y-4"
    >
      {/* AI generation header: sparkle icon area + status text */}
      <div className="flex items-center gap-3">
        <Skeleton width="w-8" height="h-8" rounded="rounded-full" />
        <div className="space-y-1 flex-1">
          <Skeleton width="w-48" height="h-4" />
          <Skeleton width="w-32" height="h-3" />
        </div>
      </div>

      {/* Question cards */}
      {Array.from({ length: questionCount }).map((_, i) => (
        // Delay class applied inline via style for stagger — CSS var driven
        <div
          key={i}
          className="rounded-xl border border-pulse-200 p-5 space-y-3 h-[140px]"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          {/* Question type badge */}
          <div className="flex items-center justify-between">
            <Skeleton width="w-20" height="h-5" rounded="rounded-full" />
            <Skeleton width="w-8" height="h-8" rounded="rounded-full" />
          </div>
          {/* Prompt */}
          <Skeleton width="w-full" height="h-4" />
          <Skeleton width="w-3/4" height="h-4" />
          {/* Options row */}
          <div className="flex gap-2">
            <Skeleton width="w-20" height="h-6" rounded="rounded-full" />
            <Skeleton width="w-20" height="h-6" rounded="rounded-full" />
            <Skeleton width="w-20" height="h-6" rounded="rounded-full" />
          </div>
        </div>
      ))}

      <span className="sr-only">AI is generating questions. This may take a few seconds.</span>
    </div>
  )
}

// ─── Launchpad Pre-Flight Checklist ───────────────────────────────────────────

/**
 * Single pre-flight item skeleton.
 * Matches: checkbox icon + label + optional status badge.
 * Height locked to 44px (minimum touch target / line height of loaded item).
 */
export function LaunchpadPreFlightItemSkeleton() {
  return (
    <div className="flex items-center gap-3 h-11">
      {/* Check circle */}
      <Skeleton width="w-5" height="h-5" rounded="rounded-full" />
      {/* Label */}
      <Skeleton width="w-48" height="h-4" />
      {/* Status badge (sometimes shown) */}
      <Skeleton width="w-16" height="h-5" rounded="rounded-full" className="ml-auto" />
    </div>
  )
}

/**
 * Full Launchpad pre-flight checklist skeleton.
 * Matches the loaded PreFlightStrip: section title + 4 checklist items.
 */
export function LaunchpadPreFlightSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading pre-flight checklist…"
      aria-live="polite"
      className="rounded-xl border border-pulse-200 p-5 space-y-4"
    >
      {/* Section title */}
      <Skeleton width="w-36" height="h-5" rounded="rounded-lg" />

      {/* Checklist items */}
      <div className="divide-y divide-pulse-100">
        <LaunchpadPreFlightItemSkeleton />
        <LaunchpadPreFlightItemSkeleton />
        <LaunchpadPreFlightItemSkeleton />
        <LaunchpadPreFlightItemSkeleton />
      </div>

      {/* CTA area */}
      <div className="pt-1">
        <Skeleton width="w-32" height="h-10" rounded="rounded-lg" />
      </div>

      <span className="sr-only">Loading session pre-flight checklist.</span>
    </div>
  )
}

// ─── Session List (Dashboard) ─────────────────────────────────────────────────

/**
 * Skeleton for a single session list row (title + meta + badge).
 * Matches: p-4 flex layout of the loaded li in Dashboard.
 */
export function SessionRowSkeleton() {
  return (
    <li className="p-4 flex items-center justify-between gap-4 h-[72px]">
      <div className="space-y-1.5 flex-1">
        {/* Title */}
        <Skeleton width="w-3/4" height="h-4" />
        {/* Meta */}
        <Skeleton width="w-1/2" height="h-3" />
      </div>
      {/* Status badge */}
      <Skeleton width="w-14" height="h-5" rounded="rounded-full" />
    </li>
  )
}

/**
 * Dashboard sessions list skeleton — 3 rows in the same border/divide container.
 */
export function SessionListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading sessions…"
      aria-live="polite"
      className="divide-y divide-pulse-200 rounded-xl border border-pulse-200"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <SessionRowSkeleton key={i} />
      ))}
      <span className="sr-only">Loading sessions list.</span>
    </div>
  )
}

// ─── Results Page ─────────────────────────────────────────────────────────────

/**
 * Single result bar skeleton (label + bar).
 * Matches the loaded vote bar li: h = 52px.
 */
export function ResultBarSkeleton() {
  return (
    <li className="space-y-1 h-[52px]">
      <div className="flex justify-between">
        <Skeleton width="w-1/3" height="h-4" />
        <Skeleton width="w-16" height="h-4" />
      </div>
      <Skeleton width="w-full" height="h-3" rounded="rounded-full" />
    </li>
  )
}

/**
 * Full Results section skeleton — heading + 4 bar rows.
 */
export function ResultsSectionSkeleton({ bars = 4 }: { bars?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading results…"
      aria-live="polite"
      className="rounded-xl border border-pulse-200 p-5 space-y-4"
    >
      {/* Question prompt */}
      <Skeleton width="w-4/5" height="h-6" rounded="rounded-lg" />
      <ul className="space-y-3">
        {Array.from({ length: bars }).map((_, i) => (
          <ResultBarSkeleton key={i} />
        ))}
      </ul>
      <span className="sr-only">Loading vote results.</span>
    </div>
  )
}

// ─── Compound exports ─────────────────────────────────────────────────────────

/** Convenience re-exports for surface-level imports */
export type { SkeletonProps }

/**
 * Generic page-level skeleton wrapper.
 * Wraps children with role="status" so the whole region is announced once.
 */
export function SkeletonRegion({
  label = 'Loading…',
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <div role="status" aria-label={label} aria-live="polite">
      {children}
      <span className="sr-only">{label}</span>
    </div>
  )
}
