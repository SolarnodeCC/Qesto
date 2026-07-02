import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { api } from '../api/client'
import { SESSION_TITLE_MAX } from '../lib/session-title'

type SessionTitleFieldProps = {
  sessionId: string
  title: string
  editable: boolean
  onSaved?: (title: string) => void
  label?: string
  saveErrorLabel?: string
  savingLabel?: string
  className?: string
}

export default function SessionTitleField({
  sessionId,
  title,
  editable,
  onSaved,
  label,
  saveErrorLabel = 'Could not save title',
  savingLabel = 'Saving…',
  className = '',
}: SessionTitleFieldProps) {
  const [value, setValue] = useState(title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastSaved = useRef(title)

  useEffect(() => {
    setValue(title)
    lastSaved.current = title
  }, [title])

  async function saveTitle(next: string) {
    const trimmed = next.trim()
    if (!trimmed || trimmed === lastSaved.current) return

    setSaving(true)
    setError(null)
    const res = await api<{ session: { title: string } }>(
      `/api/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'PATCH', body: { title: trimmed } },
    )
    setSaving(false)

    if (!res.ok) {
      setError(res.error.message || saveErrorLabel)
      setValue(lastSaved.current)
      return
    }

    lastSaved.current = trimmed
    setValue(trimmed)
    onSaved?.(trimmed)
  }

  function handleBlur() {
    if (!editable || saving) return
    void saveTitle(value)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
    if (e.key === 'Escape') {
      setValue(lastSaved.current)
      e.currentTarget.blur()
    }
  }

  if (!editable) {
    return (
      <h1 tabIndex={-1} className={`text-3xl font-semibold focus:outline-none dark:text-[var(--text-primary)] ${className}`}>
        {title}
      </h1>
    )
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label htmlFor={`session-title-${sessionId}`} className="caption text-pulse-500">
          {label}
        </label>
      )}
      <input
        id={`session-title-${sessionId}`}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={saving}
        maxLength={SESSION_TITLE_MAX}
        aria-invalid={error ? true : undefined}
        className="w-full text-3xl font-semibold bg-transparent border-b border-transparent hover:border-pulse-200 focus:border-teal-500 focus:outline-none focus:ring-0 dark:text-[var(--text-primary)] dark:hover:border-[var(--color-border-strong)] dark:focus:border-teal-500 disabled:opacity-60 px-0 py-1"
      />
      {(saving || error) && (
        <p
          role={error ? 'alert' : 'status'}
          aria-live="polite"
          className={`text-sm ${error ? 'text-red-600 dark:text-red-400' : 'text-pulse-500'}`}
        >
          {error ?? savingLabel}
        </p>
      )}
    </div>
  )
}
