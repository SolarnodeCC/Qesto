import { useEffect, useRef, useState } from 'react'
import { getCurrentLanguage, setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n'

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
  const current = getCurrentLanguage() as SupportedLanguage
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
        className="inline-flex items-center gap-1.5 rounded-lg border border-pulse-200 bg-white px-2.5 py-1.5 text-sm font-medium text-pulse-700 hover:border-teal-400 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 min-h-[44px]"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-pulse-400 shrink-0">
          <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zM4.07 9a6.03 6.03 0 011.38-3.27A9.68 9.68 0 007.5 7.05V9H4.07zm0 2H7.5v1.95a9.68 9.68 0 01-2.05 1.32A6.03 6.03 0 014.07 11zm5.43 3.87V11h2.5v1.95a9.68 9.68 0 01-2.5 1.92zm2.5-5.87H9.5V7.05a9.68 9.68 0 012.5 1.9V9zm1.93-.27a9.68 9.68 0 00-2.05-1.68A6.03 6.03 0 0115.93 9h-2.03zm0 2h2.03a6.03 6.03 0 01-1.38 3.27 9.68 9.68 0 00-2.05-1.32A9.68 9.68 0 0013.93 11zm-4.43 5.87A9.68 9.68 0 017.5 14.95V13H5.45a6.03 6.03 0 004.05 3.87zM7.5 11H5.07a6.03 6.03 0 001.38 3.27A9.68 9.68 0 007.5 13v-2z" />
        </svg>
        <span>{LANGUAGE_SHORT[current]}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-pulse-400 shrink-0">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl border border-pulse-200 bg-white shadow-lg py-1 animate-page-enter"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <li key={lang} role="none">
              <button
                type="button"
                role="option"
                aria-selected={lang === current}
                onClick={() => setLanguage(lang)}
                className={[
                  'w-full text-left px-4 py-2 text-sm flex items-center gap-2 min-h-[44px]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500',
                  lang === current
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-pulse-700 hover:bg-pulse-50',
                ].join(' ')}
              >
                {lang === current && (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
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
