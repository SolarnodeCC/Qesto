import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSession, type PollOption } from '../hooks/useSessions'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'
import AIBadge from '../components/AIBadge'
import { inputHint } from '../ui/input-hint'

function newOptionId(): string {
  return `opt_${crypto.randomUUID().slice(0, 8)}`
}

export default function SessionConfig() {
  const auth = useAuth()
  const t = useT('session-config')
  const { id } = useParams<{ id: string }>()
  const { data, error, loading, patch } = useSession(id)

  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState<PollOption[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // AI suggestion state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])

  // Hydrate form once the session loads.
  useEffect(() => {
    if (!data) return
    setTitle(data.session.title)
    const existingPoll = data.questions.find((q) => q.kind === 'poll')
    if (existingPoll) {
      setPrompt(existingPoll.prompt)
      setOptions(existingPoll.options)
    } else {
      setPrompt('')
      setOptions([
        { id: newOptionId(), label: '' },
        { id: newOptionId(), label: '' },
      ])
    }
  }, [data])

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen flex items-center justify-center p-8 text-pulse-500">
        {t('loading')}
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return (
      <MainLayout mainClassName="min-h-screen flex items-center justify-center p-8 text-pulse-500">
        {t('loadingSession')}
      </MainLayout>
    )
  }
  if (error || !data) {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-8 space-y-4">
        <p role="alert" className="text-red-600">
          {error?.message ?? t('sessionNotFound')}
        </p>
        <Link to="/dashboard" className="text-teal-600 hover:underline">
          {t('backToDashboard')}
        </Link>
      </MainLayout>
    )
  }

  if (data.session.status === 'draft') {
    return <Navigate to={`/sessions/${id}/launchpad`} replace />
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, label: value } : o)))
  }

  function addOption() {
    if (options.length >= 10) return
    setOptions((prev) => [...prev, { id: newOptionId(), label: '' }])
  }

  function removeOption(index: number) {
    if (options.length <= 2) return
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleAiSuggest() {
    if (!id) return
    setAiLoading(true)
    setAiError(null)
    setAiSuggestions([])

    type AnalyzeResponse = {
      session_id: string
      themes: string[]
      follow_ups: string[]
      generated_at: number
      model: string
    }

    const res = await api<AnalyzeResponse>(
      `/api/sessions/${encodeURIComponent(id)}/insights/analyze`,
      { method: 'POST' },
    )

    setAiLoading(false)

    if (!res.ok) {
      setAiError(res.error.message)
      return
    }

    // Surface the follow_ups as suggested poll prompts (up to 3)
    const suggestions = res.data.follow_ups.slice(0, 3)
    setAiSuggestions(suggestions.length > 0 ? suggestions : [t('noSuggestions')])
  }

  function adoptSuggestion(suggestion: string) {
    setPrompt(suggestion)
    setAiSuggestions([])
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaveError(null)
    setSaved(false)

    const cleanedOptions = options
      .map((o) => ({ id: o.id, label: o.label.trim() }))
      .filter((o) => o.label.length > 0)

    const payload: { title?: string; question?: { kind: 'poll'; prompt: string; options: PollOption[] } } = {}
    if (title.trim() !== data!.session.title) payload.title = title.trim()
    if (prompt.trim().length > 0 && cleanedOptions.length >= 2) {
      payload.question = {
        kind: 'poll',
        prompt: prompt.trim(),
        options: cleanedOptions,
      }
    } else if (prompt.trim().length > 0 || cleanedOptions.length > 0) {
      setSaveError(t('validationNeedsPrompt'))
      return
    }

    if (!payload.title && !payload.question) {
      setSaveError(t('noChanges'))
      return
    }

    setSaving(true)
    const res = await patch(payload)
    setSaving(false)
    if (res.ok) setSaved(true)
    else setSaveError(res.error.message)
  }

  const STATUS_KEY: Record<string, string> = {
    live: 'status_live', closed: 'status_closed', draft: 'status_draft', archived: 'status_archived',
  }
  const statusLabel = STATUS_KEY[data.session.status] ? t(STATUS_KEY[data.session.status]) : data.session.status

  const navSlot = (
    <Link
      to="/dashboard"
      className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
    >
      ← {t('backToDashboard')}
    </Link>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto density-pad-8 density-stack-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 tabIndex={-1} className="text-3xl font-semibold focus:outline-none dark:text-[var(--text-primary)]">{t('configureTitle')}</h1>
          <p className="text-sm text-pulse-500 dark:text-[var(--text-secondary)]">{t('joinCodeLabel')}: <code className="font-mono">{data.session.code}</code></p>
        </div>
        <span className="text-xs uppercase tracking-wider rounded-full px-2 py-0.5 bg-pulse-100 dark:bg-[var(--color-border)] text-pulse-600 dark:text-[var(--text-secondary)]">
          {statusLabel}
        </span>
      </div>

      <form onSubmit={handleSave} className="density-stack-5">
        <div className="space-y-2">
          <label htmlFor="session-title" className="text-sm font-medium dark:text-[var(--text-primary)]">
            {t('titleLabel')}
          </label>
          <input
            id="session-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="w-full border border-pulse-300 dark:border-[var(--color-border-strong)] dark:bg-[var(--color-surface-elevated)] dark:text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          />
        </div>

        <fieldset className="space-y-3 rounded-xl border border-pulse-200 dark:border-[var(--color-border)] dark:bg-[var(--color-surface)] density-pad-5">
          <legend className="text-sm font-medium px-1 dark:text-[var(--text-primary)]">{t('pollQuestion')}</legend>

          <div className="space-y-2">
            <label htmlFor="poll-prompt" className="text-sm font-medium dark:text-[var(--text-primary)]">
              {t('promptLabel')}
            </label>
            <input
              id="poll-prompt"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              {...inputHint(t('promptPlaceholder'))}
              maxLength={240}
              className="w-full border border-pulse-300 dark:border-[var(--color-border-strong)] dark:bg-[var(--color-surface-elevated)] dark:text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />

            {/* AI Suggest button */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleAiSuggest}
                disabled={aiLoading}
                aria-label={t('aiSuggestAria')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 dark:border-violet-800/60 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 px-3 py-1.5 text-sm font-medium hover:bg-violet-100 dark:hover:bg-violet-900/30 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 transition-colors"
              >
                {aiLoading ? (
                  <>
                    <Loader2 size={14} aria-hidden="true" className="animate-spin text-violet-600" />
                    {t('aiGenerating')}
                  </>
                ) : (
                  <>
                    <Sparkles size={14} aria-hidden="true" />
                    {t('aiSuggest')}
                  </>
                )}
              </button>
            </div>

            {/* AI error */}
            {aiError ? (
              <p role="alert" className="text-xs text-red-600">
                {aiError}
              </p>
            ) : null}

            {/* AI suggestions list */}
            {aiSuggestions.length > 0 && (
              <div className="rounded-lg border border-violet-200 dark:border-violet-800/60 bg-violet-50 dark:bg-violet-900/20 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AIBadge />
                  <span className="text-xs text-pulse-500">{t('aiSuggestionHelp')}</span>
                </div>
                <ul className="space-y-1" aria-label={t('aiSuggestionsAria')}>
                  {aiSuggestions.map((suggestion, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => adoptSuggestion(suggestion)}
                        className="w-full text-left text-sm text-violet-800 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-200 hover:underline rounded px-1 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1"
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium dark:text-[var(--text-primary)]">{t('optionsCount', { count: options.length })}</p>
            <ul className="space-y-2">
              {options.map((o, i) => (
                <li key={o.id} className="flex gap-2">
                  <input
                    type="text"
                    value={o.label}
                    onChange={(e) => updateOption(i, e.target.value)}
                    {...inputHint(t('optionLabel', { number: i + 1 }))}
                    maxLength={160}
                    aria-label={t('optionLabel', { number: i + 1 })}
                    className="flex-1 border border-pulse-300 dark:border-[var(--color-border-strong)] dark:bg-[var(--color-surface-elevated)] dark:text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    className="text-pulse-500 dark:text-[var(--text-muted)] hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm px-2"
                    aria-label={t('removeOptionAria', { number: i + 1 })}
                  >
                    {t('removeOption')}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={addOption}
              disabled={options.length >= 10}
              className="text-sm text-teal-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('addOptionShort')}
            </button>
          </div>
        </fieldset>

        {saveError ? (
          <p role="alert" className="text-sm text-red-600">
            {saveError}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-sm text-teal-600">
            {t('saveSuccess')}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            {saving ? t('saving') : t('save')}
          </button>
          {data.session.status === 'live' ? (
            <Link
              to={`/sessions/${id}/present`}
              className="inline-flex items-center rounded-lg border border-teal-500 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 px-4 py-2 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {t('openPresenter')}
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-lg border border-pulse-300 dark:border-[var(--color-border-strong)] text-pulse-500 dark:text-[var(--text-muted)] px-4 py-2 font-medium">
              {t('sessionClosed')}
            </span>
          )}
        </div>
      </form>
    </MainLayout>
  )
}
