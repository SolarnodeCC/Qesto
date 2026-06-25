import { Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useRef, lazy } from 'react'
import { LazySuspense } from './ui/lazy-suspense'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { ColorSchemeProvider } from './hooks/ColorSchemeProvider'
import { HelpChatProvider } from './hooks/useHelpChat'
import { CookieConsentBanner } from './components/CookieConsentBanner'
import ImpersonationBanner from './components/ImpersonationBanner'
// Home is the `/` route — keep it eager so the landing LCP path never waits on a
// chunk fetch. Every other page (and the authenticated-only help widget) is lazy so
// it stays out of the critical entry chunk an anonymous visitor parses on first load.
import Home from './pages/Home'

// Core app + auth/entry pages — lazy so they load on navigation, not on `/`.
const Login = lazy(() => import('./pages/Login'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AccountSettings = lazy(() => import('./pages/AccountSettings'))
const SessionConfig = lazy(() => import('./pages/SessionConfig'))
const Launchpad = lazy(() => import('./pages/Launchpad'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const Present = lazy(() => import('./pages/Present'))
const JoinPage = lazy(() => import('./pages/JoinPage'))
const Results = lazy(() => import('./pages/Results'))
const TeamSettings = lazy(() => import('./pages/TeamSettings'))
const TeamInvite = lazy(() => import('./pages/TeamInvite'))
const ConnectJoinPage = lazy(() => import('./pages/ConnectJoinPage'))
const StudioPage = lazy(() => import('./pages/StudioPage'))
const EmbedPlayground = lazy(() => import('./pages/EmbedPlayground'))
const EmbedWidget = lazy(() => import('./pages/EmbedWidget'))
const NotFound = lazy(() => import('./pages/NotFound'))
// HelpChatWidget is a named export — adapt it to a default for React.lazy.
const HelpChatWidget = lazy(() =>
  import('./components/HelpChatWidget').then((m) => ({ default: m.HelpChatWidget })),
)

const Display = lazy(() => import('./pages/Display'))
const TownhallJoin = lazy(() => import('./pages/TownhallJoin'))
const TownhallPresent = lazy(() => import('./pages/TownhallPresent'))
const TownhallDisplay = lazy(() => import('./pages/TownhallDisplay'))
const RetroJoin = lazy(() => import('./pages/RetroJoin'))
const RetroPresent = lazy(() => import('./pages/RetroPresent'))
const RetroDisplay = lazy(() => import('./pages/RetroDisplay'))
const IdeateJoin = lazy(() => import('./pages/IdeateJoin'))
const IdeatePresent = lazy(() => import('./pages/IdeatePresent'))
const IdeateBoardPage = lazy(() => import('./pages/IdeateBoardPage'))
const DeliberateJoin = lazy(() => import('./pages/DeliberateJoin'))
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
  // Return null before touching the lazy widget so its chunk is never even fetched
  // for anonymous landing visitors. pending={null} — it's a floating button, not
  // page content, so a fallback would only add visual noise.
  if (auth.status !== 'authenticated') return null
  return (
    <LazySuspense pending={null}>
      <HelpChatWidget />
    </LazySuspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
    <ColorSchemeProvider>
      <HelpChatProvider>
        {/* Skip link is rendered by MainLayout on each page that uses it. */}
        <RouteAnnouncer />
        <ImpersonationBanner />
        <AuthenticatedHelpWidget />
        <CookieConsentBanner />
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LazySuspense pending={<LazyRoutePending />}><Login /></LazySuspense>} />
        <Route path="/reset-password" element={<LazySuspense pending={<LazyRoutePending />}><ResetPassword /></LazySuspense>} />
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

        <Route path="/dashboard" element={<LazySuspense pending={<LazyRoutePending />}><Dashboard /></LazySuspense>} />
        <Route path="/settings" element={<LazySuspense pending={<LazyRoutePending />}><AccountSettings /></LazySuspense>} />
        <Route path="/admin" element={<LazySuspense pending={<LazyRoutePending />}><AdminDashboard /></LazySuspense>} />
        <Route path="/sessions/:id" element={<LazySuspense pending={<LazyRoutePending />}><SessionConfig /></LazySuspense>} />
        <Route path="/sessions/:id/launchpad" element={<LazySuspense pending={<LazyRoutePending />}><Launchpad /></LazySuspense>} />
        <Route
          path="/sessions/:id/zoom-embed"
          element={
            <LazySuspense pending={<LazyRoutePending />}>
              <ZoomSessionEmbedPage />
            </LazySuspense>
          }
        />
        <Route path="/sessions/:id/present" element={<LazySuspense pending={<LazyRoutePending />}><Present /></LazySuspense>} />
        <Route
          path="/sessions/:id/remote"
          element={
            <LazySuspense pending={<LazyRoutePending />}>
              <PresenterRemotePage />
            </LazySuspense>
          }
        />
        <Route path="/sessions/:id/results" element={<LazySuspense pending={<LazyRoutePending />}><Results /></LazySuspense>} />
        <Route path="/join" element={<LazySuspense pending={<LazyRoutePending />}><JoinPage /></LazySuspense>} />
        <Route path="/j/:code" element={<LazySuspense pending={<LazyRoutePending />}><JoinPage /></LazySuspense>} />
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
        <Route path="/sessions/:id/ideate/board" element={<LazySuspense pending={<LazyRoutePending />}><IdeateBoardPage /></LazySuspense>} />
        <Route path="/i/:code" element={<LazySuspense pending={<LazyRoutePending />}><IdeateJoin /></LazySuspense>} />
        {/* DELIBERATE (ADR-0049) — sealed ballot commit */}
        <Route path="/d/:code" element={<LazySuspense pending={<LazyRoutePending />}><DeliberateJoin /></LazySuspense>} />
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
        <Route path="/teams/:id/settings" element={<LazySuspense pending={<LazyRoutePending />}><TeamSettings /></LazySuspense>} />
        <Route path="/teams/invite/:token" element={<LazySuspense pending={<LazyRoutePending />}><TeamInvite /></LazySuspense>} />
        <Route path="/teams/accept" element={<LazySuspense pending={<LazyRoutePending />}><TeamInvite /></LazySuspense>} />
        {/* CONNECT (ADR-0062) — federation invite join */}
        <Route path="/connect/join" element={<LazySuspense pending={<LazyRoutePending />}><ConnectJoinPage /></LazySuspense>} />
        {/* STUDIO (ADR-0060) — AI session-authoring co-pilot */}
        <Route path="/studio" element={<LazySuspense pending={<LazyRoutePending />}><StudioPage /></LazySuspense>} />
        {/* EMBED (ADR-0050) — host playground + iframe widget surface */}
        <Route path="/embed/playground" element={<LazySuspense pending={<LazyRoutePending />}><EmbedPlayground /></LazySuspense>} />
        <Route path="/embed/widget" element={<LazySuspense pending={<LazyRoutePending />}><EmbedWidget /></LazySuspense>} />
        <Route path="*" element={<LazySuspense pending={<LazyRoutePending />}><NotFound /></LazySuspense>} />
      </Routes>
      </HelpChatProvider>
    </ColorSchemeProvider>
    </AuthProvider>
  )
}
