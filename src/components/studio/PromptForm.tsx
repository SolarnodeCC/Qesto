// STUDIO-AUTHORING-01 — topic/count/kind/theme prompt form.
import { MIN_COUNT, MAX_COUNT } from './constants'
import { STUDIO_KINDS, STUDIO_THEME_IDS, type StudioQuestionKind, type StudioThemeId } from './types'
import { FormField } from '../../ui/FormField'
import { Button } from '../../ui/components'
import { inputHint } from '../../ui/input-hint'

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

const CONTROL =
  'mt-1 w-full min-h-[44px] rounded-lg border border-pulse-200 px-3 py-2 text-sm dark:border-[var(--color-border-strong)] dark:bg-pulse-900 dark:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

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
      className="space-y-4 rounded-lg border border-pulse-200 bg-white p-6 dark:border-[var(--color-border-strong)] dark:bg-pulse-900/40"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <FormField
        label={t('prompt.topicLabel')}
        error={error}
        controlClassName={`${CONTROL} min-h-0`}
      >
        {(field) => (
          <textarea
            {...field}
            rows={3}
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            {...inputHint(t('prompt.topicPlaceholder'))}
            required
          />
        )}
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label={t('prompt.countLabel')} controlClassName={CONTROL}>
          {(field) => (
            <input
              {...field}
              type="number"
              min={MIN_COUNT}
              max={MAX_COUNT}
              value={count}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (!Number.isFinite(n)) return
                onCountChange(Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(n))))
              }}
            />
          )}
        </FormField>

        <FormField label={t('prompt.kindLabel')} controlClassName={CONTROL}>
          {(field) => (
            <select
              {...field}
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
          )}
        </FormField>

        <FormField label={t('prompt.themeLabel')} controlClassName={CONTROL}>
          {(field) => (
            <select
              {...field}
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
          )}
        </FormField>
      </div>

      <Button type="submit" disabled={submitting || topic.trim().length === 0}>
        {submitting ? t('prompt.generating') : t('prompt.generate')}
      </Button>
    </form>
  )
}
