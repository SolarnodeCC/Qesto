/**
 * DARK-MODE-GA-01 / FE-DM-TOKEN-01 — theme preference control (S71).
 */
import { useColorSchemeContext } from '../hooks/ColorSchemeProvider'
import type { ColorSchemePreference } from '../hooks/useColorScheme'
import { useT } from '../i18n'

const OPTIONS: ColorSchemePreference[] = ['system', 'light', 'dark']

export function AppearanceThemeControl() {
  const t = useT('settings')
  const { preference, setPreference } = useColorSchemeContext()

  const label: Record<ColorSchemePreference, string> = {
    system: t('appearance.themeSystem'),
    light: t('appearance.themeLight'),
    dark: t('appearance.themeDark'),
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-pulse-800 dark:text-[#A8B3CC]">{t('appearance.themeLabel')}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('appearance.themeLabel')}>
        {OPTIONS.map((option) => {
          const selected = preference === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => setPreference(option)}
              className={[
                'rounded-lg px-4 py-2 text-sm font-medium min-h-[44px] transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1',
                selected
                  ? 'bg-teal-600 text-white'
                  : 'border border-pulse-200 dark:border-[#2A3858] text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5',
              ].join(' ')}
            >
              {label[option]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
