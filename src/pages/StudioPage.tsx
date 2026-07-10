// STUDIO (ADR-0060, S97) — FE-STUDIO-AUTHORING-01 + STUDIO-LIBRARY-01 (UI) +
// STUDIO-SUGGEST-01 (UI). Full authoring flow: prompt -> generate -> preview/edit
// -> save to library / apply to session, plus a persistent team library and
// "next question" suggestions. Workers AI only on the backend (CLAUDE.md hard
// rule 1) — this page is a thin REST client over functions/api/routes/studio.ts
// and functions/api/routes/studio-library.ts.
import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'
import { PromptForm } from '../components/studio/PromptForm'
import { DraftPreviewList } from '../components/studio/DraftPreviewList'
import { LibraryPanel } from '../components/studio/LibraryPanel'
import { SuggestionChips } from '../components/studio/SuggestionChips'
import type { StudioDraft, StudioLibraryItem, StudioQuestionKind, StudioSuggestion, StudioThemeId } from '../components/studio/types'

type DashboardTeam = { id: string; name: string; plan: string }

type GenerateResponse = { drafts: StudioDraft[]; confidence: number }
type SuggestResponse = { suggestions: StudioSuggestion[]; source: 'matches' | 'none' }
type LibraryListResponse = { items: StudioLibraryItem[]; limit: number; offset: number }
type LibrarySaveResponse = { item: StudioLibraryItem }
type LibraryForkResponse = { item: StudioLibraryItem; forkedFrom: string }
type CreateSessionResponse = { session: { id: string }; questions: unknown[] }

const GENERATE_ERROR_KEYS: Record<string, string> = {
  invalid_topic: 'prompt.error.invalid_topic',
  ai_unavailable: 'prompt.error.ai_unavailable',
  invalid_ai_output: 'prompt.error.invalid_ai_output',
}

export default function StudioPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const t = useT('studio')

  const [teams, setTeams] = useState<DashboardTeam[]>([])
  const [teamId, setTeamId] = useState<string>('')

  // Prompt form state
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(3)
  const [kind, setKind] = useState<StudioQuestionKind | ''>('')
  const [themeId, setThemeId] = useState<StudioThemeId | ''>('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Drafts + edit state
  const [drafts, setDrafts] = useState<StudioDraft[]>([])
  const [confidence, setConfidence] = useState<number | null>(null)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [titles, setTitles] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  // Apply-to-session state
  const [applying, setApplying] = useState(false)
  const [appliedSessionId, setAppliedSessionId] = useState<string | null>(null)

  // Library state
  const [libraryItems, setLibraryItems] = useState<StudioLibraryItem[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [forkingId, setForkingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Suggestions
  const [suggestions, setSuggestions] = useState<StudioSuggestion[]>([])

  // ── Load teams, default to the first one ──────────────────────────────────
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    void api<{ teams: DashboardTeam[] }>('/api/teams').then((res) => {
      if (res.ok && res.data.teams.length > 0) {
        setTeams(res.data.teams)
        setTeamId(res.data.teams[0]!.id)
      }
    })
  }, [auth.status])

  const refreshLibrary = useCallback(async () => {
    if (!teamId) return
    setLibraryLoading(true)
    const res = await api<LibraryListResponse>(`/api/studio/library?teamId=${encodeURIComponent(teamId)}`)
    if (res.ok) setLibraryItems(res.data.items)
    setLibraryLoading(false)
  }, [teamId])

  useEffect(() => {
    void refreshLibrary()
  }, [refreshLibrary])

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-4xl mx-auto p-12">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
          ))}
        </div>
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  async function handleGenerate() {
    if (topic.trim().length === 0) return
    setGenerating(true)
    setGenerateError(null)
    const res = await api<GenerateResponse>('/api/studio/authoring/generate', {
      method: 'POST',
      body: {
        topic: topic.trim(),
        count,
        ...(kind ? { kind } : {}),
        ...(themeId ? { themeId } : {}),
      },
    })
    setGenerating(false)
    if (res.ok) {
      setDrafts(res.data.drafts)
      setConfidence(res.data.confidence)
      setTitles(Object.fromEntries(res.data.drafts.map((d) => [d.id, d.prompt.slice(0, 80)])))
      setSavedIds(new Set())
      setAppliedSessionId(null)
      if (res.data.drafts.length > 0) void fetchSuggestions(res.data.drafts[0]!.prompt, res.data.drafts[0]!.kind)
    } else {
      setGenerateError(GENERATE_ERROR_KEYS[res.error.code] ? t(GENERATE_ERROR_KEYS[res.error.code]!) : t('prompt.error.generic'))
    }
  }

  async function fetchSuggestions(prompt: string, suggestKind: StudioQuestionKind) {
    if (!teamId) return
    const res = await api<SuggestResponse>('/api/studio/authoring/suggest', {
      method: 'POST',
      body: { teamId, prompt, kind: suggestKind === 'poll' ? 'poll' : undefined },
    })
    // Degrade silently: empty suggestions (or a request error) just render nothing.
    if (res.ok) setSuggestions(res.data.suggestions)
    else setSuggestions([])
  }

  function handleEditPrompt(id: string, prompt: string) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, prompt } : d)))
  }

  function handleAcceptSuggestion(s: StudioSuggestion) {
    setTopic(s.prompt)
  }

  async function handleSaveDraft(id: string) {
    const draft = drafts.find((d) => d.id === id)
    if (!draft || !teamId) return
    setSavingId(id)
    const res = await api<LibrarySaveResponse>('/api/studio/library', {
      method: 'POST',
      body: {
        teamId,
        questionJson: { kind: draft.kind, prompt: draft.prompt, options: draft.options },
        ...(themeId ? { themeId } : {}),
        title: titles[id]?.trim() || draft.prompt.slice(0, 80),
      },
    })
    setSavingId(null)
    if (res.ok) {
      setSavedIds((prev) => new Set(prev).add(id))
      void refreshLibrary()
    }
  }

  async function handleFork(id: string) {
    if (!teamId) return
    setForkingId(id)
    await api<LibraryForkResponse>(`/api/studio/library/${encodeURIComponent(id)}/fork?teamId=${encodeURIComponent(teamId)}`, {
      method: 'POST',
    })
    setForkingId(null)
    void refreshLibrary()
  }

  async function handleDelete(id: string) {
    if (!teamId) return
    if (!window.confirm(t('library.deleteConfirm'))) return
    setDeletingId(id)
    await api(`/api/studio/library/${encodeURIComponent(id)}?teamId=${encodeURIComponent(teamId)}`, { method: 'DELETE' })
    setDeletingId(null)
    void refreshLibrary()
  }

  // "Apply to session": creates a new draft session, then seeds each authored
  // question via the existing LAUNCHPAD-02 endpoint (POST /api/sessions/:id/questions),
  // then routes the operator to the launchpad where they can review, reorder, and
  // start it. This is real wiring (not a stub) using endpoints that already exist
  // for Launchpad — see functions/api/routes/sessions/{crud,wizard}.ts.
  async function handleApplyToSession() {
    if (drafts.length === 0 || !teamId) return
    setApplying(true)
    const created = await api<CreateSessionResponse>('/api/sessions', {
      method: 'POST',
      body: { title: topic.trim().slice(0, 120) || t('page.title'), teamId },
    })
    if (!created.ok) {
      setApplying(false)
      return
    }
    const sessionId = created.data.session.id
    for (const draft of drafts) {
      await api(`/api/sessions/${encodeURIComponent(sessionId)}/questions`, {
        method: 'POST',
        body: { kind: draft.kind, prompt: draft.prompt, options: draft.options },
      })
    }
    setApplying(false)
    setAppliedSessionId(sessionId)
  }

  return (
    <MainLayout mainClassName="min-h-screen max-w-4xl mx-auto p-12">
      <h1 tabIndex={-1} className="text-2xl font-bold text-pulse-900 dark:text-[#F0F2F8] focus:outline-none">
        {t('page.title')}
      </h1>
      <p className="mt-2 text-sm text-pulse-600 dark:text-[#9AA8C7]">{t('page.subtitle')}</p>

      {teams.length > 1 && (
        <div className="mt-4">
          <label htmlFor="studio-team" className="block text-sm font-medium text-pulse-900 dark:text-[#F0F2F8]">
            {t('page.teamLabel')}
          </label>
          <select
            id="studio-team"
            className="mt-1 min-h-[44px] rounded-lg border border-pulse-200 px-3 py-2 text-sm dark:border-[#2A3858] dark:bg-pulse-900 dark:text-[#F0F2F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-8">
        <PromptForm
          t={t}
          topic={topic}
          onTopicChange={setTopic}
          count={count}
          onCountChange={setCount}
          kind={kind}
          onKindChange={setKind}
          themeId={themeId}
          onThemeChange={setThemeId}
          onSubmit={() => void handleGenerate()}
          submitting={generating}
          error={generateError}
        />
      </div>

      {suggestions.length > 0 && (
        <div className="mt-8">
          <SuggestionChips t={t} suggestions={suggestions} onAccept={handleAcceptSuggestion} />
        </div>
      )}

      <div className="mt-8">
        <DraftPreviewList
          t={t}
          drafts={drafts}
          confidence={confidence}
          selectedId={selectedDraftId}
          onSelect={setSelectedDraftId}
          onEditPrompt={handleEditPrompt}
          onSaveTitleFor={(id) => titles[id] ?? ''}
          onTitleChange={(id, title) => setTitles((prev) => ({ ...prev, [id]: title }))}
          savingId={savingId}
          savedIds={savedIds}
          onSave={(id) => void handleSaveDraft(id)}
        />
      </div>

      {drafts.length > 0 && (
        <div className="mt-8 rounded-lg border border-violet-200 bg-violet-50 p-6 dark:border-violet-800 dark:bg-violet-900/20">
          {appliedSessionId ? (
            <div aria-live="polite">
              <p className="text-sm font-medium text-violet-800 dark:text-violet-200">{t('preview.applied')}</p>
              <button
                type="button"
                onClick={() => navigate(`/sessions/${encodeURIComponent(appliedSessionId)}/launchpad`)}
                className="mt-3 min-h-[44px] rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {t('preview.openSession')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleApplyToSession()}
              disabled={applying}
              className="min-h-[44px] rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {applying ? t('preview.applying') : t('preview.applyToSession')}
            </button>
          )}
        </div>
      )}

      <div className="mt-12">
        <LibraryPanel
          t={t}
          items={libraryItems}
          loading={libraryLoading}
          forkingId={forkingId}
          deletingId={deletingId}
          onFork={(id) => void handleFork(id)}
          onDelete={(id) => void handleDelete(id)}
        />
      </div>
    </MainLayout>
  )
}
