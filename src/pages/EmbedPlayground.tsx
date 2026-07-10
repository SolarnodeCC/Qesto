/**
 * EmbedPlayground — FE-EMBED-PLAYGROUND-01 (ADR-0050).
 * Authenticated host console: create widget configs, mint tokens, copy snippet,
 * preview the live embed.
 *
 * Plan gate: embedWidgets (Chorus tier only).
 * When the entitlement is missing (403 from /api/embed/widgets), shows the
 * upgrade affordance matching the existing denyFeature pattern.
 */

import { useCallback, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import { useSessions } from '../hooks/useSessions'
import { useEmbedWidgets } from '../hooks/useEmbedWidgets'
import type { EmbedWidget } from '@api/types'
import type { SessionSummary } from '../types/session'
import MainLayout from '../layouts/MainLayout'

// ── Snippet generator ─────────────────────────────────────────────────────────

function buildSnippet(session: string, token: string, origin: string): string {
  const src = typeof window !== 'undefined' ? `${window.location.origin}/embed/qesto-embed.js` : '/embed/qesto-embed.js'
  return `<!-- qesto embed snippet -->
<script src="${src}"
        data-qesto-embed
        data-session="${session}"
        data-token="${token}"
        data-origin="${origin}"
        data-theme="light"></script>`
}

// ── Clipboard helper ──────────────────────────────────────────────────────────

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// ── Upgrade affordance (Team gate) ────────────────────────────────────────────

function UpgradeGate({ t }: { t: (key: string) => string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-8 py-20 px-8 text-center"
      role="status"
      aria-label={t('playground.upgradeTitle')}
    >
      <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
        <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-teal-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-pulse-900 dark:text-[#F0F2F8]">{t('playground.upgradeTitle')}</h2>
        <p className="mt-2 text-sm text-pulse-500 dark:text-[#8A96B0] max-w-sm mx-auto">{t('playground.upgradeBody')}</p>
      </div>
      <Link
        to="/pricing"
        className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors min-h-[44px]"
      >
        {t('playground.upgradeCta')}
      </Link>
    </div>
  )
}

// ── Widget row ────────────────────────────────────────────────────────────────

interface WidgetRowProps {
  widget: EmbedWidget
  sessions: SessionSummary[]
  onRevoke: (wid: string) => Promise<boolean>
  onMintToken: (wid: string) => Promise<{ token: string; exp: number } | null>
  t: (key: string, vars?: Record<string, string | number>) => string
}

function WidgetRow({ widget, sessions, onRevoke, onMintToken, t }: WidgetRowProps) {
  const [revoking, setRevoking] = useState(false)
  const [minting, setMinting] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [exp, setExp] = useState<number | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [snippetCopied, setSnippetCopied] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)

  const session = sessions.find((s) => s.id === widget.session_id)
  const isRevoked = widget.revoked_at !== null

  async function handleRevoke() {
    if (!window.confirm('Revoke this widget? All tokens minted for it will immediately stop working.')) return
    setRevoking(true)
    await onRevoke(widget.id)
    setRevoking(false)
  }

  async function handleMint() {
    setMinting(true)
    const result = await onMintToken(widget.id)
    setMinting(false)
    if (result) {
      setToken(result.token)
      setExp(result.exp)
      setPreviewVisible(false)
    }
  }

  async function handleCopyToken() {
    if (!token) return
    const ok = await copyToClipboard(token)
    if (ok) {
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    }
  }

  async function handleCopySnippet() {
    if (!token || !session) return
    const snippet = buildSnippet(widget.session_code, token, widget.allowed_origins[0] ?? window.location.origin)
    const ok = await copyToClipboard(snippet)
    if (ok) {
      setSnippetCopied(true)
      setTimeout(() => setSnippetCopied(false), 2000)
    }
  }

  const previewUrl = token && session
    ? `${window.location.origin}/embed/widget?session=${encodeURIComponent(widget.session_code)}&token=${encodeURIComponent(token)}&origin=${encodeURIComponent(widget.allowed_origins[0] ?? window.location.origin)}&theme=light`
    : null

  return (
    <article
      className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] overflow-hidden"
      aria-label={`Widget ${widget.id}`}
    >
      {/* Header */}
      <div className="px-4 py-3 flex flex-wrap items-start justify-between gap-2 border-b border-pulse-100 dark:border-[#1E2A45]">
        <div className="min-w-0">
          <p className="text-xs font-mono text-pulse-500 dark:text-[#8A96B0] truncate">{widget.id}</p>
          {session && (
            <p className="text-sm font-medium text-pulse-900 dark:text-[#F0F2F8] truncate mt-0.5">{session.title}</p>
          )}
          <p className="text-xs text-pulse-500 dark:text-[#8A96B0] mt-0.5">
            {t('playground.allowedOrigins')}: {widget.allowed_origins.join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={[
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            isRevoked
              ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
          ].join(' ')}>
            {isRevoked ? t('playground.revoked') : t('playground.active')}
          </span>
          {!isRevoked && (
            <button
              type="button"
              onClick={() => void handleRevoke()}
              disabled={revoking}
              className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded px-2 py-1 min-h-[32px]"
              aria-label={`${t('playground.revokeButton')} ${widget.id}`}
            >
              {revoking ? t('playground.revoking') : t('playground.revokeButton')}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!isRevoked && (
        <div className="px-4 py-4 space-y-4">
          {/* Mint token */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleMint()}
              disabled={minting}
              className="inline-flex items-center justify-center rounded-lg border border-pulse-200 dark:border-[#2A3858] px-4 py-2 text-sm font-medium text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors min-h-[40px]"
            >
              {minting ? t('playground.minting') : t('playground.mintToken')}
            </button>
            {token && exp && (
              <span className="text-xs text-pulse-500 dark:text-[#8A96B0]">
                {t('playground.tokenExpiry')}: {new Date(exp * 1000).toLocaleTimeString()}
              </span>
            )}
          </div>

          {token && (
            <>
              {/* Token display */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-pulse-600 dark:text-[#A8B3CC]">
                  {t('playground.tokenLabel')}
                </label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={token}
                    aria-label={t('playground.tokenLabel')}
                    className="flex-1 min-w-0 rounded-lg border border-pulse-200 dark:border-[#2A3858] bg-pulse-50 dark:bg-[#0F1628] px-3 py-2 text-xs font-mono text-pulse-700 dark:text-[#A8B3CC] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCopyToken()}
                    className="shrink-0 rounded-lg border border-pulse-200 dark:border-[#2A3858] px-3 py-2 text-sm text-pulse-600 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[40px] min-w-[44px]"
                    aria-label={tokenCopied ? t('playground.tokenCopied') : t('playground.copyToken')}
                  >
                    {tokenCopied ? t('playground.tokenCopied') : '⧉'}
                  </button>
                </div>
              </div>

              {/* Snippet */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-pulse-600 dark:text-[#A8B3CC]">
                  {t('playground.snippetLabel')}
                </label>
                <div className="relative">
                  <pre className="rounded-lg border border-pulse-200 dark:border-[#2A3858] bg-pulse-50 dark:bg-[#0F1628] px-4 py-3 text-xs font-mono text-pulse-700 dark:text-[#A8B3CC] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {buildSnippet(widget.session_code, token, widget.allowed_origins[0] ?? window.location.origin)}
                  </pre>
                  <button
                    type="button"
                    onClick={() => void handleCopySnippet()}
                    className="absolute top-2 right-2 rounded border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-[#1C2540] px-2 py-1 text-xs text-pulse-600 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[32px]"
                    aria-label={snippetCopied ? t('playground.snippetCopied') : t('playground.copySnippet')}
                  >
                    {snippetCopied ? t('playground.snippetCopied') : t('playground.copySnippet')}
                  </button>
                </div>
              </div>

              {/* Live preview */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPreviewVisible((v) => !v)}
                  className="text-sm text-teal-600 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded min-h-[32px]"
                  aria-expanded={previewVisible}
                  aria-controls={`preview-${widget.id}`}
                >
                  {previewVisible ? 'Hide preview' : t('playground.previewLabel')}
                </button>
                {previewVisible && previewUrl && (
                  <div id={`preview-${widget.id}`}>
                    <iframe
                      src={previewUrl}
                      sandbox="allow-scripts allow-forms allow-popups"
                      allow=""
                      title={t('playground.previewLabel')}
                      loading="lazy"
                      style={{ width: '100%', height: '360px', border: 'none', borderRadius: '8px', display: 'block' }}
                      className="border border-pulse-200 dark:border-[#1E2A45] rounded-lg"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  )
}

// ── Create widget form ─────────────────────────────────────────────────────────

interface CreateWidgetFormProps {
  sessions: SessionSummary[]
  sessionsLoading: boolean
  onCreate: (sessionId: string, origins: string[]) => Promise<void>
  creating: boolean
  createError: string | null
  t: (key: string) => string
}

function CreateWidgetForm({ sessions, sessionsLoading, onCreate, creating, createError, t }: CreateWidgetFormProps) {
  const [sessionId, setSessionId] = useState('')
  const [originsText, setOriginsText] = useState('')
  const originsRef = useRef<HTMLTextAreaElement>(null)

  const liveSessions = sessions.filter((s) => s.status === 'live' || s.status === 'draft' || s.status === 'closed')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sessionId) return
    const origins = originsText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
    if (origins.length === 0) {
      originsRef.current?.focus()
      return
    }
    await onCreate(sessionId, origins)
    setSessionId('')
    setOriginsText('')
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-6 space-y-4"
      aria-label={t('playground.createWidget')}
    >
      <h2 className="text-base font-semibold text-pulse-900 dark:text-[#F0F2F8]">{t('playground.createWidget')}</h2>

      {/* Session selector */}
      <div className="space-y-1">
        <label htmlFor="embed-session-select" className="block text-sm font-medium text-pulse-700 dark:text-[#A8B3CC]">
          {t('playground.sessionLabel')}
        </label>
        {sessionsLoading ? (
          <p className="text-sm text-pulse-500 dark:text-[#8A96B0]">{t('playground.loadingSessions')}</p>
        ) : liveSessions.length === 0 ? (
          <p className="text-sm text-pulse-500 dark:text-[#8A96B0]">{t('playground.noSessions')}</p>
        ) : (
          <select
            id="embed-session-select"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            required
            className="w-full rounded-lg border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-[#0F1628] px-3 py-2 text-sm text-pulse-900 dark:text-[#F0F2F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
          >
            <option value="">{t('playground.sessionPlaceholder')}</option>
            {liveSessions.map((s) => (
              <option key={s.id} value={s.id}>{s.title} ({s.code})</option>
            ))}
          </select>
        )}
      </div>

      {/* Origins textarea */}
      <div className="space-y-1">
        <label htmlFor="embed-origins-textarea" className="block text-sm font-medium text-pulse-700 dark:text-[#A8B3CC]">
          {t('playground.originsLabel')}
        </label>
        <p className="text-xs text-pulse-500 dark:text-[#8A96B0]">{t('playground.originsHint')}</p>
        <textarea
          id="embed-origins-textarea"
          ref={originsRef}
          value={originsText}
          onChange={(e) => setOriginsText(e.target.value)}
          placeholder={t('playground.originsPlaceholder')}
          rows={3}
          required
          className="w-full rounded-lg border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-[#0F1628] px-3 py-2 text-sm font-mono text-pulse-900 dark:text-[#F0F2F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 resize-y"
        />
      </div>

      {createError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {createError}
        </p>
      )}

      <button
        type="submit"
        disabled={creating || !sessionId || !originsText.trim()}
        className="inline-flex items-center justify-center rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-6 py-2.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors min-h-[44px]"
      >
        {creating ? t('playground.creating') : t('playground.create')}
      </button>
    </form>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function EmbedPlayground() {
  const auth = useAuth()
  const t = useT('embed')
  const { state: sessionsState } = useSessions()
  const {
    state: widgetsState,
    creating,
    createError,
    createWidget,
    mintToken,
    revokeWidget,
  } = useEmbedWidgets()

  const sessions = sessionsState.status === 'ready' ? sessionsState.sessions : []
  const sessionsLoading = sessionsState.status === 'loading'

  const handleCreate = useCallback(
    async (sessionId: string, origins: string[]) => {
      await createWidget({ session_id: sessionId, allowed_origins: origins })
    },
    [createWidget],
  )

  if (auth.status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center" aria-busy="true">
        <div className="w-12 h-12 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" aria-label="Loading" />
      </div>
    )
  }

  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  return (
    <MainLayout>
      <main id="main" tabIndex={-1} className="focus:outline-none max-w-4xl mx-auto px-4 sm:px-8 py-12 space-y-12">
        {/* Page header */}
        <header className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="text-sm text-pulse-500 dark:text-[#8A96B0] hover:text-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
            >
              {t('playground.backToDashboard')}
            </Link>
            <span className="text-pulse-500 dark:text-[#2A3858]">/</span>
          </div>
          <h1
            tabIndex={-1}
            className="text-2xl font-semibold text-pulse-900 dark:text-[#F0F2F8]"
          >
            {t('playground.title')}
          </h1>
          <p className="text-sm text-pulse-500 dark:text-[#8A96B0]">{t('playground.subtitle')}</p>
        </header>

        {/* Plan gate */}
        {widgetsState.status === 'denied' && <UpgradeGate t={t} />}

        {/* Error state */}
        {widgetsState.status === 'error' && (
          <div role="alert" className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-400">{widgetsState.error.message}</p>
          </div>
        )}

        {/* Content */}
        {(widgetsState.status === 'loading' || widgetsState.status === 'ready') && (
          <>
            {/* Create widget form */}
            <CreateWidgetForm
              sessions={sessions}
              sessionsLoading={sessionsLoading}
              onCreate={handleCreate}
              creating={creating}
              createError={createError}
              t={t}
            />

            {/* Widget list */}
            <section aria-label="Embed widgets">
              <h2 className="text-base font-semibold text-pulse-900 dark:text-[#F0F2F8] mb-4">
                Your embed widgets
              </h2>

              {widgetsState.status === 'loading' && (
                <div className="space-y-3" aria-busy="true" aria-label="Loading widgets">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-pulse-100 dark:bg-[#151C2E] animate-pulse" aria-hidden="true" />
                  ))}
                </div>
              )}

              {widgetsState.status === 'ready' && widgetsState.widgets.length === 0 && (
                <p className="text-sm text-pulse-500 dark:text-[#8A96B0]">{t('playground.noWidgets')}</p>
              )}

              {widgetsState.status === 'ready' && widgetsState.widgets.length > 0 && (
                <ul className="space-y-4" role="list" aria-label="Embed widget list">
                  {widgetsState.widgets.map((widget) => (
                    <li key={widget.id}>
                      <WidgetRow
                        widget={widget}
                        sessions={sessions}
                        onRevoke={revokeWidget}
                        onMintToken={mintToken}
                        t={t}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </MainLayout>
  )
}
