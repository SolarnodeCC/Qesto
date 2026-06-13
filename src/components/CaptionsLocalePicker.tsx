/**
 * FE-CAPTIONS-OVERLAY-01 — Participant caption locale picker (S88)
 *
 * Lets a viewer choose the language they want captions displayed in.
 * Sends `captions_set_locale` over the live WebSocket on change.
 * Persists the choice to localStorage so it survives page reloads.
 *
 * Locale 'off' means the participant does not want captions.
 */

import { useCallback, useEffect } from 'react'
import { useT } from '../i18n'

// ── Types ────────────────────────────────────────────────────────────────────

export type CaptionLocale = 'en' | 'nl' | 'es' | 'de' | 'fr' | 'off'

const CAPTION_LOCALE_KEY = 'qesto:captions-locale'

export function readPersistedCaptionLocale(): CaptionLocale {
  try {
    const v = window.localStorage.getItem(CAPTION_LOCALE_KEY)
    if (v === 'en' || v === 'nl' || v === 'es' || v === 'de' || v === 'fr' || v === 'off') {
      return v
    }
  } catch {
    // storage unavailable
  }
  return 'off'
}

function persistCaptionLocale(locale: CaptionLocale): void {
  try {
    window.localStorage.setItem(CAPTION_LOCALE_KEY, locale)
  } catch {
    // storage unavailable — continue in-memory
  }
}

// ── Component props ──────────────────────────────────────────────────────────

interface CaptionsLocalePickerProps {
  /** Currently selected locale (controlled). */
  locale: CaptionLocale
  /** Called when the user picks a new locale. Parent must persist + send WS message. */
  onLocaleChange: (locale: CaptionLocale) => void
  /** Whether captions are currently active (presenter started them). */
  captionsActive: boolean
}

// ── Component ────────────────────────────────────────────────────────────────

export function CaptionsLocalePicker({ locale, onLocaleChange, captionsActive }: CaptionsLocalePickerProps) {
  const t = useT('captions')

  // Persist on change
  const handleChange = useCallback(
    (next: CaptionLocale) => {
      persistCaptionLocale(next)
      onLocaleChange(next)
    },
    [onLocaleChange],
  )

  // Restore persisted value on mount (avoids parent needing to read storage)
  useEffect(() => {
    const persisted = readPersistedCaptionLocale()
    if (persisted !== locale) {
      onLocaleChange(persisted)
    }
    // Only run once on mount — parent value may differ before storage is read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!captionsActive) return null

  const options: { value: CaptionLocale; label: string }[] = [
    { value: 'off', label: t('locale_off') },
    { value: 'en', label: t('locale_en') },
    { value: 'nl', label: t('locale_nl') },
    { value: 'es', label: t('locale_es') },
    { value: 'de', label: t('locale_de') },
    { value: 'fr', label: t('locale_fr') },
  ]

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-pulse-300 shrink-0">{t('locale_picker_label')}</span>
      <select
        value={locale}
        onChange={(e) => handleChange(e.target.value as CaptionLocale)}
        className="rounded border border-pulse-600 bg-pulse-800 text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 min-h-[36px]"
        aria-label={t('locale_picker_label')}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
