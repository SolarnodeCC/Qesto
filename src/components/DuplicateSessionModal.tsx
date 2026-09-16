import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useT } from '../i18n'
import { api } from '../api/client'
import { SESSION_TITLE_MAX, suggestDuplicateTitle } from '../lib/session-title'
import { inputHint } from '../ui/input-hint'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/components'

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

  useEffect(() => {
    if (!open) return
    setTitle(suggestDuplicateTitle(sourceTitle, existingTitles))
    setError(null)
    setSubmitting(false)
  }, [open, sourceTitle, existingTitles])

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="duplicate-session-modal-title"
      title={t('duplicateTitleModal.title')}
      closeDisabled={submitting}
      initialFocusRef={inputRef}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <label htmlFor="duplicate-session-title" className="text-sm font-medium text-[var(--text-primary)]">
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
          className="w-full border border-[color:var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--text-primary)] rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:opacity-60"
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
          <Button type="button" variant="secondary" disabled={submitting} onClick={onClose}>
            {t('duplicateTitleModal.cancel')}
          </Button>
          <Button type="submit" disabled={submitting || trimmed.length === 0}>
            {submitting ? t('duplicating') : t('duplicateTitleModal.confirm')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
