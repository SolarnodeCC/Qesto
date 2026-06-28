/**
 * CANVAS-ADAPTIVE-VIZ-01 — Adaptive data-visualisation component (S88)
 *
 * Selection rule:
 *   - word_cloud / open            → word-cloud scatter (existing pattern)
 *   - options > 6                  → horizontal bar (labels stay readable)
 *   - options 3–6, binary-ish (2)  → donut ring + legend
 *   - otherwise (default)          → vertical bar chart
 *
 * All fills inherit --canvas-bar-{1..4} tokens set by the active
 * [data-canvas-theme] attribute, so every theme is respected without
 * per-component overrides.
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
import { useMemo } from 'react'
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

const BAR_CSS_VARS = [
  'var(--canvas-bar-1)',
  'var(--canvas-bar-2)',
  'var(--canvas-bar-3)',
  'var(--canvas-bar-4)',
]

function barFill(index: number): string {
  return BAR_CSS_VARS[index % BAR_CSS_VARS.length]
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
}

function DonutViz({ options, total }: DonutVizProps) {
  const t = useT('canvas')
  const R = 46 // radius
  const CX = 60
  const CY = 60
  const circumference = 2 * Math.PI * R

  // Build arc segments from options
  let offset = 0
  const segments = options.map((o, i) => {
    const pct = total === 0 ? 1 / options.length : o.count / total
    const dash = pct * circumference
    const seg = { ...o, pct, dash, offset, fill: barFill(i) }
    offset += dash
    return seg
  })

  return (
    <div className="flex flex-wrap items-center gap-8" aria-live="polite">
      {/* SVG donut */}
      <svg
        width={120}
        height={120}
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Donut chart: ${options.map((o) => `${o.label} ${total === 0 ? 0 : Math.round((o.count / total) * 100)}%`).join(', ')}`}
        className="shrink-0"
      >
        <title>
          {options
            .map(
              (o) =>
                `${o.label}: ${total === 0 ? 0 : Math.round((o.count / total) * 100)}%`,
            )
            .join('; ')}
        </title>
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
              stroke={seg.fill}
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
                style={{ background: seg.fill }}
                aria-hidden="true"
              />
              <span
                className="text-sm font-medium leading-snug flex-1"
                style={{ color: 'var(--canvas-text)' }}
              >
                {seg.label}
              </span>
              <span
                className="text-sm font-bold tabular-nums"
                style={{ color: 'var(--canvas-text)' }}
                aria-label={t('viz.ariaDonut', { label: seg.label, pct: String(pct) })}
              >
                <CountUp value={pct} />%
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
}

function HBarChart({ options, max, total }: HBarChartProps) {
  const t = useT('canvas')

  return (
    <ul className="space-y-3 w-full" aria-live="polite">
      {options.map((o, i) => {
        const pct = max === 0 ? 0 : Math.round((o.count / max) * 100)
        const totalPct = total === 0 ? 0 : Math.round((o.count / total) * 100)
        return (
          <li key={o.id} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="text-sm font-semibold leading-snug truncate"
                style={{ color: 'var(--canvas-text)' }}
              >
                {o.label}
              </span>
              <span
                className="text-sm font-bold tabular-nums shrink-0"
                style={{ color: 'var(--canvas-text)' }}
              >
                <CountUp value={totalPct} />%
              </span>
            </div>
            <div
              role="img"
              aria-label={t('viz.ariaBar', { label: o.label, pct: String(totalPct) })}
              className="h-5 rounded-full overflow-hidden"
              style={{ background: 'color-mix(in srgb, var(--canvas-border) 60%, transparent)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-[600ms]"
                style={{ width: `${pct}%`, background: barFill(i) }}
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
}

function VBarChart({ options, max, total }: VBarChartProps) {
  const t = useT('canvas')

  return (
    <ul className="flex items-end justify-around gap-4 h-32 w-full" aria-live="polite">
      {options.map((o, i) => {
        const heightPct = max === 0 ? 0 : Math.round((o.count / max) * 100)
        const totalPct = total === 0 ? 0 : Math.round((o.count / total) * 100)
        return (
          <li
            key={o.id}
            className="flex flex-col items-center gap-1 flex-1"
            aria-label={t('viz.ariaBar', { label: o.label, pct: String(totalPct) })}
          >
            <span
              className="text-xs font-bold tabular-nums"
              style={{ color: 'var(--canvas-text)' }}
            >
              <CountUp value={totalPct} />%
            </span>
            <div
              role="img"
              aria-hidden="true"
              className="w-full rounded-t transition-[height] duration-[600ms]"
              style={{
                height: `${Math.max(heightPct, 4)}%`,
                background: barFill(i),
                minHeight: '4px',
              }}
            />
            <span
              className="text-xs font-medium text-center truncate w-full"
              style={{ color: 'var(--canvas-text-muted)' }}
            >
              {o.label}
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
    return <DonutViz options={options} total={total} />
  }

  if (options.length > HORIZONTAL_THRESHOLD) {
    return <HBarChart options={options} max={max} total={total} />
  }

  return <VBarChart options={options} max={max} total={total} />
}
