import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useSession, type PollOption } from '../hooks/useSessions'
import { api } from '../api/client'

function newOptionId(): string {
  return `opt_${crypto.randomUUID().slice(0, 8)}`
}

export default function SessionConfig() {
  const auth = useAuth()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { data, error, loading, patch } = useSession(id)

  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [options, setOptions] = useState<PollOption[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

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
      <main className="min-h-screen flex items-center justify-center p-8 text-pulse-500">
        Loading…
      </main>
    )
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-pulse-500">
        Loading session…
      </main>
    )
  }
  if (error || !data) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8 space-y-4">
        <p role="alert" className="text-red-600">
          {error?.message ?? 'Session not found'}
        </p>
        <Link to="/dashboard" className="text-teal-600 hover:underline">
          ← Back to dashboard
        </Link>
      </main>
    )
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
      setSaveError('A poll needs a prompt and at least two non-empty options.')
      return
    }

    if (!payload.title && !payload.question) {
      setSaveError('No changes to save.')
      return
    }

    setSaving(true)
    const res = await patch(payload)
    setSaving(false)
    if (res.ok) setSaved(true)
    else setSaveError(res.error.message)
  }

  return (
    <main id="main" className="min-h-screen max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/dashboard" className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded">
          ← Dashboard
        </Link>
        <span className="text-xs uppercase tracking-wider rounded-full px-2 py-0.5 bg-pulse-100 text-pulse-600">
          {data.session.status}
        </span>
      </div>

      <header>
        <p className="text-sm uppercase tracking-widest text-teal-600">Session</p>
        <h1 tabIndex={-1} className="text-3xl font-semibold focus:outline-none">Configure</h1>
        <p className="text-sm text-pulse-500">Join code: <code className="font-mono">{data.session.code}</code></p>
      </header>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="session-title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="session-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="w-full border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          />
        </div>

        <fieldset className="space-y-3 rounded-xl border border-pulse-200 p-5">
          <legend className="text-sm font-medium px-1">Poll question</legend>

          <div className="space-y-2">
            <label htmlFor="poll-prompt" className="text-sm font-medium">
              Prompt
            </label>
            <input
              id="poll-prompt"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should we prioritise next quarter?"
              maxLength={240}
              className="w-full border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Options ({options.length}/10)</p>
            <ul className="space-y-2">
              {options.map((o, i) => (
                <li key={o.id} className="flex gap-2">
                  <input
                    type="text"
                    value={o.label}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    maxLength={160}
                    aria-label={`Option ${i + 1}`}
                    className="flex-1 border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    className="text-pulse-500 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-sm px-2"
                    aria-label={`Remove option ${i + 1}`}
                  >
                    Remove
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
              + Add option
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
            Saved.
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            disabled={starting || data.session.status !== 'draft' || data.questions.length === 0}
            onClick={async () => {
              if (!id) return
              setStarting(true)
              setStartError(null)
              const res = await api<{ session: unknown; question: unknown }>(
                `/api/sessions/${encodeURIComponent(id)}/start`,
                { method: 'POST' },
              )
              setStarting(false)
              if (!res.ok) {
                setStartError(res.error.message)
                return
              }
              navigate(`/sessions/${id}/present`)
            }}
            className="inline-flex items-center rounded-lg border border-teal-500 text-teal-700 hover:bg-teal-50 px-4 py-2 font-medium disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            {data.session.status === 'live'
              ? 'Already live'
              : data.session.status === 'closed'
              ? 'Session closed'
              : starting
              ? 'Starting…'
              : 'Go live'}
          </button>
          {data.session.status === 'live' ? (
            <Link
              to={`/sessions/${id}/present`}
              className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
            >
              Open presenter view →
            </Link>
          ) : null}
        </div>
        {startError ? (
          <p role="alert" className="text-sm text-red-600">
            {startError}
          </p>
        ) : null}
      </form>
    </main>
  )
}
