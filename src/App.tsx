import { Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useRef, lazy, Suspense } from 'react'
import { AuthProvider } from './hooks/useAuth'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SessionConfig from './pages/SessionConfig'
import Launchpad from './pages/Launchpad'
import AdminDashboard from './pages/AdminDashboard'
import Present from './pages/Present'
import JoinPage from './pages/JoinPage'
import Results from './pages/Results'
import NotFound from './pages/NotFound'
import ResetPassword from './pages/ResetPassword'
import TeamSettings from './pages/TeamSettings'
import TeamInvite from './pages/TeamInvite'

const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const Pricing = lazy(() => import('./pages/Pricing'))

function RouteAnnouncer() {
  const location = useLocation()
  const h1Ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    // Move focus to the first h1 on route change so keyboard/SR users land at page top
    const h1 = document.querySelector<HTMLElement>('h1[tabindex="-1"]')
    if (h1) {
      h1Ref.current = h1
      h1.focus()
    }
  }, [location.pathname])

  return null
}

export default function App() {
  return (
    <AuthProvider>
      {/* Skip link is rendered by MainLayout on each page that uses it. */}
      <RouteAnnouncer />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<Suspense fallback={<div>Loading...</div>}><Privacy /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<div>Loading...</div>}><Terms /></Suspense>} />
        <Route path="/pricing" element={<Suspense fallback={<div>Loading...</div>}><Pricing /></Suspense>} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/sessions/:id" element={<SessionConfig />} />
        <Route path="/sessions/:id/launchpad" element={<Launchpad />} />
        <Route path="/sessions/:id/present" element={<Present />} />
        <Route path="/sessions/:id/results" element={<Results />} />
        <Route path="/j/:code" element={<JoinPage />} />
        <Route path="/teams/:id/settings" element={<TeamSettings />} />
        <Route path="/teams/invite/:token" element={<TeamInvite />} />
        <Route path="/teams/accept" element={<TeamInvite />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
