/** Keep in sync with functions/api/lib/session-title.ts */
export const SESSION_TITLE_MAX = 120

const COPY_PREFIX = 'Copy of '

function titleExists(candidate: string, existingTitles: string[]): boolean {
  const lower = candidate.toLowerCase()
  return existingTitles.some((t) => t.toLowerCase() === lower)
}

function truncateTitle(value: string): string {
  if (value.length <= SESSION_TITLE_MAX) return value
  return value.slice(0, SESSION_TITLE_MAX)
}

export function suggestDuplicateTitle(sourceTitle: string, existingTitles: string[]): string {
  const trimmed = sourceTitle.trim() || 'Session'
  const base = truncateTitle(`${COPY_PREFIX}${trimmed}`)
  if (!titleExists(base, existingTitles)) return base

  for (let n = 2; n < 100; n++) {
    const suffix = ` (${n})`
    const maxBaseLen = SESSION_TITLE_MAX - suffix.length
    const shortenedBase =
      base.length > maxBaseLen ? base.slice(0, maxBaseLen).trimEnd() : base
    const candidate = `${shortenedBase}${suffix}`
    if (!titleExists(candidate, existingTitles)) return candidate
  }

  return truncateTitle(`${base.slice(0, 100)} ${Date.now().toString(36)}`)
}
