/**
 * Canonical Ideate cluster palette — single source of truth for the per-cluster
 * accent colors, replacing the three diverging copies flagged in
 * DESIGN_SYSTEM_AUDIT_2026-07-01 (IdeatePresent had 4 combined, IdeateJoin had 4
 * border-only, IdeateFacilitatorBoard had 6 split). Six-color superset so a given
 * cluster index renders the same color across the Present, Join, and Board views.
 *
 * Consumers pick what they need:
 *   border-only:  CLUSTER_BORDER_COLORS[i % CLUSTER_BORDER_COLORS.length]
 *   border + bg:  `${CLUSTER_BORDER_COLORS[i]} ${CLUSTER_BG_COLORS[i]}`
 */
export const CLUSTER_BORDER_COLORS = [
  'border-teal-400',
  'border-violet-400',
  'border-amber-400',
  'border-sky-400',
  'border-rose-400',
  'border-emerald-400',
] as const

export const CLUSTER_BG_COLORS = [
  'bg-teal-50 dark:bg-teal-900/20',
  'bg-violet-50 dark:bg-violet-900/20',
  'bg-amber-50 dark:bg-amber-900/20',
  'bg-sky-50 dark:bg-sky-900/20',
  'bg-rose-50 dark:bg-rose-900/20',
  'bg-emerald-50 dark:bg-emerald-900/20',
] as const

export const CLUSTER_COLOR_COUNT = CLUSTER_BORDER_COLORS.length
