// Platformbeheer Module 5 (Analytics) — pure funnel + CSV helpers.
//
// No bindings, so the drop-off maths and CSV serialisation are unit-testable
// and shared between the JSON and CSV variants of every endpoint.

export type FunnelStep = {
  key: string
  label: string
  count: number
  /** % of the previous step retained (100 for the first step). */
  conversion_from_prev_pct: number
  /** % dropped vs the previous step (0 for the first step). */
  drop_off_pct: number
  /** % of the very first (top-of-funnel) step. */
  conversion_from_top_pct: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Build an ordered funnel from raw counts. Each entry is [key, label, count];
 * counts need not be monotonically decreasing (real data sometimes isn't), so
 * percentages are clamped into [0, 100].
 */
export function computeFunnel(steps: Array<[key: string, label: string, count: number]>): FunnelStep[] {
  const top = steps[0]?.[2] ?? 0
  return steps.map(([key, label, count], i) => {
    if (i === 0) {
      return { key, label, count, conversion_from_prev_pct: 100, drop_off_pct: 0, conversion_from_top_pct: 100 }
    }
    const prev = steps[i - 1][2]
    const convPrev = prev > 0 ? Math.min(100, Math.max(0, (count / prev) * 100)) : 0
    const convTop = top > 0 ? Math.min(100, Math.max(0, (count / top) * 100)) : 0
    return {
      key,
      label,
      count,
      conversion_from_prev_pct: round1(convPrev),
      drop_off_pct: round1(100 - convPrev),
      conversion_from_top_pct: round1(convTop),
    }
  })
}

/** Escape one CSV field per RFC 4180. */
export function csvField(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Serialise rows to CSV given an ordered set of column keys. */
export function toCsv<T extends Record<string, string | number | null | undefined>>(
  headers: ReadonlyArray<keyof T & string>,
  rows: T[],
): string {
  const head = headers.map((h) => csvField(h)).join(',')
  const body = rows.map((r) => headers.map((h) => csvField(r[h])).join(','))
  return [head, ...body].join('\r\n')
}

export type AnalyticsWindow = '7d' | '30d' | '90d'

/** Resolve a window param (or explicit from/to ms) to a [start, end] range. */
export function resolveWindow(
  window: string | null | undefined,
  fromMs?: number | null,
  toMs?: number | null,
): { start: number; end: number } {
  const end = toMs && Number.isFinite(toMs) ? toMs : Date.now()
  if (fromMs && Number.isFinite(fromMs)) return { start: fromMs, end }
  const days = window === '7d' ? 7 : window === '90d' ? 90 : 30
  return { start: end - days * 24 * 60 * 60 * 1000, end }
}
