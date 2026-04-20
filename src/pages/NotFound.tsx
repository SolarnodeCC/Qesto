import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center space-y-4">
        <p className="text-6xl font-semibold text-violet-600">404</p>
        <p className="text-pulse-600">That page does not exist.</p>
        <Link to="/" className="text-teal-600 hover:underline">
          Back home
        </Link>
      </div>
    </main>
  )
}
