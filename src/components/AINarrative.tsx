/**
 * AINarrative — a content section explaining Qesto's AI features.
 *
 * Used on the landing page and dashboard to build user trust and awareness
 * of AI-powered capabilities. Copy is kept inline (not i18n-keyed) so the
 * i18n agent can extract them separately.
 */

interface AINarrativeProps {
  /** Extra Tailwind classes to append to the container */
  className?: string
}

export default function AINarrative({ className = '' }: AINarrativeProps) {
  return (
    <section
      aria-labelledby="ai-narrative-heading"
      className={[
        'rounded-lg border border-violet-200 bg-violet-50 p-space-5 space-y-space-3',
        'shadow-card',
        'dark:bg-violet-900/20 dark:border-violet-700',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-center gap-space-2">
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
          AI-powered sessions
        </h2>
      </div>
      <p className="text-body-s text-violet-800 dark:text-violet-300 leading-relaxed">
        Qesto uses on-device AI to suggest poll questions tailored to your session goal, so you
        spend less time writing and more time engaging your audience.
      </p>
      <p className="text-body-s text-violet-800 dark:text-violet-300 leading-relaxed">
        After each session, AI analyses participant responses to surface key themes and
        follow-up insights — all processed privately on Cloudflare's edge with no
        third-party data sharing.
      </p>
    </section>
  )
}
