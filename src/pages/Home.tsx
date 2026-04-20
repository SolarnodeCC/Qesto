import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Home() {
  const auth = useAuth()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-xl space-y-6">
        <p className="text-sm uppercase tracking-widest text-teal-600">Qesto</p>
        <h1 className="text-4xl md:text-6xl font-semibold bg-gradient-to-br from-teal-500 to-violet-600 bg-clip-text text-transparent">
          Feel the pulse of the room — AI amplifies it.
        </h1>
        <p className="text-lg text-pulse-600">
          Real-time interactive sessions on Cloudflare&rsquo;s edge.
        </p>
        <div className="flex items-center justify-center gap-3">
          {auth.status === 'authenticated' ? (
            <span className="text-sm text-pulse-600">
              Signed in as <strong>{auth.user.email}</strong>.
              <button
                type="button"
                onClick={() => void auth.logout()}
                className="ml-2 text-teal-600 hover:underline"
              >
                Sign out
              </button>
            </span>
          ) : auth.status === 'loading' ? (
            <span className="text-sm text-pulse-500">Loading…</span>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-5 py-2.5 font-medium hover:brightness-110"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
