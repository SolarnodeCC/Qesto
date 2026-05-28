import { Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useRef, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ColorSchemeProvider } from './hooks/ColorSchemeProvider'
import { HelpChatWidget } from './components/HelpChatWidget'
import { HelpChatProvider } from './hooks/useHelpChat'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AccountSettings from './pages/AccountSettings'
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

const Display = lazy(() => import('./pages/Display'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const Pricing = lazy(() => import('./pages/Pricing'))

// Solution verticals
const EventsPage = lazy(() => import('./pages/solutions/EventsPage'))
const HRPage = lazy(() => import('./pages/solutions/HRPage'))
const NonprofitPage = lazy(() => import('./pages/solutions/NonprofitPage'))
const ConsultingPage = lazy(() => import('./pages/solutions/ConsultingPage'))

// Feature pages
const AIInsightsPage = lazy(() => import('./pages/features/AIInsightsPage'))
const LivePollingPage = lazy(() => import('./pages/features/LivePollingPage'))
const PrivacyFeaturePage = lazy(() => import('./pages/features/PrivacyFeaturePage'))
const GdprTrustPage = lazy(() => import('./pages/GdprTrustPage'))
const Soc2TrustPage = lazy(() => import('./pages/Soc2TrustPage'))
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'))
const PartnerSlaPage = lazy(() => import('./pages/PartnerSlaPage'))
const ZoomSessionEmbedPage = lazy(() => import('./pages/ZoomSessionEmbedPage'))

// Use-case pages
const TeamMeetingsPage = lazy(() => import('./pages/use-cases/TeamMeetingsPage'))
const WorkshopsPage = lazy(() => import('./pages/use-cases/WorkshopsPage'))
const TrainingPage = lazy(() => import('./pages/use-cases/TrainingPage'))

// Template gallery
const TemplateGallery = lazy(() => import('./pages/TemplateGallery'))
const TemplateDetail = lazy(() => import('./pages/TemplateDetail'))

function LazyRouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[30vh] flex items-center justify-center text-sm text-pulse-500"
    >
      Loading page...
    </div>
  )
}

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

function AuthenticatedHelpWidget() {
  const auth = useAuth()
  if (auth.status !== 'authenticated') return null
  return <HelpChatWidget />
}

export default function App() {
  return (
    <ColorSchemeProvider>
    <AuthProvider>
      <HelpChatProvider>
        {/* Skip link is rendered by MainLayout on each page that uses it. */}
        <RouteAnnouncer />
        <AuthenticatedHelpWidget />
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<Suspense fallback={<LazyRouteFallback />}><Privacy /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<LazyRouteFallback />}><Terms /></Suspense>} />
        <Route path="/pricing" element={<Suspense fallback={<LazyRouteFallback />}><Pricing /></Suspense>} />

        {/* Solution verticals */}
        <Route path="/events" element={<Suspense fallback={<LazyRouteFallback />}><EventsPage /></Suspense>} />
        <Route path="/hr" element={<Suspense fallback={<LazyRouteFallback />}><HRPage /></Suspense>} />
        <Route path="/nonprofit" element={<Suspense fallback={<LazyRouteFallback />}><NonprofitPage /></Suspense>} />
        <Route path="/nonprofits" element={<Suspense fallback={<LazyRouteFallback />}><NonprofitPage /></Suspense>} />
        <Route path="/consulting" element={<Suspense fallback={<LazyRouteFallback />}><ConsultingPage /></Suspense>} />

        {/* Feature pages */}
        <Route path="/features/ai-insights" element={<Suspense fallback={<LazyRouteFallback />}><AIInsightsPage /></Suspense>} />
        <Route path="/features/live-polling" element={<Suspense fallback={<LazyRouteFallback />}><LivePollingPage /></Suspense>} />
        <Route path="/features/privacy" element={<Suspense fallback={<LazyRouteFallback />}><PrivacyFeaturePage /></Suspense>} />
        <Route path="/trust/gdpr" element={<Suspense fallback={<LazyRouteFallback />}><GdprTrustPage /></Suspense>} />
        <Route path="/trust/soc2" element={<Suspense fallback={<LazyRouteFallback />}><Soc2TrustPage /></Suspense>} />
        <Route path="/marketplace" element={<Suspense fallback={<LazyRouteFallback />}><MarketplacePage /></Suspense>} />
        <Route path="/partner/sla" element={<Suspense fallback={<LazyRouteFallback />}><PartnerSlaPage /></Suspense>} />

        {/* Use-case pages */}
        <Route path="/use-cases/team-meetings" element={<Suspense fallback={<LazyRouteFallback />}><TeamMeetingsPage /></Suspense>} />
        <Route path="/use-cases/workshops" element={<Suspense fallback={<LazyRouteFallback />}><WorkshopsPage /></Suspense>} />
        <Route path="/use-cases/training" element={<Suspense fallback={<LazyRouteFallback />}><TrainingPage /></Suspense>} />

        {/* Template gallery */}
        <Route path="/templates" element={<Suspense fallback={<LazyRouteFallback />}><TemplateGallery /></Suspense>} />
        <Route path="/templates/:id" element={<Suspense fallback={<LazyRouteFallback />}><TemplateDetail /></Suspense>} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/sessions/:id" element={<SessionConfig />} />
        <Route path="/sessions/:id/launchpad" element={<Launchpad />} />
        <Route
          path="/sessions/:id/zoom-embed"
          element={
            <Suspense fallback={<LazyRouteFallback />}>
              <ZoomSessionEmbedPage />
            </Suspense>
          }
        />
        <Route path="/sessions/:id/present" element={<Present />} />
        <Route path="/sessions/:id/results" element={<Results />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/j/:code" element={<JoinPage />} />
        <Route path="/display/:code" element={<Suspense fallback={<LazyRouteFallback />}><Display /></Suspense>} />
        <Route path="/teams/:id/settings" element={<TeamSettings />} />
        <Route path="/teams/invite/:token" element={<TeamInvite />} />
        <Route path="/teams/accept" element={<TeamInvite />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </HelpChatProvider>
    </AuthProvider>
    </ColorSchemeProvider>
  )
}
