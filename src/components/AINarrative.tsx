import { useT } from '../i18n'

interface AINarrativeProps {
  /** Extra Tailwind classes to append to the container */
  className?: string
}

export default function AINarrative({ className = '' }: AINarrativeProps) {
  const t = useT('components')

  return (
    <section
      aria-labelledby="ai-narrative-heading"
      className={[
        'rounded-lg border border-violet-200 bg-violet-50 p-5 space-y-3',
        'shadow-card',
        'dark:bg-violet-900/20 dark:border-violet-700',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center gap-2">
        {/* Sparkle icon — decorative */}
        <svg
          aria-hidden="true"
          focusable="false"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-violet-600 dark:text-violet-400 flex-shrink-0"
        >
          <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-5.26L4 11l5.91-1.74L12 2z" />
        </svg>
        <h2
          id="ai-narrative-heading"
          className="text-body-m font-semibold text-violet-900 dark:text-violet-200"
        >
          {t('aiNarrative.title')}
        </h2>
      </div>
      <p className="text-body-s text-violet-800 dark:text-violet-300 leading-relaxed">
        {t('aiNarrative.body1')}
      </p>
      <p className="text-body-s text-violet-800 dark:text-violet-300 leading-relaxed">
        {t('aiNarrative.body2')}
      </p>
    </section>
  )
}
