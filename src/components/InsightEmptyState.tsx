import { Link } from 'react-router-dom'

export default function InsightEmptyState({ onCreateSession }: { onCreateSession: () => void }) {
  return (
    <div className="space-y-8 py-12">
      <div className="text-center space-y-4">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
            <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-600 dark:text-teal-400">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h2 className="text-xl font-semibold text-pulse-900 dark:text-pulse-100">
          No insights yet
        </h2>

        {/* Subheading */}
        <p className="text-sm text-pulse-600 dark:text-pulse-400 max-w-sm mx-auto">
          AI-generated insights surface themes and patterns from your closed sessions. Create and close a session to get started.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={onCreateSession}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create session
          </button>

          <Link
            to="/dashboard?tab=sessions"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-pulse-300 bg-white dark:bg-pulse-800 dark:border-pulse-600 text-pulse-700 dark:text-pulse-300 px-4 py-2.5 text-sm font-medium hover:bg-pulse-50 dark:hover:bg-pulse-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 transition-colors"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 9l3 3m0 0l-3 3m3-3H8m13-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Browse sessions
          </Link>
        </div>
      </div>
    </div>
  )
}
