/**
 * CANVAS-THEME-01 — CanvasThemePicker (S88)
 *
 * Compact theme selector for the presenter control bar.
 * Reads/writes via useCanvasTheme() — must be rendered inside CanvasThemeProvider.
 *
 * a11y: keyboard-accessible listbox pattern with visible focus ring.
 */
import { useCanvasTheme, CANVAS_THEMES, type CanvasTheme } from '../hooks/useCanvasTheme'

const THEME_LABELS: Record<CanvasTheme, string> = {
  default:        'Default',
  dark:           'Dark',
  'high-contrast': 'High contrast',
  'brand-neutral': 'Brand neutral',
}

/** Swatch colours map the --canvas-bg of each theme for visual preview. */
const THEME_SWATCH_BG: Record<CanvasTheme, string> = {
  default:        '#FFFFFF',
  dark:           'var(--color-bg-subtle)',
  'high-contrast': '#FFFFFF',
  'brand-neutral': '#1C243A',
}
const THEME_SWATCH_BORDER: Record<CanvasTheme, string> = {
  default:        '#E5E5E5',
  dark:           'var(--color-border-strong)',
  'high-contrast': '#000000',
  'brand-neutral': '#2E3A56',
}
const THEME_SWATCH_DOT: Record<CanvasTheme, string> = {
  default:        '#0F766E',
  dark:           '#2DD4BF',
  'high-contrast': '#005C5C',
  'brand-neutral': '#34D399',
}

interface CanvasThemePickerProps {
  /** Visual variant — 'bar' for the presenter control strip, 'menu' for a standalone popover */
  variant?: 'bar' | 'menu'
}

export function CanvasThemePicker({ variant = 'bar' }: CanvasThemePickerProps) {
  const { theme, setTheme } = useCanvasTheme()

  const isBar = variant === 'bar'

  return (
    <div
      role="radiogroup"
      aria-label="Canvas theme"
      className={
        isBar
          ? 'flex items-center gap-1'
          : 'flex flex-wrap gap-2 p-2'
      }
    >
      {CANVAS_THEMES.map((t) => {
        const selected = t === theme
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(t)}
            title={THEME_LABELS[t]}
            aria-label={`Canvas theme: ${THEME_LABELS[t]}${selected ? ' (selected)' : ''}`}
            className={[
              'inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium min-h-[36px]',
              'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
              isBar
                ? selected
                  ? 'bg-teal-600 text-white'
                  : 'bg-pulse-700 text-white hover:bg-pulse-600'
                : selected
                  ? 'bg-teal-100 text-teal-800 border border-teal-400 dark:bg-teal-900 dark:text-teal-200 dark:border-teal-600'
                  : 'bg-pulse-100 text-pulse-700 border border-pulse-300 hover:border-teal-400 dark:bg-[var(--color-surface-elevated)] dark:text-[var(--text-secondary)] dark:border-[var(--color-border-strong)] dark:hover:border-teal-600',
            ].join(' ')}
          >
            {/* Colour swatch */}
            <span
              aria-hidden="true"
              className="w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center"
              style={{
                background: THEME_SWATCH_BG[t],
                borderColor: THEME_SWATCH_BORDER[t],
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: THEME_SWATCH_DOT[t] }}
              />
            </span>
            {!isBar && <span>{THEME_LABELS[t]}</span>}
          </button>
        )
      })}
    </div>
  )
}
