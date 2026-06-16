/**
 * FE-AAA-CONTRAST-01 — high contrast mode toggle (S78).
 */
import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { loadUserPreferences, patchUserPreference } from '../lib/user-preferences'
import { useAuth } from '../hooks/useAuth'

const KEY = 'qesto:high-contrast'

export function HighContrastToggle() {
  const t = useT('settings')
  const auth = useAuth()
  const [on, setOn] = useState(() => typeof window !== 'undefined' && localStorage.getItem(KEY) === '1')

  useEffect(() => {
    document.documentElement.dataset.highContrast = on ? 'true' : 'false'
    localStorage.setItem(KEY, on ? '1' : '0')
  }, [on])

  // Hydrate from server prefs once auth is known (HttpOnly cookie via credentials).
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    loadUserPreferences().then((prefs) => {
      if (typeof prefs.highContrast === 'boolean') setOn(prefs.highContrast)
    })
  }, [auth.status])

  function toggle() {
    setOn((prev) => {
      const next = !prev
      patchUserPreference({ highContrast: next })
      return next
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-pulse-800 dark:text-[#A8B3CC]">{t('appearance.highContrastLabel')}</p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t('appearance.highContrastLabel')}
        onClick={toggle}
        className={[
          'rounded-lg px-4 py-2 text-sm font-medium min-h-[44px] transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
          on
            ? 'bg-teal-600 text-white'
            : 'border border-pulse-200 dark:border-[#2A3858] text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5',
        ].join(' ')}
      >
        {on ? t('appearance.highContrastOn') : t('appearance.highContrastOff')}
      </button>
    </div>
  )
}
