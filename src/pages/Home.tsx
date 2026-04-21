import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import MainLayout from '../layouts/MainLayout'

export default function Home() {
  const auth = useAuth()

  const navSlot = (
    <>
      {auth.status === 'authenticated' ? (
        <button
          type="button"
          onClick={() => void auth.logout()}
          className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
        >
          Sign out
        </button>
      ) : auth.status === 'anonymous' ? (
        <Link
          to="/login"
          className="text-sm font-medium text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
        >
          Sign in
        </Link>
      ) : null}
    </>
  )

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-xl space-y-6">
        <h1 tabIndex={-1} className="text-4xl md:text-6xl font-semibold bg-gradient-to-br from-teal-500 to-violet-600 bg-clip-text text-transparent focus:outline-none">
          Feel the pulse of the room — AI amplifies it.
        </h1>
        <p className="text-lg text-pulse-600">
          Real-time interactive sessions on Cloudflare&rsquo;s edge.
        </p>
        <div className="flex items-center justify-center gap-3">
          {auth.status === 'authenticated' ? (
            <div className="flex flex-col items-center gap-2">
              <Link
                to="/dashboard"
                className="inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-5 py-2.5 font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                Go to dashboard
              </Link>
              <span className="text-xs text-pulse-500">
                Signed in as <strong>{auth.user.email}</strong>.
              </span>
            </div>
          ) : auth.status === 'loading' ? (
            <span className="text-sm text-pulse-500">Loading…</span>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-5 py-2.5 font-medium hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
