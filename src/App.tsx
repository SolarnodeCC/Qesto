import { Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useRef, lazy } from 'react'
import { LazySuspense } from './ui/lazy-suspense'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ColorSchemeProvider } from './hooks/ColorSchemeProvider'
import { HelpChatWidget } from './components/HelpChatWidget'
import { HelpChatProvider } from './hooks/useHelpChat'
import { CookieConsentBanner } from './components/CookieConsentBanner'
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
const TownhallJoin = lazy(() => import('./pages/TownhallJoin'))
const TownhallPresent = lazy(() => import('./pages/TownhallPresent'))
const TownhallDisplay = lazy(() => import('./pages/TownhallDisplay'))
const RetroJoin = lazy(() => import('./pages/RetroJoin'))
const RetroPresent = lazy(() => import('./pages/RetroPresent'))
const RetroDisplay = lazy(() => import('./pages/RetroDisplay'))
const IdeateJoin = lazy(() => import('./pages/IdeateJoin'))
const IdeatePresent = lazy(() => import('./pages/IdeatePresent'))
const EventAgendaJoin = lazy(() => import('./pages/EventAgendaJoin'))
const EventAgendaOrganizer = lazy(() => import('./pages/EventAgendaOrganizer'))
const EventStagePresent = lazy(() => import('./pages/EventStagePresent'))
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
const DeveloperPortalPage = lazy(() => import('./pages/DeveloperPortalPage'))
const PresenterRemotePage = lazy(() => import('./pages/PresenterRemotePage'))

// Use-case pages
const TeamMeetingsPage = lazy(() => import('./pages/use-cases/TeamMeetingsPage'))
const WorkshopsPage = lazy(() => import('./pages/use-cases/WorkshopsPage'))
const TrainingPage = lazy(() => import('./pages/use-cases/TrainingPage'))

// Template gallery
const TemplateGallery = lazy(() => import('./pages/TemplateGallery'))
const TemplateDetail = lazy(() => import('./pages/TemplateDetail'))

function LazyRoutePending() {
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
        <CookieConsentBanner />
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<LazySuspense pending={<LazyRoutePending />}><Privacy /></LazySuspense>} />
        <Route path="/terms" element={<LazySuspense pending={<LazyRoutePending />}><Terms /></LazySuspense>} />
        <Route path="/pricing" element={<LazySuspense pending={<LazyRoutePending />}><Pricing /></LazySuspense>} />

        {/* Solution verticals */}
        <Route path="/events" element={<LazySuspense pending={<LazyRoutePending />}><EventsPage /></LazySuspense>} />
        <Route path="/hr" element={<LazySuspense pending={<LazyRoutePending />}><HRPage /></LazySuspense>} />
        <Route path="/nonprofit" element={<LazySuspense pending={<LazyRoutePending />}><NonprofitPage /></LazySuspense>} />
        <Route path="/nonprofits" element={<LazySuspense pending={<LazyRoutePending />}><NonprofitPage /></LazySuspense>} />
        <Route path="/consulting" element={<LazySuspense pending={<LazyRoutePending />}><ConsultingPage /></LazySuspense>} />

        {/* Feature pages */}
        <Route path="/features/ai-insights" element={<LazySuspense pending={<LazyRoutePending />}><AIInsightsPage /></LazySuspense>} />
        <Route path="/features/live-polling" element={<LazySuspense pending={<LazyRoutePending />}><LivePollingPage /></LazySuspense>} />
        <Route path="/features/privacy" element={<LazySuspense pending={<LazyRoutePending />}><PrivacyFeaturePage /></LazySuspense>} />
        <Route path="/trust/gdpr" element={<LazySuspense pending={<LazyRoutePending />}><GdprTrustPage /></LazySuspense>} />
        <Route path="/trust/soc2" element={<LazySuspense pending={<LazyRoutePending />}><Soc2TrustPage /></LazySuspense>} />
        <Route path="/marketplace" element={<LazySuspense pending={<LazyRoutePending />}><MarketplacePage /></LazySuspense>} />
        <Route path="/partner/sla" element={<LazySuspense pending={<LazyRoutePending />}><PartnerSlaPage /></LazySuspense>} />
        <Route path="/developers" element={<LazySuspense pending={<LazyRoutePending />}><DeveloperPortalPage /></LazySuspense>} />

        {/* Use-case pages */}
        <Route path="/use-cases/team-meetings" element={<LazySuspense pending={<LazyRoutePending />}><TeamMeetingsPage /></LazySuspense>} />
        <Route path="/use-cases/workshops" element={<LazySuspense pending={<LazyRoutePending />}><WorkshopsPage /></LazySuspense>} />
        <Route path="/use-cases/training" element={<LazySuspense pending={<LazyRoutePending />}><TrainingPage /></LazySuspense>} />

        {/* Template gallery */}
        <Route path="/templates" element={<LazySuspense pending={<LazyRoutePending />}><TemplateGallery /></LazySuspense>} />
        <Route path="/templates/:id" element={<LazySuspense pending={<LazyRoutePending />}><TemplateDetail /></LazySuspense>} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<AccountSettings />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/sessions/:id" element={<SessionConfig />} />
        <Route path="/sessions/:id/launchpad" element={<Launchpad />} />
        <Route
          path="/sessions/:id/zoom-embed"
          element={
            <LazySuspense pending={<LazyRoutePending />}>
              <ZoomSessionEmbedPage />
            </LazySuspense>
          }
        />
        <Route path="/sessions/:id/present" element={<Present />} />
        <Route
          path="/sessions/:id/remote"
          element={
            <LazySuspense pending={<LazyRoutePending />}>
              <PresenterRemotePage />
            </LazySuspense>
          }
        />
        <Route path="/sessions/:id/results" element={<Results />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/j/:code" element={<JoinPage />} />
        <Route path="/display/:code" element={<LazySuspense pending={<LazyRoutePending />}><Display /></LazySuspense>} />
        {/* TOWNHALL (ADR-0044) — moderated anonymous Q&A */}
        <Route path="/sessions/:id/townhall" element={<LazySuspense pending={<LazyRoutePending />}><TownhallPresent /></LazySuspense>} />
        <Route path="/th/:code" element={<LazySuspense pending={<LazyRoutePending />}><TownhallJoin /></LazySuspense>} />
        <Route path="/th/:code/display" element={<LazySuspense pending={<LazyRoutePending />}><TownhallDisplay /></LazySuspense>} />
        {/* RETRO (ADR-0048) — 3-column agile retrospective */}
        <Route path="/sessions/:id/retro" element={<LazySuspense pending={<LazyRoutePending />}><RetroPresent /></LazySuspense>} />
        <Route path="/r/:code" element={<LazySuspense pending={<LazyRoutePending />}><RetroJoin /></LazySuspense>} />
        <Route path="/r/:code/display" element={<LazySuspense pending={<LazyRoutePending />}><RetroDisplay /></LazySuspense>} />
        {/* IDEATE (ADR-0048) — AI-clustered ideation board */}
        <Route path="/sessions/:id/ideate" element={<LazySuspense pending={<LazyRoutePending />}><IdeatePresent /></LazySuspense>} />
        <Route path="/i/:code" element={<LazySuspense pending={<LazyRoutePending />}><IdeateJoin /></LazySuspense>} />
        {/* STAGE (ADR-0048) — multi-track event agenda */}
        <Route path="/e/:code" element={<LazySuspense pending={<LazyRoutePending />}><EventAgendaJoin /></LazySuspense>} />
        <Route
          path="/teams/:teamId/workspaces/:wsId/event"
          element={<LazySuspense pending={<LazyRoutePending />}><EventAgendaOrganizer /></LazySuspense>}
        />
        <Route
          path="/teams/:teamId/workspaces/:wsId/present"
          element={<LazySuspense pending={<LazyRoutePending />}><EventStagePresent /></LazySuspense>}
        />
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
