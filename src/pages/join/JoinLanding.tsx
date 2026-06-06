import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../../i18n'
import { inputHint } from '../../ui/input-hint'
import { JOIN_CODE_FIELD_CLASS } from '../../ui/input-field-class'

export function JoinLanding() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const t = useT('join')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length < 1) return
    navigate(`/j/${clean}`)
  }

  return (
    <main id="main" className="min-h-screen flex flex-col">
      <div className="h-1 bg-gradient-to-br from-teal-500 to-violet-500" aria-hidden="true" />
      <div className="border-b border-pulse-100 dark:border-[#1E2A45] px-5 py-3">
        <a href="/" className="font-[family-name:var(--font-display)] font-bold text-[18px] tracking-[-0.02em] text-pulse-900 dark:text-[#F0F2F8] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">Qesto</a>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <h1 tabIndex={-1} className="text-2xl font-bold text-pulse-900 dark:text-[#F0F2F8] focus:outline-none">{t('heading')}</h1>
            <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('subtitle')}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="sr-only">{t('codeLabel')}</span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                {...inputHint(t('codePlaceholder'))}
                maxLength={6}
                autoFocus
                spellCheck={false}
                autoCapitalize="characters"
                aria-label={t('codeLabel')}
                className={JOIN_CODE_FIELD_CLASS}
              />
            </label>
            <button
              type="submit"
              disabled={code.trim().length === 0}
              className="w-full rounded-xl bg-teal-600 text-white text-sm font-semibold py-3 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-colors"
            >
              {t('joinButton')}
            </button>
          </form>
          <p className="text-center text-xs text-pulse-400">
            <a href="/" className="text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded">{t('back')}</a>
          </p>
        </div>
      </div>
    </main>
  )
}
