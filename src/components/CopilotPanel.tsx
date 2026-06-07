/**
 * COPILOT-05 — presenter-side live copilot panel (ADR-0046).
 *
 * Presenter-only, live-only. Shows an aggregate room read (mood, responses,
 * participation) from the live-context snapshot (COPILOT-01) and lets the
 * presenter draft a poll from a one-line intent (COPILOT-03). Accepting a draft
 * into the running session is COPILOT-06.
 */
import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Loader2, RefreshCw, Lightbulb, AlertTriangle, Gauge, ListPlus, Check } from 'lucide-react'
import { useT } from '../i18n'
import { useCopilot, type CopilotActionKind } from '../hooks/useCopilot'
import { inputHint } from '../ui/input-hint'

type Props = {
  sessionId: string | undefined
  /** True only when the viewer is the presenter and the session is live. */
  enabled: boolean
  /** COPILOT-06: inject an accepted draft into the live session over the WS. */
  onAddQuestion?: (question: { kind: string; prompt: string; options: { label: string }[] }) => void
}

const KIND_ICON: Record<CopilotActionKind, typeof Lightbulb> = {
  followup_question: Lightbulb,
  poll_draft: ListPlus,
  disengagement_alert: AlertTriangle,
  pacing: Gauge,
}

export function CopilotPanel({ sessionId, enabled, onAddQuestion }: Props) {
  const t = useT('present')
  const [open, setOpen] = useState(false)
  const [intent, setIntent] = useState('')
  const [addedPrompt, setAddedPrompt] = useState<string | null>(null)
  const {
    context,
    loading,
    planGated,
    draftPoll,
    drafting,
    draft,
    suggestions,
    suggestSource,
    suggestLoading,
    fetchSuggestions,
  } = useCopilot(sessionId, enabled && open)

  // Auto-fetch suggestions once per live open (heavier LLM call — not on the 15s poll).
  const fetchedRef = useRef(false)
  useEffect(() => {
    if (open && context?.isLive && !fetchedRef.current) {
      fetchedRef.current = true
      void fetchSuggestions()
    }
    if (!open) fetchedRef.current = false
  }, [open, context?.isLive, fetchSuggestions])

  if (!enabled) return null

  const kindLabel = (kind: CopilotActionKind): string => t(`copilot.kind_${kind}`)

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
      ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800'
      : context?.mood === 'concerning'
        ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
        : 'bg-pulse-50 dark:bg-[#151C2E] text-pulse-700 dark:text-[#A8B3CC] border-pulse-200 dark:border-[#1E2A45]'

  return (
    <div className="fixed bottom-20 right-4 z-30 w-[min(92vw,360px)]">
      {open ? (
        <section
          role="complementary"
          aria-label={t('copilot.title')}
          className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] text-pulse-900 dark:text-[#F0F2F8] shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          <header className="flex items-center justify-between gap-2 border-b border-pulse-100 dark:border-[#1E2A45] bg-violet-50 dark:bg-violet-900/20 px-4 py-2.5">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-violet-800 dark:text-violet-300">
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
              <p className="text-sm text-pulse-600 dark:text-[#A8B3CC]">{t('copilot.plan_gated')}</p>
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
                      <span className="rounded-full border border-pulse-200 dark:border-[#2A3858] px-2.5 py-1 text-xs text-pulse-700 dark:text-[#A8B3CC]">
                        {t('copilot.responses')}: {context.responseCount}
                      </span>
                      <span className="rounded-full border border-pulse-200 dark:border-[#2A3858] px-2.5 py-1 text-xs text-pulse-700 dark:text-[#A8B3CC]">
                        {t('copilot.participation')}: {Math.round(context.participationRate * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Suggestions (COPILOT-02) */}
                {context?.isLive && (
                  <div aria-live="polite" className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-pulse-500">
                        {t('copilot.suggestions_title')}
                        {suggestSource === 'heuristic' && (
                          <span className="ml-1 font-normal normal-case text-pulse-400">· {t('copilot.suggestions_fallback')}</span>
                        )}
                      </h3>
                      <button
                        type="button"
                        onClick={() => void fetchSuggestions()}
                        disabled={suggestLoading}
                        aria-label={t('copilot.suggestions_refresh')}
                        className="inline-flex items-center gap-1 rounded p-1 text-pulse-500 hover:text-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-40"
                      >
                        <RefreshCw size={14} className={suggestLoading ? 'animate-spin' : ''} aria-hidden="true" />
                      </button>
                    </div>
                    {suggestLoading && suggestions.length === 0 ? (
                      <p className="text-sm text-pulse-500">{t('copilot.suggestions_loading')}</p>
                    ) : suggestions.length === 0 ? (
                      <p className="text-sm text-pulse-500">{t('copilot.suggestions_empty')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {suggestions.map((s, i) => {
                          const Icon = KIND_ICON[s.kind]
                          const alert = s.kind === 'disengagement_alert'
                          return (
                            <li
                              key={`${s.kind}-${i}`}
                              className={`rounded-lg border p-2.5 text-sm ${alert ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20' : 'border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#1C2540]'}`}
                            >
                              <div className="flex items-center gap-1.5">
                                <Icon size={14} className={alert ? 'text-amber-600' : 'text-violet-600'} aria-hidden="true" />
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-pulse-500">{kindLabel(s.kind)}</span>
                              </div>
                              <p className="mt-1 font-medium text-pulse-900 dark:text-[#F0F2F8]">{s.title}</p>
                              <p className="text-pulse-600 dark:text-[#A8B3CC]">{s.body}</p>
                              {s.kind === 'poll_draft' && s.intent && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIntent(s.intent ?? '')
                                    void draftPoll(s.intent ?? '')
                                  }}
                                  className="mt-1.5 inline-flex items-center gap-1 rounded bg-violet-100 dark:bg-violet-900/30 px-2 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                                >
                                  {t('copilot.suggestion_use')}
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}

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
                    {...inputHint(t('copilot.draft_hint'))}
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
                        <p className="text-sm font-medium text-pulse-900 dark:text-[#F0F2F8]">{draft.draft.prompt}</p>
                        <ul className="list-disc space-y-0.5 pl-5 text-sm text-pulse-700 dark:text-[#A8B3CC]">
                          {draft.draft.options.map((o) => (
                            <li key={o.id}>{o.label}</li>
                          ))}
                        </ul>
                        {onAddQuestion &&
                          (addedPrompt === draft.draft.prompt ? (
                            <p className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400">
                              <Check size={14} aria-hidden="true" />
                              {t('copilot.added')}
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const d = draft.draft
                                if (!d) return
                                onAddQuestion({ kind: d.kind, prompt: d.prompt, options: d.options.map((o) => ({ label: o.label })) })
                                setAddedPrompt(d.prompt)
                              }}
                              className="inline-flex items-center gap-1 rounded bg-teal-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                            >
                              {t('copilot.add_to_session')}
                            </button>
                          ))}
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
