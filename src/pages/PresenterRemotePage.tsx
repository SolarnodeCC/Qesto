/**
 * MOBILE-PRESENTER-REMOTE-01 — lightweight presenter controls for mobile.
 */
import { useParams, Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'

export default function PresenterRemotePage() {
  const { id } = useParams<{ id: string }>()
  return (
    <MainLayout>
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-pulse-900 dark:text-[var(--text-primary)]">Presenter remote</h1>
        <p className="text-sm text-pulse-600 dark:text-[var(--text-muted)]">
          Control your live session from a second device. Session {id ?? '—'}.
        </p>
        <div className="grid gap-3">
          <Link
            to={id ? `/sessions/${id}/present` : '/dashboard'}
            className="rounded-lg bg-teal-600 px-4 py-3 text-center text-white font-medium"
          >
            Open presenter view
          </Link>
          <Link
            to={id ? `/sessions/${id}/launchpad` : '/dashboard'}
            className="rounded-lg border border-pulse-200 dark:border-[var(--color-border-strong)] px-4 py-3 text-center text-pulse-800 dark:text-[var(--text-primary)]"
          >
            Launchpad
          </Link>
        </div>
        <section aria-label="Q&A queue" className="rounded-lg border border-pulse-200 dark:border-[var(--color-border)] p-4">
          <h2 className="text-sm font-semibold text-pulse-900 dark:text-[var(--text-primary)]">Q&A queue</h2>
          <p className="mt-2 text-xs text-pulse-500 dark:text-[var(--text-muted)]">Moderation UI ships in host console; remote shows live link only (S75).</p>
        </section>
      </div>
    </MainLayout>
  )
}
