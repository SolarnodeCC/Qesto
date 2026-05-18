---
id: SPEC-FRONTEND
type: specification
domain: frontend
category: ui
status: active
version: 2.0
created: 2026-03-01
updated: 2026-05-18
audience:
  - Frontend engineer
  - UI/UX specialist
  - Architect
tags:
  - react
  - typescript
  - tailwind-css
  - websocket
  - state-management
  - routing
  - i18n
relates_to:
  - SPEC_CORE
  - SPEC_REALTIME
  - WEBSITE_DESIGN_SPEC
  - ADR-0002-ai-streaming-transport
---

# SPEC_FRONTEND — React Architecture, Routing, Hooks, Components

_Repository hub: [Documentation map](../README.md)._

## Doc contract
Route + hook tables = **UI navigation**; **code (`src/`)** wins on prop names until spec PR merges.

**Pre-build:** what UI to build first follows product slice in [includes/PREBUILD_AND_DELIVERY.md](includes/PREBUILD_AND_DELIVERY.md).

## Readers (multi-lens · **Architect** = **Primary** for surfaces)

| Role | Use this doc to… |
|------|------------------|
| **Architect** | **Primary** — public **vote/present/join** vs gated **dashboard/admin**; i18n/a11y as system bars. |
| **Backend Developer** | Page → **REST path** map (see [[SPEC_BACKEND.md]]); WS client → [[SPEC_REALTIME.md]]. |
| **Frontend Developer** | **Lead** — `App.tsx` routes, hooks (`useAuth`, `useSession`, …), lazy chunks. |
| **UI specialist** | **Lead** — `src/ui/tokens`, motion, charts, energizers; loading/empty/error parity. |
| **Cloudflare specialist** | Static asset path + cache hints; link out to [[SPEC_DEPLOYMENT.md]] for CDN/Pages. |
| **API & middleware specialist** | Presenter `Sec-WebSocket-Protocol`; typed `error` envelope in API client. |

## Design System Reference

> **All visual decisions — colour tokens, typography scale, spacing grid, component specs (hero, dashboard, wizard, launchpad), motion rules, AI sparkle mark iconography, and acceptance KPIs — are governed by [`WEBSITE_DESIGN_SPEC.md`](../product/WEBSITE_DESIGN_SPEC.md).** Machine-readable tokens live in [`design-tokens.json`](./design-tokens.json). These files are the source of truth and take precedence over any inline values in this spec.
>
> Key entry points (same `docs/spec/` directory):
> - §4 Colour, typography, spacing, radius/elevation/motion, AI surface rules
> - §5 Layout system + component specs (§5.1 Hero · §5.2 Insights tab · §5.3 Sessions list · §5.4 "+New session" button · §5.5 AIBadge · §5.6 Session Creation Wizard · §5.7 Session Launchpad)
> - §7 Instrumented events and 30-day KPI targets
>
> `src/ui/tokens.ts` is **generated** from `design-tokens.json` (backlog item `DESIGN-TOK-01`) — do not hand-edit it.

## Overview
Qesto frontend is **React 19 + Vite** with TypeScript, Tailwind CSS, and real-time WebSocket via `useSession`. Stack versions: align with [[SPEC_CORE.md#tech-stack]] (code wins if different).

## Route AuthZ (parallel to [[SPEC_BACKEND.md]] legend)

| UI col “Auth” | Maps to |
|---------------|---------|
| — | `A` anonymous |
| JWT | `J` |
| JWT + owner | `JO` |
| JWT + team member | `JM` |
| Admin | `ADM` |

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
| `/settings` | `AccountSettings.tsx` | Yes | Account hub (email, language, density, billing, team links) | JWT |
| `/admin` | `AdminDashboard.tsx` | Yes | Platform admin (tabbed: dashboard, users, OPS, analytics) | JWT + superuser email (`VITE_SUPERUSER_EMAIL`) |
| `/sessions/:id` | `SessionConfig.tsx` | Yes | Edit draft session (DRAFT) | JWT + owner |
| `/sessions/:id/launchpad` | `Launchpad.tsx` | Yes | Pre-live staging | JWT + owner |
| `/sessions/:id/present` | `Present.tsx` | Yes | Presenter view | JWT + host |
| `/sessions/:id/results` | `Results.tsx` | Yes | Post-session results | JWT + host |
| `/teams/:id/settings` | `TeamSettings.tsx` | Yes | Team workspace (members, SAML, custom roles) | JWT + team member |
| `/teams/invite/:token` | `TeamInvite.tsx` | Yes | Team invite acceptance | — |
| `/teams/accept` | `TeamInvite.tsx` | Yes | Team invite (alias) | — |
| `/join`, `/j/:code` | `JoinPage.tsx` | No | Participant join | — |
| `/display/:code` | `Display.tsx` | No | Public display board | — |
| **Legacy / not in current `App.tsx`** |
| `/session/:id/config`, `/ai-creator`, `/decisions/search`, `/present/:id`, `/vote/:id`, `/billing/*`, `/admin/*` sub-routes | various | — | Historical or planned; do not document as live without verifying `App.tsx` |

> **Consolidated (2026-05):** Billing UI is a section on `/settings`, not `/billing/*`. Platform admin is a single `/admin` page with in-page tabs — not `/admin/dashboard`, `/admin/users`, etc. **`src/App.tsx` is authoritative.**

---

## Host shell (`AppShellLayout`)

Authenticated **host hub** pages share [`src/layouts/AppShellLayout.tsx`](../../../src/layouts/AppShellLayout.tsx).

| Surface | Route(s) | Notes |
|---------|----------|--------|
| Dashboard | `/dashboard` | Main nav: Home, Insights, Teams, Templates; footer: Settings, Help |
| Account settings | `/settings` | Footer **Settings** → account hub (language, density, Stripe portal, team links) |
| Platform admin | `/admin` | Nav **Admin** when `auth.user.email === VITE_SUPERUSER_EMAIL` (must match API `SUPERUSER_EMAIL`) |

**Help chat:** `HelpChatProvider` in `App.tsx`; sidebar **Help** and `HelpChatWidget` use `useHelpChat()` for shared open/focus state.

**Other authenticated pages** (e.g. `Launchpad`, `TeamSettings`, `SessionConfig`) use `MainLayout` unless wrapped explicitly in `AppShellLayout`.

---

## Component Hierarchy

> **Component specs:** Detailed visual and interaction specifications for the Hero (§5.1), Insights tab (§5.2), Sessions list (§5.3), "+New session" button (§5.4), AIBadge primitive (§5.5), Session Creation Wizard (§5.6), and Session Launchpad (§5.7) are in [`WEBSITE_DESIGN_SPEC.md`](../product/WEBSITE_DESIGN_SPEC.md) §5.1–5.7. The layout system, responsive grid, density tiers, and page templates (T1–T6) are in §5.0.

### Core Layout
```
App.tsx (Router)
├── AuthProvider (useAuth)
├── HelpChatProvider (useHelpChat — shared help panel state)
├── RouteAnnouncer
├── AuthenticatedHelpWidget (portal HelpChatWidget when logged in)
└── Routes
    ├── Public Routes (no auth)
    │   ├── Home, Login, Pricing, etc.
    │   └── Unprotected session pages (Present, Vote, Results)
    │
    └── Protected Routes
        ├── ProtectedRoute wrapper (checks JWT)
        └── Authenticated pages (Dashboard, Settings, Admin, SessionConfig, …)
```

### Page Components (src/pages/)

```
pages/
├── Home.tsx                    Landing page
├── Login.tsx                   Auth entry point
├── AuthCallback.tsx            Magic link handler
├── SSOCallback.tsx             OAuth handler
├── Dashboard.tsx               Main hub — wrapped in AppShellLayout
├── AccountSettings.tsx         Account settings — AppShellLayout
├── AdminDashboard.tsx          Platform admin (single route, in-page tabs)
│   ├── tab: dashboard        KPIs, live metrics, historical range + CSV, AuditLogViewer
│   ├── tab: users            AdminUsersTab (list/create/suspend)
│   ├── tab: ops              AdminOpsTab
│   └── tab: analytics        AdminAnalyticsTab
├── SessionConfig.tsx           Edit draft session
├── Launchpad.tsx               Pre-live — MainLayout
├── Results.tsx                 Post-session results
├── TeamSettings.tsx            Team workspace — MainLayout
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

> **Source of truth for tokens:** `src/ui/tokens.ts` is **generated** from [`design-tokens.json`](./design-tokens.json) — do not hand-edit it (see backlog item `DESIGN-TOK-01`). For colour tokens, typography scale, spacing grid, radius/elevation/motion rules, and the AI sparkle mark iconography standard, see [`WEBSITE_DESIGN_SPEC.md`](../product/WEBSITE_DESIGN_SPEC.md) §4.

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

**Connection**: **`GET` Upgrade** to `wss://<app-host>/api/sessions/:sessionId/ws` (host from deploy env, not hard-coded).

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

> **Design KPI:** "0 raw i18n keys visible" across all 5 locales is a release gate for the Website Design Wave — see [`WEBSITE_DESIGN_SPEC.md`](../product/WEBSITE_DESIGN_SPEC.md) §7 KPI targets and backlog items `I18N-BUG-01` / `I18N-BUG-02`.

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

## AI usage recipe (copy)

1. “New page” → **Routes & Pages** + lazy route in `App.tsx`.  
2. “Live UI” → **Hooks API** `useSession` + [[SPEC_REALTIME.md#wire-format-normative]].  
3. “Call API X” → grep path in [[SPEC_BACKEND.md]] route tables.  

**Checklist:** Presenter WS uses **subprotocol** • host placeholder not prod-only • Related links avoid dead `#anchors`.

---

## Related References

- [[SPEC_CORE.md#authentication]] — Auth flow
- [[SPEC_REALTIME.md]] — WebSocket protocol + wire format
- [[SPEC_BACKEND.md]] — HTTP routes (`/api/...`) + AuthZ codes
- [[SPEC_INTEGRATIONS.md#authentication-flows]] — OAuth/SAML flows
