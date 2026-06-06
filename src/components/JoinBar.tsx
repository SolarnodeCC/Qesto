import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n'
import { inputHint } from '../ui/input-hint'
import { JOIN_BAR_CODE_CLASS } from '../ui/input-field-class'

export default function JoinBar() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const t = useT('join')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length < 1) return
    navigate(`/j/${clean}`)
  }

  return (
    <div className="border-b border-pulse-200 bg-teal-50 dark:bg-teal-950/30 dark:border-teal-900">
      <div className="grid-container flex items-center justify-center gap-3 py-2 px-4 md:px-6">
        <span className="text-sm text-pulse-600 dark:text-pulse-400 hidden sm:inline whitespace-nowrap">
          {t('bar_prompt')}
        </span>
        <span className="text-sm text-pulse-600 dark:text-pulse-400 sm:hidden whitespace-nowrap">
          {t('bar_prompt_short')}
        </span>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
            {...inputHint("ABC123")}
            maxLength={6}
            aria-label={t('bar_code_label')}
            spellCheck={false}
            autoCapitalize="characters"
            className={JOIN_BAR_CODE_CLASS}
          />
          <button
            type="submit"
            disabled={code.trim().length === 0}
            className="inline-flex items-center rounded-md bg-teal-600 text-white text-sm font-semibold px-3 py-1.5 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 transition-colors"
          >
            {t('bar_button')}
          </button>
        </form>
      </div>
    </div>
  )
}
