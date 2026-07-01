import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Globe } from 'lucide-react'
import {
  getCurrentLanguage,
  setLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../i18n'

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  nl: 'Nederlands',
  es: 'Español',
  de: 'Deutsch',
  fr: 'Français',
}

const LANGUAGE_SHORT: Record<SupportedLanguage, string> = {
  en: 'EN',
  nl: 'NL',
  es: 'ES',
  de: 'DE',
  fr: 'FR',
}

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false)
  const raw = getCurrentLanguage()
  const current: SupportedLanguage = SUPPORTED_LANGUAGES.includes(raw as SupportedLanguage) ? (raw as SupportedLanguage) : 'en'
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Language: ${LANGUAGE_LABELS[current]}. Change language`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-pulse-200 dark:border-[var(--color-border-strong)] bg-white dark:bg-[var(--color-surface)] px-2.5 py-1.5 text-sm font-medium text-pulse-700 dark:text-[var(--text-secondary)] hover:border-teal-400 hover:text-teal-600 dark:hover:border-teal-600 dark:hover:text-teal-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 min-h-[44px]"
      >
        <Globe aria-hidden="true" className="h-4 w-4 text-pulse-500 shrink-0" />
        <span>{LANGUAGE_SHORT[current]}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-pulse-500 shrink-0" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Choose language"
          className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl border border-pulse-200 dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface-elevated)] shadow-lg py-1 animate-page-enter"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <li key={lang} role="none">
              <button
                type="button"
                role="option"
                aria-selected={lang === current}
                onClick={() => { void setLanguage(lang) }}
                className={[
                  'w-full text-left px-4 py-2 text-sm flex items-center gap-2 min-h-[44px]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500',
                  lang === current
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium'
                    : 'text-pulse-700 dark:text-[var(--text-secondary)] hover:bg-pulse-50 dark:hover:bg-white/5',
                ].join(' ')}
              >
                {lang === current && (
                  <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                )}
                {lang !== current && <span className="w-4 shrink-0" />}
                {LANGUAGE_LABELS[lang]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
