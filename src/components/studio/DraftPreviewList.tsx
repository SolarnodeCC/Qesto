// STUDIO-AUTHORING-01 — preview + inline title edit for generated drafts.
import type { StudioDraft } from './types'

type Props = {
  t: (key: string, vars?: Record<string, string | number>) => string
  drafts: StudioDraft[]
  confidence: number | null
  selectedId: string | null
  onSelect: (id: string) => void
  onEditPrompt: (id: string, prompt: string) => void
  onSaveTitleFor: (id: string) => string
  onTitleChange: (id: string, title: string) => void
  savingId: string | null
  savedIds: Set<string>
  onSave: (id: string) => void
}

export function DraftPreviewList({
  t,
  drafts,
  confidence,
  selectedId,
  onSelect,
  onEditPrompt,
  onSaveTitleFor,
  onTitleChange,
  savingId,
  savedIds,
  onSave,
}: Props) {
  if (drafts.length === 0) {
    return <p className="text-sm text-pulse-500 dark:text-[var(--text-secondary)]">{t('preview.empty')}</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pulse-900 dark:text-[var(--text-primary)]">{t('preview.heading')}</h2>
        {confidence !== null && (
          <span className="text-xs text-pulse-500 dark:text-[var(--text-secondary)]">
            {t('preview.confidence', { value: Math.round(confidence * 100) })}
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {drafts.map((draft) => (
          <li
            key={draft.id}
            className={`rounded-lg border p-4 ${
              selectedId === draft.id
                ? 'border-teal-400 bg-teal-50 dark:border-teal-700 dark:bg-teal-900/20'
                : 'border-pulse-200 bg-white dark:border-[var(--color-border-strong)] dark:bg-pulse-900/40'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(draft.id)}
              className="min-h-[44px] w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
            >
              <label htmlFor={`draft-prompt-${draft.id}`} className="sr-only">
                {t('preview.editTitle')}
              </label>
              <textarea
                id={`draft-prompt-${draft.id}`}
                className="w-full resize-none rounded border border-pulse-200 px-2 py-1 text-sm font-medium dark:border-[var(--color-border-strong)] dark:bg-pulse-900 dark:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                rows={2}
                value={draft.prompt}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onEditPrompt(draft.id, e.target.value)}
              />
            </button>

            {draft.options.length > 0 && (
              <p className="mt-2 text-xs text-pulse-500 dark:text-[var(--text-secondary)]">
                {t('preview.optionsCount', { count: draft.options.length })}
              </p>
            )}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor={`draft-title-${draft.id}`} className="sr-only">
                {t('preview.titleLabel')}
              </label>
              <input
                id={`draft-title-${draft.id}`}
                type="text"
                className="min-h-[44px] flex-1 rounded border border-pulse-200 px-2 py-1 text-sm dark:border-[var(--color-border-strong)] dark:bg-pulse-900 dark:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                value={onSaveTitleFor(draft.id)}
                onChange={(e) => onTitleChange(draft.id, e.target.value)}
                placeholder={t('preview.titleLabel')}
              />
              <button
                type="button"
                onClick={() => onSave(draft.id)}
                disabled={savingId === draft.id}
                className="min-h-[44px] rounded-lg border border-teal-300 px-4 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 dark:border-teal-700 dark:text-teal-200 dark:hover:bg-teal-900/30"
              >
                {savingId === draft.id ? t('preview.saving') : savedIds.has(draft.id) ? t('preview.saved') : t('preview.save')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
