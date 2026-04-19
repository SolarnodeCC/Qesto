# Qesto — Product Backlog (Epic-Based)

_Last updated: 2026-04-19 (UTC)_

## Overview

This backlog organizes all product work across 6 core epics, each with supporting user stories. All items are prioritized by WSJF and allocated to the next 5 sprints. Each story includes clear acceptance criteria in Given/When/Then format.

---

## Epic Catalog

| Epic | Status | Focus | Completion |
|---|---|---|---|
| **EPIC-CORE** | Planned | Session lifecycle, realtime voting, presenter controls | 0% (Sprints 1-2) |
| **EPIC-BILLING** | Planned | Stripe integration, plan middleware, subscriptions | 0% (Sprints 2, 5) |
| **EPIC-AUTH** | Planned | Magic link, SAML SSO, JWT management | 0% (Sprints 1, 3, 5) |
| **EPIC-ENT** | Planned | Audit logging, RBAC, admin dashboard, multi-tenant | 0% (Sprints 3-5) |
| **EPIC-I18N** | Planned | Locale bundles, key validation, translation QA | 0% (Sprints 4-5) |
| **EPIC-GAM** | Planned | Energizers, leaderboard, badges, referrals | 0% (Sprints 4-5) |

---

## EPIC-CORE: Core Session Platform

**Goal**: Build the realtime session engine with presenter + participant flows.

### CORE-01: Session Creation & DRAFT State

**Size**: 8 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As a team owner, I can create a new session in DRAFT state with a title, description, and question list, so I can prepare before going live.

**Acceptance Criteria**:
- Given a team owner on the create session page, when they fill in title/description/questions and click save, then session is created in DRAFT state with a unique session ID
- Given a session in DRAFT, when the presenter clicks "Preview", then they can see a mock participant view without state being LIVE
- Given a DRAFT session, when a non-owner tries to join, then they receive a "Not yet started" error (403)
- Code: D1 schema `sessions` table with `state`, `title`, `description`, owner foreign key
- Tests: Unit test for session creation, integration test for DRAFT state enforcement

**Dependencies**: None

---

### CORE-02: Session Lifecycle Transitions

**Size**: 8 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As a presenter, I can transition a session from DRAFT → LIVE → CLOSED → ARCHIVED, so participants can join at the right time and sessions can be managed post-completion.

**Acceptance Criteria**:
- Given a DRAFT session, when the presenter clicks "Start", then state becomes LIVE and WebSocket DO is created
- Given a LIVE session, when the presenter clicks "Close", then state becomes CLOSED and WebSocket rejects new joins
- Given a CLOSED session, when archived, then state becomes ARCHIVED and session is excluded from active lists (but still queryable)
- Transition validations: DRAFT→LIVE (must have ≥1 question), LIVE→CLOSED (any time), CLOSED→ARCHIVED (24h delay)
- Code: D1 `sessions.state` enum, DO lifecycle hooks
- Tests: State machine tests covering all transitions + invalid transitions

**Dependencies**: CORE-01

---

### CORE-03: Question Types & Configuration

**Size**: 5 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As a session designer, I can configure multiple question types (poll, ranking, consent vote, open question), so the session can gather diverse feedback.

**Acceptance Criteria**:
- Given a session in DRAFT, when adding a question, then I can select type: poll, ranking, consent_vote, open_question
- Given a poll question, when configured, then I can set: question text, answer options (2-5), allow_other boolean
- Given a ranking question, when configured, then I can set: question text, items to rank (2-10)
- Given a consent vote, when configured, then options are fixed (Agree/Neutral/Disagree) 
- Given an open question, when configured, then I can set: question text, char_limit (0=unlimited)
- Code: D1 `questions` table with `question_type` and `config` JSON
- Tests: Unit tests for each question type schema validation

**Dependencies**: CORE-01

---

### CORE-04: WebSocket Live Session Room (Durable Object)

**Size**: 13 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As the platform, I need a Durable Object SessionRoom that maintains realtime state and broadcasts updates to all connected participants.

**Acceptance Criteria**:
- Given a LIVE session, when participants connect via WebSocket, then DO maintains a list of active connections
- Given connected participants, when one submits a vote, then DO broadcasts `VoteReceived` to all participants (except voter) within 100ms
- Given the presenter, when they advance to the next question, then all participants see the question update via broadcast within 100ms
- Given a participant disconnect, when they reconnect within 5 minutes, then their vote history is preserved
- Given 100+ simultaneous connections, when load testing, then p99 latency < 500ms
- Code: `functions/api/ws/[[session_id]].ts` Durable Object + WebSocket handler
- Tests: Integration tests for concurrent connections, message delivery, reconnection

**Dependencies**: CORE-01, CORE-02

---

### CORE-05: Realtime Vote Submission

**Size**: 8 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As a participant, I can submit my vote in realtime and see it recorded, so I can participate in the session.

**Acceptance Criteria**:
- Given a LIVE session with active question, when I submit a vote, then my vote is recorded in D1 within 500ms
- Given a poll question, when I select an option, then my vote is stored with my participant_id and question_id
- Given a ranking question, when I order items, then my ranking is stored as an ordered array
- Given a consent vote, when I select Agree/Neutral/Disagree, then my vote is recorded
- Given an open question, when I type text, then my response is stored (no character limit unless configured)
- Idempotency: if I resubmit the same vote within 5 seconds, then duplicate entries are not created
- Code: Vote submission route + idempotency ledger in KV
- Tests: Vote insertion tests, duplicate prevention tests, latency tests

**Dependencies**: CORE-04

---

### CORE-06: Presenter Controls

**Size**: 8 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As a presenter, I can advance questions, show/hide results, and control session flow in realtime.

**Acceptance Criteria**:
- Given a LIVE session, when I click "Next Question", then current question closes and next question becomes active
- Given an active question with votes, when I click "Show Results", then a results dashboard appears for all participants (pie chart for poll, bar for ranking)
- Given results shown, when I click "Hide Results", then charts disappear but votes remain recorded
- Given a LIVE session, when I pause, then participants cannot submit new votes but can see pending results
- Given results hidden, when I click "Resume", then participants can vote again
- Broadcast: All control actions trigger WebSocket broadcasts to all participants within 100ms
- Code: Presenter controls route + DO broadcast messages
- Tests: Control flow tests, broadcast delivery tests, concurrent control tests

**Dependencies**: CORE-04

---

### CORE-07: Participant Join Flow

**Size**: 8 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As a participant, I can join a LIVE session via a shareable link and see the current question.

**Acceptance Criteria**:
- Given a session URL, when I click it, then I land on a join page with session title + presenter name
- Given the join page, when I enter my name (or select anonymous), then I click "Join" and am added to the session
- Given a LIVE session, when I join, then I immediately see the current active question
- Given the session is DRAFT or CLOSED, when I try to join, then I see "Session not available" (403)
- Duplicate names: given two participants with the same name, then each gets a unique participant_id (names can be duplicate)
- Code: Join route, participant record creation, WebSocket upgrade
- Tests: Join permission tests, current question fetch tests, anonymous vs named tests

**Dependencies**: CORE-02, CORE-04

---

### CORE-08: Session Results Export

**Size**: 5 pts | **Sprint**: 4 | **Priority**: P1

**Story**: As a session owner, I can export all votes and responses as CSV after a session closes, so I can analyze results offline.

**Acceptance Criteria**:
- Given a CLOSED or ARCHIVED session, when I click "Export Results", then a CSV download starts
- CSV format: rows = votes, columns = [question_text, answer_text, participant_name, timestamp, question_type]
- For open questions: response text is included in full
- For ranking: ranking order is preserved (e.g., "1st, 2nd, 3rd")
- File naming: `[session_id]_results_[date].csv`
- Code: Export route + CSV generation utility
- Tests: CSV format validation, completeness tests (all votes included)

**Dependencies**: CORE-01, CORE-05

---

## EPIC-BILLING: Billing + Plan Foundations

**Goal**: Integrate Stripe and implement plan-based feature gating.

### BILL-01: Plan Definition & Feature Flags

**Size**: 5 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As an admin, I can define subscription plans with feature limits (session cap, participant cap, premium features), so the product can be tiered.

**Acceptance Criteria**:
- Given the system, when configured, then 3 plans exist: Free, Pro, Enterprise with defined feature sets
- Free plan: 5 sessions/month, 50 participants/session, no export, no SAML
- Pro plan: 50 sessions/month, 500 participants/session, export, no SAML
- Enterprise: unlimited sessions, unlimited participants, export, SAML, custom branding
- Code: D1 `plans` table, `plan_features` mapping, `PLANS` constant in wrangler.toml
- Tests: Plan definition tests, feature flag retrieval tests

**Dependencies**: None

---

### BILL-02: Stripe Checkout Flow

**Size**: 8 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As a Free plan user, I can upgrade to Pro via Stripe checkout, so I can access paid features.

**Acceptance Criteria**:
- Given a Free user on the billing page, when they click "Upgrade to Pro", then they are redirected to Stripe Checkout
- Checkout session includes: plan name, price, team_id (for reference)
- Given successful payment, when Stripe redirects back, then session_id is stored and processed by webhook
- Given payment failure, when user returns, then they see "Payment declined" with retry button
- Stripe session expires after 24 hours
- Code: `/api/billing/checkout` route, Stripe session creation, success/cancel redirect handlers
- Tests: Checkout flow mock tests, redirect tests, error handling tests

**Dependencies**: BILL-01

---

### BILL-03: Stripe Webhook Idempotent Handling

**Size**: 8 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As the system, I must idempotently process Stripe webhooks (charge.succeeded, charge.failed, customer.subscription.updated) so duplicate events don't cause double-billing.

**Acceptance Criteria**:
- Given a webhook event, when received, then event_id is checked against KV `STRIPE_EVENTS`
- If event_id exists in KV with success status, then webhook is silently ignored (idempotent)
- If event_id is new, then event is processed and event_id + status stored in KV (TTL 30 days)
- On charge.succeeded: team subscription is upgraded, plan is updated in D1
- On charge.failed: failure is logged, team is notified via email, subscription remains unchanged
- On customer.subscription.updated: plan is updated in D1, feature flags are refreshed
- Code: `/api/webhooks/stripe` route, idempotency ledger in KV
- Tests: Duplicate event handling tests, state transition tests, retry tests

**Dependencies**: BILL-02

---

### BILL-04: Plan Middleware (Feature Gating)

**Size**: 5 pts | **Sprint**: 2 | **Priority**: P0

**Story**: As the API, I must enforce plan-based feature limits, so Free users can't access premium routes.

**Acceptance Criteria**:
- Given a route marked as `@premium`, when a Free user accesses it, then they get 403 with message "Upgrade to Pro"
- Given a Free user, when they try to create session #6 in current month, then 403 "Limit reached"
- Given a Free user, when they add participant #51 to a session, then that participant can't join (403)
- Plan check middleware in Hono before route handler
- Code: Plan middleware in `functions/api/middleware/` + route decorators
- Tests: Feature gate tests for each plan level, limit enforcement tests

**Dependencies**: BILL-01

---

### BILL-05: Subscription Management (Upgrade/Downgrade/Cancel)

**Size**: 8 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a Pro user, I can manage my subscription (upgrade to Enterprise, downgrade to Free, cancel), so I control my billing.

**Acceptance Criteria**:
- Given a Pro user on billing dashboard, when I click "Change Plan", then I see upgrade (to Enterprise) and downgrade (to Free) options
- On upgrade: Stripe subscription is updated, prorated charge applied, plan is updated in D1
- On downgrade: Stripe subscription is updated, credit applied, plan downgrade takes effect next cycle
- On cancel: Stripe subscription is cancelled, team is moved to Free plan
- All actions trigger email confirmations
- Code: Plan change routes + Stripe subscription update calls
- Tests: Subscription update tests, proration tests, email notification tests

**Dependencies**: BILL-03

---

### BILL-06: Billing Portal & Invoice History

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a team owner, I can view my invoice history and access Stripe Billing Portal, so I manage payments and billing info.

**Acceptance Criteria**:
- Given a team with active Stripe customer_id, when I click "Billing Portal", then I am redirected to Stripe-hosted portal
- On return from portal, user is back on app billing page
- Given the invoices section, when I view it, then all invoices are listed with: date, amount, status, download link
- Invoices are fetched from Stripe API on demand
- Code: Billing portal route, invoice fetch route
- Tests: Portal redirect tests, invoice list tests

**Dependencies**: BILL-03

---

## EPIC-AUTH: Authentication

**Goal**: Implement magic link auth and SAML SSO.

### AUTH-01: Magic Link Email Send & Verify

**Size**: 8 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As a new user, I can enter my email and receive a magic link to sign up without a password.

**Acceptance Criteria**:
- Given the login page, when I enter my email and click "Send Magic Link", then a confirmation message appears
- Email is sent via Resend with subject "Sign in to Qesto" containing a 24-hour-expiring link
- Given the magic link, when I click it, then I land on a set-name page, set my display name
- Given a set name, when I click "Confirm", then a JWT is issued, I'm logged in, and redirected to dashboard
- If link expires, when I click it, then "Link expired" message appears with option to resend
- Duplicate sends: if I send link twice in 5 minutes, second email includes same link (no spam)
- Code: Email send route, token generation/verification, JWT issuance
- Tests: Email delivery tests (Resend mock), token expiry tests, JWT tests

**Dependencies**: None

---

### AUTH-02: JWT Session Management

**Size**: 5 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As the API, I must manage JWT tokens so sessions are stateless and secure.

**Acceptance Criteria**:
- Given a logged-in user, when I make API calls, then JWT is in Authorization header or secure cookie
- JWT includes: user_id, email, team_ids, issued_at, expires_at (14 days)
- Given an expired JWT, when I use it, then API returns 401 "Unauthorized"
- Given a valid JWT, when decoded, then it's verified using `JWT_SECRET` from env
- Refresh flow: 1 hour before expiry, client can refresh token to get new one (same payload, new expiry)
- Code: JWT middleware, token generation/validation utilities
- Tests: JWT creation tests, expiry tests, refresh tests, invalid token tests

**Dependencies**: AUTH-01

---

### AUTH-03: SAML SSO Integration

**Size**: 8 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As an enterprise customer, I can use my corporate SAML IdP (Okta, Azure AD, etc.) to sign in, so users don't need separate credentials.

**Acceptance Criteria**:
- Given SAML is enabled for a team, when I click "Sign in with SAML", then I'm redirected to IdP login
- IdP authenticates me and returns SAML assertion to Assertion Consumer Service (ACS)
- ACS verifies signature using team's IdP certificate, extracts email + name
- Given valid SAML assertion, when verified, then user is logged in (JWT issued) or account is auto-created
- If SAML assertion is invalid or signature fails, then "Authentication failed" error appears
- Code: SAML SP metadata endpoint, ACS route, assertion validation
- Tests: SAML assertion validation tests, signature tests, auto-account-creation tests

**Dependencies**: AUTH-02

---

### AUTH-04: SAML Metadata Exchange & IdP Config

**Size**: 5 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As a team admin, I can configure SAML by uploading IdP metadata or pasting IdP config URL, so team members can use SSO.

**Acceptance Criteria**:
- Given the team SAML settings, when I paste IdP metadata URL, then metadata is fetched and parsed
- From metadata, extract: IdP SSO URL, logout URL, x509 certificate
- Alternatively, when I upload metadata XML file, then same parsing happens
- Given valid metadata, when I click "Enable SAML", then SAML is activated for team
- Given SAML enabled, when I go to IdP console, then I can add Qesto as a SAML application
- Code: Metadata fetch + parse route, SAML config storage in D1
- Tests: Metadata parsing tests, certificate extraction tests, validation tests

**Dependencies**: AUTH-03

---

### AUTH-05: Auth Middleware (Protected Routes)

**Size**: 5 pts | **Sprint**: 1 | **Priority**: P0

**Story**: As the API, I must protect all routes with auth middleware so unauthorized users can't access data.

**Acceptance Criteria**:
- Given all protected routes (anything except login, health, public docs), when accessed without JWT, then 401 returned
- Given a valid JWT, when route is accessed, then user context is available to handler (user_id, team_id)
- Given a JWT from different team, when accessing team-specific route, then 403 "Forbidden" returned
- Auth middleware extracts JWT from Authorization header or cookie, validates, attaches user context
- Code: Auth middleware in `functions/api/middleware/auth.ts`
- Tests: Missing JWT tests, valid JWT tests, cross-team tests, role-based tests

**Dependencies**: AUTH-02

---

### AUTH-06: Token Refresh & Revocation

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a user, I can refresh my JWT before expiry and revoke tokens (logout), so sessions remain fresh and I can sign out.

**Acceptance Criteria**:
- Given a valid JWT, when I call `/api/auth/refresh`, then new JWT is issued with same user_id but new expiry
- Old JWT remains valid until expiry (grace period for in-flight requests)
- Given a logged-in user, when I click "Logout", then current JWT is revoked (added to D1 `revoked_tokens`)
- After revocation, using revoked token returns 401
- Revoked tokens are garbage-collected after expiry date passes
- Code: Refresh route, revocation route, revocation check in middleware
- Tests: Refresh tests, revocation tests, grace period tests

**Dependencies**: AUTH-02

---

## EPIC-ENT: Enterprise Operations

**Goal**: Implement audit logging, RBAC, admin dashboard, and multi-tenant safeguards.

### ENT-01: Team Management (Create, Invite, Roles)

**Size**: 8 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As a team owner, I can create teams, invite members with specific roles, and manage team membership.

**Acceptance Criteria**:
- Given a user, when I click "Create Team", then I enter team name, confirm, and become team owner
- Given a team, when I click "Invite Members", then I can enter email addresses and assign roles (Admin, Member, Presenter, Viewer)
- Invitations are sent via email with 7-day expiry link
- Given an invitation, when recipient clicks link, then they accept and join team with assigned role
- Given a team member, when owner clicks "Remove", then member is immediately removed
- Removing a member revokes their access (JWT invalidated)
- Code: Team CRUD routes, invitation routes, membership routes
- Tests: Team creation tests, invitation tests, role assignment tests, removal tests

**Dependencies**: AUTH-02

---

### ENT-02: Role Model (5 Roles with Permissions)

**Size**: 8 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As the platform, I must implement granular role-based access control with 5 roles (Owner, Admin, Member, Presenter, Viewer), each with specific permissions.

**Acceptance Criteria**:
- **Owner**: Full access (team, users, sessions, billing, audit logs, SAML)
- **Admin**: Team + user management, sessions, audit logs (no billing, no SAML config)
- **Member**: Create/edit own sessions, view team sessions, manage participants
- **Presenter**: View assigned sessions, present live, view results (no editing)
- **Viewer**: View-only access to sessions and results
- Given a user with Presenter role, when they try to create a session, then 403 "Insufficient permissions"
- Permissions are checked in middleware before route handlers
- Code: Role enum in D1, permission matrix utility, role middleware
- Tests: Permission matrix tests, role enforcement tests for each route

**Dependencies**: ENT-01

---

### ENT-03: Audit Logging (All Mutations)

**Size**: 8 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As a compliance officer, I need comprehensive audit logs of all mutations (create, update, delete) so I can prove who changed what when.

**Acceptance Criteria**:
- Given any mutation route (session create, team invite, plan change, auth), when handler executes, then audit event is logged
- Audit entry includes: timestamp, user_id, action (CREATE/UPDATE/DELETE), resource_type, resource_id, changes (before/after if applicable)
- Given 1000 audit entries, when queried, then they are indexed on (timestamp, user_id, resource_type)
- Audit entries are immutable (no updates after creation)
- Admin can view audit logs filtered by date range, action, resource type
- Code: Audit log utility, D1 `audit_logs` table, audit log viewer route
- Tests: Audit logging tests for each mutation type, query performance tests

**Dependencies**: ENT-02

---

### ENT-04: Admin Metrics Dashboard

**Size**: 8 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As an admin, I can view a dashboard with key metrics (active sessions, total participants, feature usage, billing health), so I understand platform health.

**Acceptance Criteria**:
- Dashboard displays: today's active sessions, 30-day session count, total participants this month, top question types, plan distribution
- Metrics are updated every 5 minutes from D1 queries
- Admin can export metrics as CSV
- Dashboard includes: billing health (revenue, churn, plan mix), uptime (if monitoring is set up)
- Charts: line graph (sessions over time), pie (plan distribution), bar (feature usage)
- Code: Metrics aggregation service, dashboard route, Frontend dashboard component
- Tests: Metric calculation tests, dashboard data fetch tests

**Dependencies**: ENT-02, BILL-03

---

### ENT-05: Multi-Tenant Isolation Enforcement

**Size**: 8 pts | **Sprint**: 3 | **Priority**: P0

**Story**: As the platform, I must ensure strict data isolation between teams so no team can see another's data.

**Acceptance Criteria**:
- Given a user in Team A, when they request Team B's data, then 403 "Forbidden" returned
- All queries include `WHERE team_id = ?` enforced by middleware
- Session join is isolated: given participant from Team B, when they try to join Team A session, then 403
- Reporting/exports are scoped to requesting team only
- Code: Tenant middleware checks team_id on every request, D1 query safeguards
- Tests: Cross-tenant access tests for all routes, data isolation tests

**Dependencies**: ENT-01, ENT-02

---

### ENT-06: Advanced Role Delegation

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a team owner, I can grant delegate permissions to admins, allowing them to perform specific actions on my behalf.

**Acceptance Criteria**:
- Given an admin, when owner grants "Manage Billing" delegation, then admin can upgrade/downgrade plans (but not see payments)
- Given delegated permissions, when admin uses them, then action is logged with delegated_by = owner_id
- Delegation can be time-limited (e.g., "valid until 2026-05-01") or permanent
- Owner can revoke delegations anytime
- Code: Delegation model in D1, delegation check in permission middleware
- Tests: Delegation grant tests, revocation tests, expiry tests, audit logging tests

**Dependencies**: ENT-02, ENT-03

---

## EPIC-I18N: Internationalization QA

**Goal**: Implement multi-language support with quality hardening.

### I18N-01: Locale Bundle Structure (EN/NL/ES/DE/FR)

**Size**: 8 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As the platform, I need locale bundles for 5 languages (EN, NL, ES, DE, FR) organized by namespace, so content can be translated.

**Acceptance Criteria**:
- Structure: `src/i18n/locales/{lang}/{namespace}.json` (e.g., `en/common.json`, `nl/auth.json`)
- 8 namespaces: common, auth, session, billing, admin, errors, templates, gamification
- Each bundle is a flat key-value structure (no nested objects for performance)
- Keys follow pattern: `{domain}.{feature}.{element}` (e.g., `auth.login.email_label`)
- English (EN) is the source of truth; other languages are translations
- Code: i18n folder structure, locale loading utility
- Tests: Bundle structure validation, key coverage tests (all keys in EN exist in other langs)

**Dependencies**: None

---

### I18N-02: Language Detection & Selector

**Size**: 5 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As a user, the app automatically detects my browser language and I can manually select a different language.

**Acceptance Criteria**:
- Given new user, when app loads, then browser language preference is detected from Accept-Language header
- If browser lang is supported (EN/NL/ES/DE/FR), then app loads in that language
- If not supported, fallback to EN
- Given logged-in user, when I click language selector, then I can choose from 5 languages
- Selection is saved to user preferences in D1 `users.preferred_lang`
- On next login, app loads in saved language
- Code: Language detection middleware, user preference storage, language selector UI component
- Tests: Language detection tests, preference persistence tests, fallback tests

**Dependencies**: I18N-01

---

### I18N-03: Key Extraction Pipeline & CI Validation

**Size**: 8 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As the CI system, I must validate that all hardcoded strings are translated and no keys are orphaned.

**Acceptance Criteria**:
- Given code with hardcoded strings, when PR is submitted, then CI runs key extraction (searches for `t("key")` patterns)
- Extracted keys are compared against locale bundles
- If key is missing from EN bundle, then CI fails with "Untranslated string: {key}"
- If key exists in EN but missing in other languages, then CI warns "Incomplete translation: {lang}"
- If a key exists in bundle but is never used in code, then CI warns "Orphaned translation: {key}"
- Code: Key extraction script (regex-based), CI check in workflow, fix recommendations
- Tests: Extraction accuracy tests, validation rule tests

**Dependencies**: I18N-01

---

### I18N-04: Translation Quality Hardening (Plurals, Interpolation)

**Size**: 8 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a translator, I need support for plurals and variable interpolation, so translations are natural and context-aware.

**Acceptance Criteria**:
- Plural support: key `common.participant_count` with forms: `{0: "No participants", 1: "1 participant", other: "{count} participants"}`
- Interpolation: `auth.welcome` = "Welcome, {name}!" with runtime substitution
- Given a translation with interpolation, when counted items change (1 → 2), then correct plural form is used
- All 5 languages support same interpolation/plural syntax for consistency
- Code: i18n utility with plural + interpolation support, translations structured for i18next or i18next-like
- Tests: Plural form tests, interpolation tests, edge cases (0, 1, many)

**Dependencies**: I18N-01, I18N-02

---

### I18N-05: RTL/LTR Layout Support

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a user in an RTL language (if supported future), the UI should adapt layout, so content is readable in RTL context.

**Acceptance Criteria**:
- Given English (LTR) content, when layout is rendered, then flex/grid flows left-to-right
- If future RTL language is added, then `dir="rtl"` is set on HTML root
- CSS flexbox/grid automatically reflects with RTL
- Text alignment reverses (text-align: left → right for RTL)
- Code: CSS logical properties (margin-inline, text-align-inline), RTL detection
- Tests: RTL layout tests (future, when language added)

**Dependencies**: I18N-02

---

### I18N-06: Locale-Aware Date/Number Formatting

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a user, dates and numbers are formatted according to my locale, so they are readable in my cultural context.

**Acceptance Criteria**:
- Given a date (e.g., "2026-04-19"), when displayed to EN user, then "April 19, 2026" format
- Same date to NL user: "19 april 2026", DE user: "19. April 2026"
- Given a number (e.g., 1234.56), when displayed to EN user, then "1,234.56"
- Same number to NL user: "1.234,56", DE user: "1.234,56"
- Code: Intl API usage (DateTimeFormat, NumberFormat) with locale parameter
- Tests: Format tests for each locale, edge case dates (leap years, etc.)

**Dependencies**: I18N-02

---

## EPIC-GAM: Gamification Expansion

**Goal**: Build engagement features (energizers, leaderboards, badges, referrals).

### GAM-01: Energizer Components (Speed Round, Trivia)

**Size**: 8 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As a session presenter, I can add energizer activities (speed round, trivia) to boost engagement, so participants stay active.

**Acceptance Criteria**:
- **Speed Round**: Rapid poll with 60-second timer, auto-advances to results at timeout
  - Config: question, 2-4 options, timer (30-120 seconds)
  - Behavior: timer bar visible to all, countdown audio cue at 10 seconds
- **Trivia**: Multiple choice with correct answer, scored based on speed of response
  - Config: question, 4 options (1 correct marked), point value
  - Behavior: instant feedback (✓/✗), points awarded (100 * (60 - seconds_taken) / 60)
- Both can be standalone questions or mini-games between regular questions
- Code: Speed round + trivia question types, timer state in DO, scoring logic
- Tests: Timer tests, auto-advance tests, scoring tests

**Dependencies**: CORE-03, CORE-04, CORE-05

---

### GAM-02: Live Leaderboard

**Size**: 8 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As a participant, I can see a live leaderboard showing top scorers, so I'm motivated to engage.

**Acceptance Criteria**:
- Given a session with scored questions (trivia), when 2+ participants have answered, then leaderboard is visible
- Leaderboard shows: participant name/avatar, current score, rank
- Updates in realtime as participants score points
- Leaderboard is hidden until first correct answer (no pre-leaderboard empty display)
- Presenter can toggle leaderboard visibility on/off
- Top 10 are shown by default (scroll to see more)
- Code: Leaderboard calculation in DO, realtime broadcast, UI component
- Tests: Scoring tests, ranking tests, realtime update tests, toggle tests

**Dependencies**: GAM-01

---

### GAM-03: Badge System (8+ Badge Types)

**Size**: 8 pts | **Sprint**: 4 | **Priority**: P0

**Story**: As a participant, I can earn badges for achieving milestones, so I feel recognized for engagement.

**Acceptance Criteria**:
- **Badge Types**: First Answer, Speedster (top 3 speed round), Perfect Trivia (100% correct), Engagement (10+ votes), Leaderboard (top 10), Weekly Streak, Consensus (picks majority choice)
- Badges awarded automatically when criteria met
- Participant can view earned badges on profile
- Badges display on leaderboard if presenter enables "Show Badges"
- No duplicate badges in single session; earned once per session max
- Code: Badge model in D1, criteria evaluation logic, badge assignment on vote
- Tests: Badge criteria tests, duplicate prevention tests, display tests

**Dependencies**: GAM-01, GAM-02

---

### GAM-04: Referral Mechanics

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a team owner, I can generate shareable referral links to invite new users, earning credits for upgrades.

**Acceptance Criteria**:
- Given a team, when I click "Get Referral Link", then unique link is generated (format: `qesto.app/ref?code={referral_code}`)
- Given a new user visiting referral link, when they sign up, then referrer team gets credit
- Credit value: Free user ref = $10 credit, Pro ref = $25 credit (applied to next invoice)
- Referrer can view referral history: email, date, signup status, credit earned
- Code: Referral link generation, tracking on signup, credit application on payment
- Tests: Link generation tests, referral tracking tests, credit application tests

**Dependencies**: AUTH-01, BILL-03

---

### GAM-05: Advanced Energizer Scenarios

**Size**: 8 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a session creator, I can build complex energizer sequences (battle royale, bracket competitions) for large-scale engagement.

**Acceptance Criteria**:
- **Battle Royale**: Multiple rounds, weakest performers eliminated each round, scoring multiplier per round
  - Config: # of rounds, elimination threshold (bottom %), scoring formula
- **Bracket Competition**: Head-to-head match-ups, single/double elimination
  - Config: 4/8/16 participants, match format, scoring per match
- Both require session size ≥ 4 participants
- Results displayed with winner(s) highlighted
- Code: Battle royale state machine, bracket generation, match scheduling
- Tests: Tournament logic tests, elimination tests, bracket generation tests

**Dependencies**: GAM-01, GAM-03

---

### GAM-06: Gamification Analytics

**Size**: 5 pts | **Sprint**: 5 | **Priority**: P1

**Story**: As a session owner, I can view engagement analytics (badges earned, leaderboard accuracy, energizer participation), so I understand what drives engagement.

**Acceptance Criteria**:
- Metrics: total badges earned, badge breakdown by type, leaderboard participation %, trivia accuracy %, speedster average time
- Charts: badge distribution (pie), engagement over time (line), accuracy by question type (bar)
- Admin dashboard aggregates across all sessions for platform insights
- CSV export of all metrics per session
- Code: Metrics calculation service, analytics routes, dashboard component
- Tests: Metric calculation tests, aggregation tests, export tests

**Dependencies**: GAM-01, GAM-02, GAM-03, ENT-04

---

## Sprint Allocation Summary

| Sprint | Focus | Epics | Target Date |
|---|---|---|---|
| **Sprint 1** | Foundation | CORE (1-3), AUTH (1-2, 5), BILL (1) | 2026-05-02 |
| **Sprint 2** | Realtime + Payments | CORE (4-7), BILL (2-4) | 2026-05-16 |
| **Sprint 3** | Enterprise + SSO | AUTH (3-4), ENT (1-5) | 2026-05-30 |
| **Sprint 4** | i18n + Engagement | CORE (8), I18N (1-3), GAM (1-3) | 2026-06-13 |
| **Sprint 5** | Hardening + Advanced | AUTH (6), BILL (5-6), ENT (6), I18N (4-6), GAM (4-6) | 2026-06-27 |

---

## Definition of Ready

- Problem statement is concrete (user, goal, context)
- Acceptance criteria written in Given/When/Then format
- Size estimated (5/8/13 pts)
- Security/privacy/i18n impact assessed
- Dependencies identified

---

## Definition of Done

- Code merged to main
- Tests pass (unit + integration)
- Observability events added (if applicable)
- Docs updated (if API changes)
- AC demonstrated in PR review

---

## Appendix: Migration Path

If migrating from old Sprint A/B/C structure:
- Old ID 1 (Hotspot refactor) → New CORE-01/02/04
- Old ID 31 (Template foundation) → Moved to future sprint (post-Sprint 5)
- All old IDs phased out; epic-based numbering is canonical
