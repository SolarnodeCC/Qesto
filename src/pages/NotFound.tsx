import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main id="main" className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <p className="text-6xl font-semibold text-violet-600" aria-hidden="true">404</p>
        <h1 tabIndex={-1} className="text-pulse-600 focus:outline-none">That page does not exist.</h1>
        <Link to="/" className="text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded">
          Back home
        </Link>
      </div>
    </main>
  )
}
