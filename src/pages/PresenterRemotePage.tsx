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
        <h1 className="text-2xl font-bold text-pulse-900 dark:text-[#F0F2F8]">Presenter remote</h1>
        <p className="text-sm text-pulse-600 dark:text-[#9AA8C7]">
          Control your live session from a second device. Session {id ?? '—'}.
        </p>
        <div className="grid gap-3">
          <Link
            to={id ? `/present/${id}` : '/dashboard'}
            className="rounded-lg bg-teal-600 px-4 py-3 text-center text-white font-medium"
          >
            Open presenter view
          </Link>
          <Link
            to={id ? `/sessions/${id}/launchpad` : '/dashboard'}
            className="rounded-lg border border-pulse-200 px-4 py-3 text-center text-pulse-800 dark:text-[#F0F2F8]"
          >
            Launchpad
          </Link>
        </div>
      </div>
    </MainLayout>
  )
}
