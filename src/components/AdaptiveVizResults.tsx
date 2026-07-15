/**
 * CANVAS-ADAPTIVE-VIZ-01 — Adaptive data-visualisation component (S88)
 *
 * Selection rule:
 *   - word_cloud / open            → word-cloud scatter (existing pattern)
 *   - options > 6                  → horizontal bar (labels stay readable)
 *   - options 3–6, binary-ish (2)  → donut ring + legend
 *   - otherwise (default)          → vertical bar chart
 *
 * RES-VIZ-01 — recap-aligned winner styling: every non-winning bar/segment
 * renders in a single flat --canvas-bar-muted fill; the option with the
 * strictly-highest count (ties go to whichever appears first, must have
 * count > 0) renders with the --canvas-bar-winner-{start,end} gradient and a
 * bold "· winner" label — mirrors src/pages/Results.tsx's ResultRow so the
 * live presenter/display view and the post-session recap read as one system.
 * Options are differentiated by label text alone, same as recap; the old
 * per-option --canvas-bar-{1..4} index-based colour rotation is gone.
 *
 * Respects prefers-reduced-motion: bar widths skip the CSS transition when
 * the user has the system setting enabled (handled globally in styles.css but
 * the `transition-[width]` class is still kept so non-reduced-motion users
 * see the smooth entrance).
 *
 * WCAG AAA (FE-AAA-GA-01):
 *   - aria-live="polite" on the results region (SC 4.1.3 / 1.4.6 via tokens)
 *   - role="img" + aria-label on every bar/segment (SC 1.1.1)
 *   - Each SVG arc uses <title> for screen-reader description
 */
import { useId, useMemo } from 'react'
import { useT } from '../i18n'
import { useCountUp } from '../hooks/useCountUp'

/**
 * Renders a single number that tweens from its previous value to `value`
 * (Finding 5 #1), so percent/count labels move with the already-animated
 * bars. Reduced-motion is handled inside useCountUp. Kept as a component so the
 * hook has a stable render boundary inside the chart `.map()` loops; aria
 * labels on the parents continue to use the final values.
 */
function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>
}

export type VizOption = { id: string; label: string; count: number }

interface AdaptiveVizResultsProps {
  options: VizOption[]
  total: number
  questionKind?: string | undefined
  /** Pass true when the presenter has hidden the tally */
  tallyHidden?: boolean | undefined
}

/** Number of bars above which we switch to horizontal layout */
const HORIZONTAL_THRESHOLD = 6
/** Number of options that triggers donut layout (exactly 2 → binary choice) */
const DONUT_MAX = 2

const BAR_MUTED = 'var(--canvas-bar-muted)'

function winnerGradient(direction: 'to right' | 'to top'): string {
  return `linear-gradient(${direction}, var(--canvas-bar-winner-start), var(--canvas-bar-winner-end))`
}

/** First option (in array order) with the strictly-highest count; null if all-zero. Mirrors Results.tsx. */
function computeWinnerId(options: VizOption[]): string | null {
  if (options.length === 0) return null
  const leader = options.reduce((best, o) => (o.count > best.count ? o : best), options[0])
  return leader.count > 0 ? leader.id : null
}

// ── Word-cloud ────────────────────────────────────────────────────────────

interface WordCloudVizProps {
  counts: Record<string, number>
  maxShown?: number
}

export function WordCloudViz({ counts, maxShown = 25 }: WordCloudVizProps) {
  const t = useT('canvas')
  const entries = useMemo(
    () =>
      Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, maxShown),
    [counts, maxShown],
  )
  const maxCount = Math.max(...entries.map(([, c]) => c), 1)

  if (entries.length === 0) {
    return (
      <p className="text-[length:var(--canvas-font-scale,1rem)] text-[color:var(--canvas-text-muted)] animate-pulse">
        {t('viz.waitingResponses')}
      </p>
    )
  }

  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-2 items-baseline"
      aria-live="polite"
      aria-label="Word cloud results"
    >
      {entries.map(([word, count]) => {
        const ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0
        const sizePx = Math.round(14 + ratio * 36)
        const opacity = 0.55 + ratio * 0.45
        return (
          <span
            key={word}
            style={{
              fontSize: `${sizePx}px`,
              color: 'var(--canvas-text)',
              opacity,
              lineHeight: 'var(--canvas-line-height, 1.6)',
            }}
            aria-label={t('viz.wordSubmissions', { word, count })}
            className="font-bold leading-tight transition-all duration-500 shrink-0"
          >
            {word}
          </span>
        )
      })}
    </div>
  )
}

// ── Donut chart (2-option binary) ─────────────────────────────────────────

interface DonutVizProps {
  options: VizOption[]
  total: number
  winnerId: string | null
}

function DonutViz({ options, total, winnerId }: DonutVizProps) {
  const t = useT('canvas')
  const gradientId = useId()
  const R = 46 // radius
  const CX = 60
  const CY = 60
  const circumference = 2 * Math.PI * R

  // Build arc segments from options
  let offset = 0
  const segments = options.map((o) => {
    const pct = total === 0 ? 1 / options.length : o.count / total
    const dash = pct * circumference
    const seg = { ...o, pct, dash, offset, isWinner: o.id === winnerId }
    offset += dash
    return seg
  })

  return (
    <div className="flex flex-wrap items-center gap-12" aria-live="polite">
      {/* SVG donut */}
      <svg
        width={120}
        height={120}
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Donut chart: ${options.map((o) => `${o.label} ${o.count} (${total === 0 ? 0 : Math.round((o.count / total) * 100)}%)`).join(', ')}`}
        className="shrink-0"
      >
        <title>
          {options
            .map(
              (o) =>
                `${o.label}: ${o.count} (${total === 0 ? 0 : Math.round((o.count / total) * 100)}%)`,
            )
            .join('; ')}
        </title>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--canvas-bar-winner-start)" />
            <stop offset="100%" stopColor="var(--canvas-bar-winner-end)" />
          </linearGradient>
        </defs>
        {total === 0 ? (
          <circle
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke="var(--canvas-border)"
            strokeWidth={14}
          />
        ) : (
          segments.map((seg) => (
            <circle
              key={seg.id}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={seg.isWinner ? `url(#${gradientId})` : BAR_MUTED}
              strokeWidth={14}
              strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
              strokeDashoffset={-seg.offset}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '60px 60px' }}
              className="transition-[stroke-dasharray] duration-700"
            />
          ))
        )}
        {/* Centre text */}
        <text
          x={CX}
          y={CY + 4}
          textAnchor="middle"
          fontSize={14}
          fontWeight={700}
          fill="var(--canvas-text)"
          aria-hidden="true"
        >
          <CountUp value={total} />
        </text>
      </svg>

      {/* Legend */}
      <ul className="space-y-3 flex-1 min-w-[120px]">
        {segments.map((seg) => {
          const pct = total === 0 ? 0 : Math.round((seg.count / total) * 100)
          return (
            <li key={seg.id} className="flex items-center gap-2.5">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: seg.isWinner ? winnerGradient('to right') : BAR_MUTED }}
                aria-hidden="true"
              />
              <span
                className="text-sm leading-snug flex-1"
                style={{
                  color: seg.isWinner ? 'var(--canvas-accent)' : 'var(--canvas-text)',
                  fontWeight: seg.isWinner ? 700 : 500,
                }}
              >
                {seg.label}
                {seg.isWinner ? ` · ${t('viz.winner')}` : ''}
              </span>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: 'var(--canvas-text)' }}
                aria-label={t('viz.ariaDonut', { label: seg.label, count: String(seg.count), pct: String(pct) })}
              >
                <CountUp value={seg.count} /> (<CountUp value={pct} />%)
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Horizontal bar chart (many options) ──────────────────────────────────

interface HBarChartProps {
  options: VizOption[]
  max: number
  total: number
  winnerId: string | null
}

function HBarChart({ options, max, total, winnerId }: HBarChartProps) {
  const t = useT('canvas')

  return (
    <ul className="space-y-3 w-full" aria-live="polite">
      {options.map((o) => {
        const pct = max === 0 ? 0 : Math.round((o.count / max) * 100)
        const totalPct = total === 0 ? 0 : Math.round((o.count / total) * 100)
        const isWinner = o.id === winnerId
        return (
          <li key={o.id} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="text-sm leading-snug truncate"
                style={{
                  color: isWinner ? 'var(--canvas-accent)' : 'var(--canvas-text)',
                  fontWeight: isWinner ? 700 : 600,
                }}
              >
                {o.label}
                {isWinner ? ` · ${t('viz.winner')}` : ''}
              </span>
              <span
                className="text-sm font-bold tabular-nums shrink-0"
                style={{ color: 'var(--canvas-text)' }}
              >
                <CountUp value={o.count} /> (<CountUp value={totalPct} />%)
              </span>
            </div>
            <div
              role="img"
              aria-label={t('viz.ariaBar', { label: o.label, count: String(o.count), pct: String(totalPct) })}
              className="h-6 rounded-full overflow-hidden"
              style={{ background: 'color-mix(in srgb, var(--canvas-border) 60%, transparent)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-[600ms]"
                style={{ width: `${pct}%`, background: isWinner ? winnerGradient('to right') : BAR_MUTED }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ── Vertical bar chart (default) ─────────────────────────────────────────

interface VBarChartProps {
  options: VizOption[]
  max: number
  total: number
  winnerId: string | null
}

function VBarChart({ options, max, total, winnerId }: VBarChartProps) {
  const t = useT('canvas')

  return (
    <ul className="flex items-end justify-around gap-4 h-32 w-full" aria-live="polite">
      {options.map((o) => {
        const heightPct = max === 0 ? 0 : Math.round((o.count / max) * 100)
        const totalPct = total === 0 ? 0 : Math.round((o.count / total) * 100)
        const isWinner = o.id === winnerId
        return (
          <li
            key={o.id}
            className="flex flex-col items-center gap-1 flex-1"
            aria-label={t('viz.ariaBar', { label: o.label, count: String(o.count), pct: String(totalPct) })}
          >
            <span
              className="text-xs font-bold tabular-nums"
              style={{ color: 'var(--canvas-text)' }}
            >
              <CountUp value={o.count} /> (<CountUp value={totalPct} />%)
            </span>
            {/* Fixed-height track so the fill's percentage height resolves — a
                flex child with no definite height (the <li> here) can't host a
                percentage-height descendant per CSS height-percentage rules,
                so without this wrapper every bar collapsed to the 4px floor
                regardless of count. */}
            <div className="w-full h-20 flex items-end">
              <div
                role="img"
                aria-hidden="true"
                className="w-full rounded-t transition-[height] duration-[600ms]"
                style={{
                  height: `${Math.max(heightPct, 4)}%`,
                  background: isWinner ? winnerGradient('to top') : BAR_MUTED,
                  minHeight: '4px',
                }}
              />
            </div>
            <span
              className="text-xs text-center truncate w-full"
              style={{
                color: isWinner ? 'var(--canvas-accent)' : 'var(--canvas-text-muted)',
                fontWeight: isWinner ? 700 : 500,
              }}
            >
              {o.label}
              {isWinner ? ` · ${t('viz.winner')}` : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// ── Main adaptive component ───────────────────────────────────────────────

export function AdaptiveVizResults({
  options,
  total,
  questionKind,
  tallyHidden = false,
}: AdaptiveVizResultsProps) {
  const t = useT('canvas')
  const max = options.reduce((m, o) => Math.max(m, o.count), 0)
  const winnerId = computeWinnerId(options)

  if (tallyHidden) {
    return (
      <p
        className="text-sm italic"
        style={{ color: 'var(--canvas-text-muted)' }}
        aria-live="polite"
      >
        {t('viz.tallyHidden')}
      </p>
    )
  }

  if (options.length === 0) {
    return (
      <p
        className="text-sm animate-pulse"
        style={{ color: 'var(--canvas-text-muted)' }}
        aria-live="polite"
      >
        {t('viz.waitingResponses')}
      </p>
    )
  }

  if (questionKind === 'word_cloud' || questionKind === 'open') {
    // Convert options array (count keyed by label) into the counts Record
    const counts: Record<string, number> = {}
    for (const o of options) counts[o.label] = o.count
    return <WordCloudViz counts={counts} />
  }

  if (options.length <= DONUT_MAX) {
    return <DonutViz options={options} total={total} winnerId={winnerId} />
  }

  if (options.length > HORIZONTAL_THRESHOLD) {
    return <HBarChart options={options} max={max} total={total} winnerId={winnerId} />
  }

  return <VBarChart options={options} max={max} total={total} winnerId={winnerId} />
}
