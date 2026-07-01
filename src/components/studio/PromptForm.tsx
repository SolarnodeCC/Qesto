// STUDIO-AUTHORING-01 — topic/count/kind/theme prompt form.
import { MIN_COUNT, MAX_COUNT } from './constants'
import { STUDIO_KINDS, STUDIO_THEME_IDS, type StudioQuestionKind, type StudioThemeId } from './types'

type Props = {
  t: (key: string, vars?: Record<string, string | number>) => string
  topic: string
  onTopicChange: (value: string) => void
  count: number
  onCountChange: (value: number) => void
  kind: StudioQuestionKind | ''
  onKindChange: (value: StudioQuestionKind | '') => void
  themeId: StudioThemeId | ''
  onThemeChange: (value: StudioThemeId | '') => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}

export function PromptForm({
  t,
  topic,
  onTopicChange,
  count,
  onCountChange,
  kind,
  onKindChange,
  themeId,
  onThemeChange,
  onSubmit,
  submitting,
  error,
}: Props) {
  return (
    <form
      className="space-y-4 rounded-lg border border-pulse-200 bg-white p-5 dark:border-[var(--color-border-strong)] dark:bg-pulse-900/40"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div>
        <label htmlFor="studio-topic" className="block text-sm font-medium text-pulse-900 dark:text-[var(--text-primary)]">
          {t('prompt.topicLabel')}
        </label>
        <textarea
          id="studio-topic"
          className="mt-1 w-full rounded-lg border border-pulse-200 px-3 py-2 text-sm dark:border-[var(--color-border-strong)] dark:bg-pulse-900 dark:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          rows={3}
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          placeholder={t('prompt.topicPlaceholder')}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="studio-count" className="block text-sm font-medium text-pulse-900 dark:text-[var(--text-primary)]">
            {t('prompt.countLabel')}
          </label>
          <input
            id="studio-count"
            type="number"
            min={MIN_COUNT}
            max={MAX_COUNT}
            className="mt-1 w-full min-h-[44px] rounded-lg border border-pulse-200 px-3 py-2 text-sm dark:border-[var(--color-border-strong)] dark:bg-pulse-900 dark:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            value={count}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isFinite(n)) return
              onCountChange(Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(n))))
            }}
          />
        </div>

        <div>
          <label htmlFor="studio-kind" className="block text-sm font-medium text-pulse-900 dark:text-[var(--text-primary)]">
            {t('prompt.kindLabel')}
          </label>
          <select
            id="studio-kind"
            className="mt-1 w-full min-h-[44px] rounded-lg border border-pulse-200 px-3 py-2 text-sm dark:border-[var(--color-border-strong)] dark:bg-pulse-900 dark:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            value={kind}
            onChange={(e) => onKindChange(e.target.value as StudioQuestionKind | '')}
          >
            <option value="">{t('prompt.kindAny')}</option>
            {STUDIO_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`prompt.kind.${k}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="studio-theme" className="block text-sm font-medium text-pulse-900 dark:text-[var(--text-primary)]">
            {t('prompt.themeLabel')}
          </label>
          <select
            id="studio-theme"
            className="mt-1 w-full min-h-[44px] rounded-lg border border-pulse-200 px-3 py-2 text-sm dark:border-[var(--color-border-strong)] dark:bg-pulse-900 dark:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            value={themeId}
            onChange={(e) => onThemeChange(e.target.value as StudioThemeId | '')}
          >
            <option value="">{t('prompt.themeNone')}</option>
            {STUDIO_THEME_IDS.map((id) => (
              <option key={id} value={id}>
                {t(`prompt.theme.${id}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || topic.trim().length === 0}
        className="min-h-[44px] rounded-lg bg-gradient-brand px-6 py-3 text-sm font-medium text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {submitting ? t('prompt.generating') : t('prompt.generate')}
      </button>
    </form>
  )
}
