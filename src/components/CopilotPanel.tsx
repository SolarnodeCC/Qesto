/**
 * COPILOT-05 — presenter-side live copilot panel (ADR-0046).
 *
 * Presenter-only, live-only. Shows an aggregate room read (mood, responses,
 * participation) from the live-context snapshot (COPILOT-01) and lets the
 * presenter draft a poll from a one-line intent (COPILOT-03). Accepting a draft
 * into the running session is COPILOT-06.
 */
import { useState } from 'react'
import { Sparkles, X, Loader2 } from 'lucide-react'
import { useT } from '../i18n'
import { useCopilot } from '../hooks/useCopilot'

type Props = {
  sessionId: string | undefined
  /** True only when the viewer is the presenter and the session is live. */
  enabled: boolean
}

export function CopilotPanel({ sessionId, enabled }: Props) {
  const t = useT('present')
  const [open, setOpen] = useState(false)
  const [intent, setIntent] = useState('')
  const { context, loading, planGated, draftPoll, drafting, draft } = useCopilot(sessionId, enabled && open)

  if (!enabled) return null

  const moodLabel =
    context?.mood === 'positive'
      ? t('copilot.mood_positive')
      : context?.mood === 'concerning'
        ? t('copilot.mood_concerning')
        : context?.mood === 'neutral'
          ? t('copilot.mood_neutral')
          : t('copilot.mood_none')

  const moodTone =
    context?.mood === 'positive'
      ? 'bg-teal-50 text-teal-800 border-teal-200'
      : context?.mood === 'concerning'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-pulse-50 text-pulse-700 border-pulse-200'

  return (
    <div className="fixed bottom-20 right-4 z-30 w-[min(92vw,360px)]">
      {open ? (
        <section
          role="complementary"
          aria-label={t('copilot.title')}
          className="rounded-xl border border-pulse-200 bg-white text-pulse-900 shadow-xl overflow-hidden"
        >
          <header className="flex items-center justify-between gap-2 border-b border-pulse-100 bg-violet-50 px-4 py-2.5">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-violet-800">
              <Sparkles size={16} className="text-violet-600" aria-hidden="true" />
              {t('copilot.title')}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('copilot.close')}
              className="rounded p-1 text-pulse-500 hover:text-pulse-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>

          <div className="space-y-4 p-4">
            {planGated ? (
              <p className="text-sm text-pulse-600">{t('copilot.plan_gated')}</p>
            ) : (
              <>
                {/* Room read */}
                <div aria-live="polite" className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-pulse-500">
                    {t('copilot.room_read')}
                  </h3>
                  {loading && !context ? (
                    <p className="text-sm text-pulse-500">{t('copilot.loading')}</p>
                  ) : !context?.isLive ? (
                    <p className="text-sm text-pulse-500">{t('copilot.waiting')}</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${moodTone}`}>
                        {t('copilot.mood')}: {moodLabel}
                      </span>
                      <span className="rounded-full border border-pulse-200 px-2.5 py-1 text-xs text-pulse-700">
                        {t('copilot.responses')}: {context.responseCount}
                      </span>
                      <span className="rounded-full border border-pulse-200 px-2.5 py-1 text-xs text-pulse-700">
                        {t('copilot.participation')}: {Math.round(context.participationRate * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Draft a poll from a one-line intent */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void draftPoll(intent)
                  }}
                  className="space-y-2"
                >
                  <label htmlFor="copilot-intent" className="block text-xs font-semibold uppercase tracking-wide text-pulse-500">
                    {t('copilot.draft_label')}
                  </label>
                  <input
                    id="copilot-intent"
                    type="text"
                    value={intent}
                    maxLength={280}
                    onChange={(e) => setIntent(e.target.value)}
                    placeholder={t('copilot.draft_placeholder')}
                    className="w-full rounded-lg border border-pulse-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  />
                  <button
                    type="submit"
                    disabled={drafting || !intent.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-40"
                  >
                    {drafting && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                    {drafting ? t('copilot.drafting') : t('copilot.draft_button')}
                  </button>
                </form>

                {/* Draft result */}
                <div aria-live="polite">
                  {draft &&
                    (draft.draft ? (
                      <div className="space-y-2 rounded-lg border border-pulse-200 bg-pulse-50 p-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-pulse-500">
                          {t('copilot.draft_heading')}
                        </h3>
                        <p className="text-sm font-medium text-pulse-900">{draft.draft.prompt}</p>
                        <ul className="list-disc space-y-0.5 pl-5 text-sm text-pulse-700">
                          {draft.draft.options.map((o) => (
                            <li key={o.id}>{o.label}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm text-pulse-500">{t('copilot.draft_unavailable')}</p>
                    ))}
                </div>
              </>
            )}
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('copilot.open')}
          className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <Sparkles size={16} aria-hidden="true" />
          {t('copilot.title')}
        </button>
      )}
    </div>
  )
}
