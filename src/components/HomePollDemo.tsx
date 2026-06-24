import { useT } from '../i18n'
import { useInView } from '../hooks/useInView'
import { useCountUp } from '../hooks/useCountUp'

/**
 * HomePollDemo — decorative, self-animating live-poll preview for the landing
 * page (Finding 5 #1). It mirrors the exact result motion of a real session —
 * bar widths grow and vote counts tween — so a visitor sees the core value
 * before signing up. No live data; purely illustrative.
 *
 * Animation fires once when the card scrolls into view (useInView). Under
 * `prefers-reduced-motion` both useInView and useCountUp resolve to their final
 * state immediately, so the card simply renders fully populated.
 */

interface DemoOption {
  key: string
  count: number
  winner?: boolean
}

// Preset, sums to TOTAL — illustrative only.
const TOTAL = 47
const OPTIONS: DemoOption[] = [
  { key: 'demoOption1', count: 26, winner: true },
  { key: 'demoOption2', count: 15 },
  { key: 'demoOption3', count: 6 },
]
const MAX = Math.max(...OPTIONS.map((o) => o.count))

function DemoRow({
  label,
  count,
  winner,
  active,
}: {
  label: string
  count: number
  winner?: boolean
  active: boolean
}) {
  const shown = useCountUp(active ? count : 0)
  const pct = Math.round((count / TOTAL) * 100)
  const barPct = active ? Math.round((count / MAX) * 100) : 0

  return (
    <li className="space-y-1">
      <div className="flex justify-between text-sm">
        <span
          className={
            winner ? 'font-semibold text-teal-700 dark:text-teal-400' : 'text-pulse-700 dark:text-[#A8B3CC]'
          }
        >
          {label}
        </span>
        <span className="font-medium tabular-nums text-pulse-700 dark:text-[#A8B3CC]">
          {shown} ({pct}%)
        </span>
      </div>
      <div className="h-3 bg-pulse-100 dark:bg-[#1C2540] rounded-full overflow-hidden">
        <div
          className={
            'h-full rounded-full transition-[width] duration-700 ' +
            (winner ? 'bg-gradient-to-r from-teal-500 to-violet-500' : 'bg-pulse-500')
          }
          style={{ width: `${barPct}%` }}
        />
      </div>
    </li>
  )
}

export default function HomePollDemo() {
  const t = useT('home')
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.4 })

  return (
    <div
      ref={ref}
      role="img"
      aria-label={t('demoAriaLabel')}
      className="rounded-xl border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-[#151C2E] shadow-card p-6 max-w-[440px]"
    >
      <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-teal-600 dark:text-teal-400 mb-3">
        {t('demoLabel')}
      </p>
      <h3 className="text-[17px] font-semibold text-pulse-900 dark:text-[#F0F2F8] leading-snug mb-4">
        {t('demoQuestion')}
      </h3>
      <ul className="space-y-3" aria-hidden="true">
        {OPTIONS.map((o) => (
          <DemoRow
            key={o.key}
            label={t(o.key)}
            count={o.count}
            winner={o.winner ?? false}
            active={inView}
          />
        ))}
      </ul>
      <p className="text-xs text-pulse-500 mt-4">{t('demoVotesLabel', { count: TOTAL })}</p>
      <p className="text-[13px] text-pulse-600 dark:text-[#A8B3CC] mt-2">{t('demoCaption')}</p>
    </div>
  )
}
