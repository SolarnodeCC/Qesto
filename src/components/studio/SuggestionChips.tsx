// STUDIO-SUGGEST-01 — "next question" chips after at least one question is authored.
// Degrades silently when there are no suggestions (no empty-state copy needed —
// the section simply doesn't render, per the story's "degrade silently" requirement).
import type { StudioSuggestion } from './types'

type Props = {
  t: (key: string, vars?: Record<string, string | number>) => string
  suggestions: StudioSuggestion[]
  onAccept: (suggestion: StudioSuggestion) => void
}

export function SuggestionChips({ t, suggestions, onAccept }: Props) {
  if (suggestions.length === 0) return null

  return (
    <section aria-labelledby="studio-suggest-heading" className="space-y-2">
      <h2 id="studio-suggest-heading" className="text-sm font-semibold text-pulse-900 dark:text-[#F0F2F8]">
        {t('suggest.heading')}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onAccept(s)}
              title={t('suggest.from', { title: s.source.title })}
              className="min-h-[44px] rounded-full border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-200 dark:hover:bg-violet-900/40"
            >
              {s.prompt}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
