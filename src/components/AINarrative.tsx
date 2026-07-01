import { Sparkles } from 'lucide-react'
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
        <Sparkles
          aria-hidden="true"
          focusable={false}
          size={20}
          className="text-violet-600 dark:text-violet-400 flex-shrink-0"
        />
        <h2
          id="ai-narrative-heading"
          className="body-m font-semibold text-violet-900 dark:text-violet-200"
        >
          {t('aiNarrative.title')}
        </h2>
      </div>
      <p className="body-s text-violet-800 dark:text-violet-300 leading-relaxed">
        {t('aiNarrative.body1')}
      </p>
      <p className="body-s text-violet-800 dark:text-violet-300 leading-relaxed">
        {t('aiNarrative.body2')}
      </p>
    </section>
  )
}
