/**
 * SkipLink — visible only on keyboard focus, hidden by default (sr-only pattern).
 * Targets the `#main` landmark on every page so keyboard/SR users can bypass nav.
 *
 * WCAG 2.4.1 Bypass Blocks (Level A)
 */
export default function SkipLink() {
  return (
    <a
      href="#main"
      className={[
        // Visually hidden until focused
        'sr-only',
        // Reveal on focus
        'focus:not-sr-only',
        'focus:fixed',
        'focus:top-3',
        'focus:left-3',
        'focus:z-50',
        'focus:rounded-lg',
        'focus:bg-teal-600',
        'focus:px-4',
        'focus:py-2.5',
        'focus:text-white',
        'focus:text-sm',
        'focus:font-medium',
        'focus:shadow-lg',
        'focus:ring-2',
        'focus:ring-teal-500',
        'focus:ring-offset-2',
        'focus:outline-none',
      ].join(' ')}
    >
      Skip to main content
    </a>
  )
}
