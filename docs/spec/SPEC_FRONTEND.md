# SPEC_FRONTEND — React Architecture, Routing, Hooks, Components

## Doc contract
Route + hook tables = **UI navigation**; **code (`src/`)** wins on prop names until spec PR merges.

## Readers (multi-lens · **Architect** = **Primary** for surfaces)

| Role | Use this doc to… |
|------|------------------|
| **Architect** | **Primary** — public **vote/present/join** vs gated **dashboard/admin**; i18n/a11y as system bars. |
| **Backend Developer** | Page → **REST path** map (see [[SPEC_BACKEND.md]]); WS client → [[SPEC_REALTIME.md]]. |
| **Frontend Developer** | **Lead** — `App.tsx` routes, hooks (`useAuth`, `useSession`, …), lazy chunks. |
| **UI specialist** | **Lead** — `src/ui/tokens`, motion, charts, energizers; loading/empty/error parity. |
| **Cloudflare specialist** | Static asset path + cache hints; link out to [[SPEC_DEPLOYMENT.md]] for CDN/Pages. |
| **API & middleware specialist** | Presenter `Sec-WebSocket-Protocol`; typed `error` envelope in API client. |

## Overview
Qesto frontend is **React 18 + Vite** with TypeScript, Tailwind CSS, and real-time WebSocket via `useSession` hook. Architecture: pages (routing) → components (UI) → hooks (state) → lib (utilities).

---

## Routes & Pages

All routes in `src/App.tsx` via React Router v6. Protected routes use `<ProtectedRoute>` wrapper.

| Path | Component | Protected | Purpose | Auth Required |
|------|-----------|-----------|---------|---|
| `/` | `Home.tsx` | No | Landing page | — |
| `/login` | `Login.tsx` | No | Magic link + password | — |
| `/auth/callback` | `AuthCallback.tsx` | No | Magic link handler | — |
| `/auth/sso/callback` | `SSOCallback.tsx` | No | OAuth callback (Microsoft, Google) | — |
| `/password/reset` | `ResetPassword.tsx` | No | Password reset flow | — |
| `/pricing` | `Pricing.tsx` | No | Pricing page | — |
| `/terms` | `TermsOfConditions.tsx` | No | Legal | — |
| `/solutions/*` | `SolutionsPage.tsx` | No | Industry scenarios | — |
| **Authenticated Pages** |
| `/dashboard` | `Dashboard.tsx` | Yes | User hub (sessions, templates, teams) | JWT |
| `/session/:id/config` | `SessionConfig.tsx` | Yes | Edit session settings (DRAFT only) | JWT + owner |
| `/ai-creator` | `AICreator.tsx` | Yes | AI question generator | JWT |
| `/decisions/search` | `DecisionsSearch.tsx` | Yes | Decision history search | JWT |
| `/billing/*` | `BillingAccount.tsx` | Yes | Subscription management | JWT |
| `/teams/:id/audit` | `ComplianceAudit.tsx` | Yes | Team audit logs | JWT + team member |
| `/admin/*` | `AdminPanel.tsx` | Yes | Admin dashboard | JWT + admin role |
| **Session Pages (Public)** |
| `/present/:sessionId` | `Present.tsx` | No | Presenter view (full-screen) | — |
| `/vote/:sessionId` | `Vote.tsx` | No | Participant voting | — |
| `/remote/:sessionId` | `Remote.tsx` | No | Mobile remote control | — |
| `/sessions/:id/results` | `SessionResults.tsx` | No | Results (presenter only in JS) | — |
| `/sessions/:id/results/public` | `PublicResults.tsx` | No | Shareable results link | — |
| `/j/:code` | `JoinRedirect.tsx` | No | Short link → `/join/:code` | — |
| `/join/:code` | `JoinPage.tsx` | No | Full join flow | — |
| `/invite/:code` | `GuestJoin.tsx` | No | Guest invitation | — |
| `/team/accept` | `TeamAccept.tsx` | No | Team invite acceptance | — |
| **Admin Pages** |
| `/admin/dashboard` | `AdminDashboard.tsx` | Yes | KPIs, overview | Admin |
| `/admin/analytics` | `AdminAnalytics.tsx` | Yes | Usage analytics | Admin |
| `/admin/users` | `AdminUsers.tsx` | Yes | User management | Admin |
| `/admin/audit` | `AdminAudit.tsx` | Yes | Audit trails | Admin |
| `/admin/issues` | `AdminIssues.tsx` | Yes | Error tracking | Admin |
| `/admin/ops` | `AdminOps.tsx` | Yes | System status | Admin |
| `/admin/alerts` | `AdminAlertRules.tsx` | Yes | Alert configuration | Admin |

---

## Component Hierarchy

### Core Layout
```
App.tsx (Router)
├── ErrorBoundary
├── AuthProvider (useAuth context)
├── SessionProvider? (useSession context for LIVE pages)
└── Routes
    ├── Public Routes (no auth)
    │   ├── Home, Login, Pricing, etc.
    │   └── Unprotected session pages (Present, Vote, Results)
    │
    └── Protected Routes
        ├── ProtectedRoute wrapper (checks JWT)
        └── Authenticated pages (Dashboard, Config, Billing, Admin)
```

### Page Components (src/pages/)

```
pages/
├── Home.tsx                    Landing page
├── Login.tsx                   Auth entry point
├── AuthCallback.tsx            Magic link handler
├── SSOCallback.tsx             OAuth handler
├── Dashboard.tsx               Main hub (protected)
│   ├── SessionsTab.tsx         User's sessions list
│   ├── TemplatesTab.tsx        Saved templates
│   └── TeamsTab.tsx            Team management
├── SessionConfig.tsx           Edit draft session (protected)
├── AdminPanel.tsx              Admin router (protected)
│   ├── AdminDashboard.tsx      KPIs dashboard
│   ├── AdminUsers.tsx          User management
│   ├── AdminAnalytics.tsx      Usage analytics
│   ├── AdminAudit.tsx          Audit trails
│   ├── AdminIssues.tsx         Error tracking
│   ├── AdminOps.tsx            System status
│   ├── AdminAlertRules.tsx     Alert rules
│   └── AdminSidebar.tsx        Navigation
├── present/
│   ├── Present.tsx             Main presenter entry
│   ├── PresenterActive.tsx     Core presenter UI (35KB)
│   ├── QuestionBuilder.tsx     Question editor
│   ├── SessionHeader.tsx       Timer, participant count
│   ├── QuestionSidebar.tsx     Question navigator
│   ├── ResultDisplay.tsx       Results visualization
│   ├── PostSessionScreen.tsx   After-session wrap-up
│   ├── AccessibleModal.tsx     A11y modal
│   └── types.ts                Types for presenter
├── Vote.tsx                    Participant voting interface
├── Remote.tsx                  Mobile remote
├── SessionResults.tsx          Results view (presenter)
├── PublicResults.tsx           Shareable results
├── JoinRedirect.tsx            Code → full URL
├── JoinPage.tsx                Full join flow
├── GuestJoin.tsx               Guest invitation
├── TeamAccept.tsx              Team invite acceptance
├── scenarios/
│   ├── TopicScenarioPages.tsx  Industry scenarios
│   ├── ScenarioDetailPage.tsx  Scenario detail
│   └── education/
│       ├── AssessmentsScenarioPage.tsx
│       └── SeminarsScenarioPage.tsx
└── Debug.tsx                   Dev-only debug panel
```

### Reusable Components (src/components/)

```
components/
├── TopBar.tsx                  Authenticated header
├── LanguageSelector.tsx        i18n switcher
├── ErrorBoundary.tsx           React error fallback
├── ErrorAlert.tsx              Error toast
├── Leaderboard.tsx             Ranking display
├── AchievementBadges.tsx       Badge renderer
├── InsightsPanel.tsx           Analytics widget
├── TrendsChart.tsx             Time-series chart
├── WordCloud.tsx               Tag cloud from responses
├── Accessibility.tsx           A11y feature panel
├── BrandingPreview.tsx         Theme preview
├── ConsentVote.tsx             Consent voting UI
├── RankingVote.tsx             Ranking interface
├── EnergieMeter.tsx            Engagement gauge
├── UpgradeModal.tsx            Plan upgrade dialog
├── SetPasswordModal.tsx        Password setup
├── LatexText.tsx               LaTeX equation renderer
├── WaitingPulse.tsx            Loading pulse animation
├── DebugChip.tsx               Dev debug widget
├── ui.tsx                      Misc UI helpers (Badge, Timer, etc.)
└── energizers/                 Gamification components
    ├── BalloonPop.tsx          Pop bubbles game
    ├── EmojiPulse.tsx          Emoji reaction visualizer
    ├── ThisOrThat.tsx          Binary choice
    ├── StandUpIf.tsx           Physical engagement
    ├── SpeedRound.tsx          Timed quiz (11KB)
    ├── TugOfWar.tsx            Team pulling game
    ├── FindYourMatch.tsx       Matching game
    ├── CommonGround.tsx        Shared preferences
    ├── WoordassociatieBattle.tsx  Word association
    └── index.ts                Energizer registry
```

### Design System (src/ui/)

```
ui/
├── tokens.ts                   Color palette, animations
├── primitives.tsx              Base components (Logo, Badge, Timer)
└── charts.tsx                  Chart components (Bar, Line, Pie)
```

---

## Hooks API

### useAuth (Authentication)
**File**: `src/hooks/useAuth.tsx`

```typescript
interface AuthContext {
  // State
  user: User | null
  plan: UserPlan | null
  token: string | null
  loading: boolean
  hasPassword: boolean
  adminRole: AdminRole | null
  
  // Methods
  requestLink(email: string): Promise<{ok: boolean, error?: string}>
  loginWithPassword(email: string, password: string): Promise<{ok, error?}>
  signup(email: string, password: string, name: string): Promise<{ok, error?}>
  setPassword(password: string): Promise<{ok, error?}>
  logout(): Promise<void>
  updateName(name: string): Promise<void>
  updateLang(lang: 'en'|'nl'|'de'|'fr'|'es'): Promise<void>
  refreshPlan(): Promise<void>
  
  // Helpers
  authHeader(): Record<string, string>
}

// Usage
const { user, token, requestLink, logout } = useAuth()
```

**Responsibilities**:
- JWT token management (load from localStorage, validate on page load)
- User profile + plan caching
- Magic link + password flows
- OAuth/SAML redirect handling
- Admin role detection

---

### useSession (Live WebSocket State)
**File**: `src/hooks/useSession.ts`

```typescript
type Action = 
  | {type: 'INIT', session: SessionState}
  | {type: 'QUESTION', question: Question, index: number, total: number}
  | {type: 'RESULTS', results: Record<string, number>, total: number}
  | {type: 'PARTICIPANTS', count: number, voterNames?: string[]}
  | {type: 'VOTED'}
  | {type: 'TIMER_START', endsAt: number, total: number}
  | {type: 'LOCKED_CHANGED', locked: boolean}
  | {type: 'TEAM_STATE', teams: string[], colors: Record<string, string>, scores: Record<string, number>}
  | {type: 'SPEED_ROUND_INIT', questions: Question[]}
  | {type: 'SPEED_ROUND_RESULTS', scores: Record<string, number>}
  | {type: 'EMOJI_PING', emoji: string, count: number}
  // ... 15+ more actions

interface LiveState {
  // Session
  session: SessionState | null
  question: Question | null
  questionIndex: number
  questionTotal: number
  status: 'waiting' | 'active' | 'results' | 'closed'
  
  // Results
  results: Record<string, number>
  resultTotal: number
  rawAnswers: Record<string, string>  // For wordcloud
  
  // Participants
  participants: number
  hasVoted: boolean
  voterNames: string[]
  
  // Timer
  timer: {endsAt: number, total: number} | null
  timerExpired: boolean
  
  // Config
  locked: boolean
  anonymityMode: AnonymityMode
  allowMultipleVotes: boolean
  
  // Special modes
  speedRoundScores?: Record<string, {voterId: string, name?: string, points: number}>
  teamState?: {teams: string[], colors: Record<string, string>, scores: Record<string, number>}
  emojiPings: {emoji: string, count: number, timestamp: number}[]
}

function useSession(sessionId: string): {
  state: LiveState
  dispatch: (action: Action) => void
  send: (msg: ClientMessage) => void
  ws: WebSocket | null
  connected: boolean
  error: string | null
}

// Usage
const { state, send, connected } = useSession(sessionId)
if (state.question) {
  // Render question
  // On user vote: send({type: 'vote', data: {questionId, selectedIndex}})
}
```

**Responsibilities**:
- WebSocket connection management (open, reconnect, close)
- Reducer for complex state updates
- Message serialization/deserialization
- Deduplication & error recovery

---

### usePlan (Billing & Features)
**File**: `src/hooks/usePlan.ts`

```typescript
interface PlanInfo {
  planId: 'free' | 'starter' | 'team' | 'enterprise'
  sessionsPerMonth: number
  maxParticipants: number
  features: string[]  // ['integrations', 'ai', 'sso']
  currentPeriodEnd?: number
  cancelAtPeriodEnd?: boolean
}

function usePlan(): {
  plan: PlanInfo | null
  loading: boolean
  canUseFeature(feature: string): boolean
  remainingSessions(): number
}

// Usage
const { plan, canUseFeature } = usePlan()
if (!canUseFeature('integrations')) {
  return <UpgradePrompt />
}
```

---

### usePlanGate (Feature Gates)
**File**: `src/hooks/usePlanGate.ts`

```typescript
function usePlanGate(feature: string): {
  allowed: boolean
  reason?: string  // e.g., "Free plan: upgrade to use Slack"
  upgrade(): Promise<void>
}

// Usage
const { allowed, upgrade } = usePlanGate('slack-integration')
if (!allowed) {
  return <button onClick={upgrade}>Upgrade to use Slack</button>
}
```

---

### useInsights (Analytics)
**File**: `src/hooks/useInsights.ts`

```typescript
interface SessionInsights {
  questionCount: number
  participantCount: number
  averageResponseTime: number  // ms
  consensusRate: number         // 0-1
  topAnswers: {option: string, count: number, percentage: number}[]
  engagementScore: number       // 0-100
}

function useInsights(sessionId: string): {
  insights: SessionInsights | null
  loading: boolean
}
```

---

### useColorScheme (Dark Mode)
**File**: `src/hooks/useColorScheme.ts`

```typescript
function useColorScheme(): {
  scheme: 'light' | 'dark'
  toggle(): void
  syncToDOM(): void
}

// Usage
const { scheme, toggle } = useColorScheme()
```

---

## Design System (Tokens)

**File**: `src/ui/tokens.ts`

```typescript
// Colors
export const C = {
  // Primary: Teal
  teal600: '#0D9488', teal500: '#14B8A6', teal400: '#2DD4BF', teal300: '#5EEAD4',
  
  // Accent: Violet
  violet600: '#7C3AED', violet500: '#8B5CF6', violet400: '#A78BFA',
  
  // Semantic
  coral600: '#DC2626',      // error
  amber500: '#F59E0B',      // warning
  green: '#22C55E',         // success
  sky500: '#0EA5E9',        // info
  
  // Neutrals (pulse scale)
  pulse50: '#FAFAFA', pulse100: '#F5F5F5', ..., pulse900: '#0A0F1E',
}

// Gradients
export const GRAD = 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)'
export const GRAD_SUBTLE = 'linear-gradient(135deg, #F0FDFA 0%, #F5F3FF 100%)'

// Shadows
export const SHADOW_TEAL = '0 4px 20px rgba(20,184,166,0.25)'
export const BAR_COLORS = ['#14B8A6', '#8B5CF6', '#0EA5E9', '#2DD4BF']

// Typography
export const FONT = {
  display: 'Syne, sans-serif',
  body: 'DM Sans, sans-serif',
  mono: 'DM Mono, monospace',
}

// Animations (Tailwind custom)
export const ANIMATIONS = {
  breathe: 'breathe 2s ease-in-out infinite',
  pulse: 'pulse 2s ease-in-out infinite',
  blink: 'blink 1s ease-in-out infinite',
}
```

---

## WebSocket Protocol

**Connection**: `wss://qesto.com/api/sessions/:sessionId/ws`

**Subprotocol Authentication** (presenter):
```
Sec-WebSocket-Protocol: qesto.bearer.${jwt}
```

**Message Types** (from & to server):

### ClientMessage (voter/presenter → server)
```typescript
interface ClientMessage {
  type: 'vote' | 'feedback' | 'emoji' | 'name' | 'advance' | 'lock' | 'timer_start' | 'timer_cancel' | ...
  data: Record<string, any>
  timestamp: number
}

// Examples
{type: 'vote', data: {questionId: 'q1', selectedIndex: 2}, timestamp: 1712000000000}
{type: 'emoji', data: {emoji: '👍'}, timestamp: ...}
{type: 'advance', data: {}, timestamp: ...}  // Presenter only
```

### ServerMessage (server → voter/presenter)
```typescript
interface ServerMessage {
  type: 'init' | 'results' | 'participants' | 'timer' | 'locked' | 'question' | ...
  data: Record<string, any>
  timestamp: number
}

// Examples
{type: 'init', data: {session, question, results}, timestamp: ...}
{type: 'results', data: {results: {0: 5, 1: 3}, total: 8}, timestamp: ...}
{type: 'participants', data: {count: 50, voterNames: ['Alice', 'Bob']}, timestamp: ...}
{type: 'timer', data: {endsAt: 1712000030000, total: 30}, timestamp: ...}
```

See [[SPEC_REALTIME.md#websocket-messages]] for complete message reference.

---

## i18n & Localization

**Configuration**: `src/lib/i18n.ts`

```typescript
// Usage
const { t } = useTranslation('common')
<p>{t('welcome')}</p>

// Supported languages
type Language = 'en' | 'nl' | 'de' | 'fr' | 'es'
```

**Translation files** (JSON):
```
public/locales/
├── en/
│   ├── common.json
│   ├── auth.json
│   ├── vote.json
│   ├── admin.json
│   ├── dashboard.json
│   ├── sessions.json
│   ├── errors.json
│   └── wizard.json
├── nl/, de/, fr/, es/ (same structure)
```

---

## State Management Patterns

```
App
├── AuthProvider (useAuth)
│   └── JWT token, user profile, plan
│
├── [Per-page]
│   └── useSession (WebSocket state)
│       └── Question, results, participants, timer
│
├── [Per-page]
│   └── useInsights (Analytics)
│       └── Session statistics
│
└── [Local page state]
    └── useState (form inputs, UI state)
```

**Key principle**: Use hooks, not Redux. Props drilling acceptable for feature scope.

---

## Error Handling

**Error Boundary** (`src/components/ErrorBoundary.tsx`):
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    // Log to backend
    captureError(error, info)
    // Show error UI
  }
}
```

**Global Error Listeners**:
```typescript
window.addEventListener('error', (e) => captureError(e))
window.addEventListener('unhandledrejection', (e) => captureError(e.reason))
```

**Error Patterns** (`src/lib/errorPatterns.ts`):
- Network errors → Retry with backoff
- Auth errors → Redirect to login
- Validation errors → Show toast
- Server errors → Log + show generic message

---

## Performance Optimization

- **Code splitting**: Route-based (Vite lazy loading)
- **Memoization**: `React.memo()` for heavy components (ResultDisplay)
- **Virtualization**: Long lists use react-window
- **Tailwind purging**: Unused classes removed in build
- **Asset optimization**: Images via AVIF with webp fallback

---

## Related References

- [[SPEC_CORE.md#authentication]] — Auth flow
- [[SPEC_REALTIME.md]] — WebSocket protocol
- [[SPEC_BACKEND.md#api-routes]] — Endpoints called from frontend
- [[SPEC_INTEGRATIONS.md#oauth-flows]] — OAuth/SAML flows
