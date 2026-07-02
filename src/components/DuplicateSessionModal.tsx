import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import { api } from '../api/client'
import { SESSION_TITLE_MAX, suggestDuplicateTitle } from '../lib/session-title'
import { inputHint } from '../ui/input-hint'

type DuplicateSessionModalProps = {
  open: boolean
  sourceId: string
  sourceTitle: string
  existingTitles: string[]
  onClose: () => void
  onSuccess: (newSessionId: string) => void
}

export default function DuplicateSessionModal({
  open,
  sourceId,
  sourceTitle,
  existingTitles,
  onClose,
  onSuccess,
}: DuplicateSessionModalProps) {
  const t = useT('dashboard')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setTitle(suggestDuplicateTitle(sourceTitle, existingTitles))
    setError(null)
    setSubmitting(false)
    const tId = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(tId)
  }, [open, sourceTitle, existingTitles])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  const trimmed = title.trim()
  const hasNameCollision =
    trimmed.length > 0 &&
    existingTitles.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!trimmed) return
    setSubmitting(true)
    setError(null)
    const res = await api<{ session: { id: string } }>(
      `/api/sessions/${encodeURIComponent(sourceId)}/duplicate`,
      { method: 'POST', body: { title: trimmed } },
    )
    setSubmitting(false)
    if (!res.ok) {
      setError(res.error.message)
      return
    }
    onSuccess(res.data.session.id)
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-session-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        ref={modalRef}
        className="bg-white dark:bg-[var(--color-surface-elevated)] rounded-xl shadow-xl max-w-md w-full p-6 animate-page-enter space-y-4 border border-pulse-200 dark:border-[var(--color-border-strong)]"
      >
        <h2 id="duplicate-session-modal-title" className="text-xl font-semibold dark:text-[var(--text-primary)]">
          {t('duplicateTitleModal.title')}
        </h2>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <label htmlFor="duplicate-session-title" className="text-sm font-medium dark:text-[var(--text-primary)]">
            {t('duplicateTitleModal.label')}
          </label>
          <input
            ref={inputRef}
            id="duplicate-session-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            {...inputHint(t('duplicateTitleModal.hint'))}
            maxLength={SESSION_TITLE_MAX}
            disabled={submitting}
            className="w-full border border-pulse-300 dark:border-[var(--color-border-strong)] dark:bg-[var(--color-surface)] dark:text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:opacity-60"
          />
          {hasNameCollision && (
            <p role="status" className="text-sm text-amber-700 dark:text-amber-400">
              {t('duplicateTitleModal.duplicateNameWarning')}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-pulse-300 dark:border-[var(--color-border-strong)] text-pulse-700 dark:text-[var(--text-secondary)] hover:bg-pulse-50 dark:hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
            >
              {t('duplicateTitleModal.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || trimmed.length === 0}
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 min-h-[44px]"
            >
              {submitting ? t('duplicating') : t('duplicateTitleModal.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
