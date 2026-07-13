// Voter-facing DELIBERATE session page (ADR-0049).
//
// Flow:
//   1. Lookup session by code → get sessionId + config
//   2. Show ballot choices (derived from session config questions)
//   3. Cast vote → show receipt (DeliberateReceipt)
//   4. Inline verify affordance via useDeliberateSession

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import { useT } from '../i18n'
import { useDeliberateSession } from '../hooks/useDeliberateSession'
import { DeliberateReceipt } from '../ui/DeliberateReceipt'
import { DeliberateVerifyView } from '../ui/DeliberateVerifyView'
import ParticipantShell from '../layouts/ParticipantShell'

// What the session-by-code lookup returns (common shape shared by all session types).
type SessionMeta = {
  id: string
  title: string
  status: string
}

// The deliberate config endpoint also tells us if the ballot is ready + the choices.
// Choices are derived from the session's first question options by convention.
type DeliberateConfigData = {
  sessionId: string
  sessionMode: string
  status: string
  deliberateReady: boolean
  ballotCount: number
  choices?: string[]
}

type Lookup =
  | { status: 'loading' }
  | { status: 'ready'; sessionId: string; title: string }
  | { status: 'error'; message: string }

export default function DeliberateJoin() {
  const { code } = useParams<{ code: string }>()
  const [lookup, setLookup] = useState<Lookup>({ status: 'loading' })

  useEffect(() => {
    if (!code) return
    let cancelled = false
    ;(async () => {
      const res = await api<SessionMeta>(`/api/sessions/by-code/${encodeURIComponent(code.toUpperCase())}`)
      if (cancelled) return
      if (res.ok) setLookup({ status: 'ready', sessionId: res.data.id, title: res.data.title })
      else setLookup({ status: 'error', message: res.error.message })
    })()
    return () => {
      cancelled = true
    }
  }, [code])

  if (lookup.status === 'loading') return <div className="p-12 text-center text-pulse-500">…</div>
  if (lookup.status === 'error')
    return <div className="p-12 text-center text-red-600">{lookup.message}</div>
  return <Ballot sessionId={lookup.sessionId} title={lookup.title} />
}

function Ballot({ sessionId, title }: { sessionId: string; title: string }) {
  const t = useT('deliberate')
  const { state, cast, verify } = useDeliberateSession(sessionId)
  const [config, setConfig] = useState<DeliberateConfigData | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    const res = await api<DeliberateConfigData>(
      `/api/sessions/${encodeURIComponent(sessionId)}/deliberate/config`,
    )
    if (res.ok) setConfig(res.data)
    else setConfigError(res.error.message)
  }, [sessionId])

  useEffect(() => {
    void fetchConfig()
  }, [fetchConfig])

  async function handleCast() {
    if (!selectedChoice) return
    await cast(selectedChoice)
  }

  const phase = state.phase
  const isCasting = phase.kind === 'casting'
  const hasReceipt = phase.kind === 'cast_done' || phase.kind === 'verified' || phase.kind === 'verify_error'

  // Extract receipt from any of the three post-cast phases.
  const receipt: import('../hooks/useDeliberateSession').DeliberateReceipt | null =
    phase.kind === 'cast_done' || phase.kind === 'verified' || phase.kind === 'verify_error'
      ? phase.receipt
      : null

  // verifyResult: undefined = no attempt yet, null = in-flight, result object = done
  const verifyResult: import('../hooks/useDeliberateSession').DeliberateVerifyResult | null | undefined =
    phase.kind === 'verified'
      ? phase.result
      : phase.kind === 'verifying'
        ? null
        : undefined

  const verifyError = phase.kind === 'verify_error' ? phase.message : null

  const choices: string[] = config?.choices ?? []

  if (configError) return <div className="p-12 text-center text-red-600">{configError}</div>
  if (!config) return <div className="p-12 text-center text-pulse-500">…</div>

  return (
    <ParticipantShell title={title} subtitle={t('ballot.subtitle')} maxWidth="2xl">
      {/* Session not yet ready */}
      {!config.deliberateReady && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">{t('ballot.notReady')}</p>
        </div>
      )}

      {/* Voting form — only when ready and not yet cast */}
      {config.deliberateReady && !hasReceipt && (
        <section aria-labelledby="ballot-heading">
          <h2
            id="ballot-heading"
            className="mb-4 text-sm font-bold uppercase tracking-wide text-pulse-600 dark:text-pulse-400"
          >
            {t('ballot.chooseHeading')}
          </h2>

          {choices.length === 0 && (
            <p className="text-sm text-pulse-500">{t('ballot.noChoices')}</p>
          )}

          <fieldset className="space-y-2" aria-label={t('ballot.chooseHeading')}>
            <legend className="sr-only">{t('ballot.chooseHeading')}</legend>
            {choices.map((choice) => (
              <label
                key={choice}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  selectedChoice === choice
                    ? 'border-teal-500 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-900/30 dark:text-teal-200'
                    : 'border-pulse-200 text-pulse-800 hover:border-teal-400 dark:border-pulse-700 dark:text-pulse-200'
                }`}
              >
                <input
                  type="radio"
                  name="deliberate-choice"
                  value={choice}
                  checked={selectedChoice === choice}
                  onChange={() => setSelectedChoice(choice)}
                  className="h-4 w-4 accent-teal-600"
                />
                {choice}
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            onClick={() => void handleCast()}
            disabled={!selectedChoice || isCasting}
            aria-disabled={!selectedChoice || isCasting}
            className="mt-6 min-h-[44px] w-full rounded-lg bg-teal-600 px-6 py-3 text-base font-semibold text-white hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {isCasting ? t('ballot.casting') : t('ballot.cast')}
          </button>

          {phase.kind === 'cast_error' && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
              {phase.message}
            </p>
          )}
        </section>
      )}

      {/* Receipt + verify */}
      {hasReceipt && receipt && (
        <section aria-label={t('receipt.ariaLabel')}>
          <p
            role="status"
            aria-live="polite"
            className="mb-4 rounded-lg bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 dark:bg-teal-900/20 dark:text-teal-200"
          >
            {t('ballot.castSuccess')}
          </p>

          <DeliberateReceipt
            receipt={receipt}
            verifyResult={verifyResult}
            verifying={state.phase.kind === 'verifying'}
            verifyError={verifyError}
            onVerify={() => void verify()}
            t={t}
          />

          {/* Inline verify result panel */}
          {phase.kind === 'verified' && (
            <div className="mt-4">
              <DeliberateVerifyView result={phase.result} t={t} />
            </div>
          )}
        </section>
      )}
    </ParticipantShell>
  )
}
