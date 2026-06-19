---
id: ENTERPRISE-FEATURE-REVIEW
type: analysis
domain: product
category: enterprise-readiness
status: active
version: 1.0
created: 2026-05-31
author: AI review (Claude, Cowork)
relates_to:
  - SPEC_PRODUCT
  - ROADMAP_FULL
  - BACKLOG_MASTER
  - COMPETITIVE_EPICS
---

# Qesto — Enterprise Feature Polish Review

_Generated: 2026-05-31. Covers every shipped feature area. Each section names the current state, the enterprise gap, and concrete polish actions._

---

## How to read this document

Each feature area uses a **RAG status**:

- 🟢 **Enterprise-ready** — meets the bar; minor polish only
- 🟡 **Needs polish** — functional but has gaps that lose enterprise deals
- 🔴 **Enterprise blocker** — missing or weak enough to be a loss reason

Actions are ordered by urgency within each area. Items that already have a backlog ID are cross-referenced.

---

## 1. Core Session Platform (voting lifecycle, question types, presenter controls)

**Current state:** 11 question types, DRAFT → ENERGIZING → LIVE → CLOSED → ARCHIVED state machine, Durable Object realtime, reconnect-safe snapshots, preflight gate before launch. **Status: 🟡 Needs polish**

### Gaps & polish actions

**1a. Presenter recovery UX**
When a presenter loses connection mid-session, the DO preserves state but the reconnect path drops them back to the join screen rather than straight back to the run screen with current question visible. For a 200-person all-hands, "host disappeared for 30 seconds" is a deal-killer story.
- _Action:_ On re-authentication of a presenter token within a LIVE session, detect `role=owner` in the DO `init` snapshot and auto-route to `/session/:id/run` with state pre-loaded. Add a 5-minute "grace reconnect" window before the session closes.

**1b. Question-level timer enforcement**
Timers exist in the UI but are not enforced server-side in the DO — a motivated participant can submit after expiry via a raw WebSocket message.
- _Action:_ Store `closedAt` per question in DO state; reject votes after expiry with `{type:'error',code:'question_closed'}`. Add a contract test covering late-submit rejection.

**1c. Moderation: response approval before reveal**
Open questions surface all responses simultaneously. Enterprise HR and all-hands use cases require a host to approve/reject individual responses before they display on the big screen.
- _Action:_ Add a `moderated: boolean` flag per open question (DRAFT API). In the DO, buffer open responses in a `pendingResponses` map; broadcast to presenter-only view. Add `ClientMessage` type `APPROVE_RESPONSE` / `REJECT_RESPONSE` with DO state transition.

**1d. Session capacity limits**
The platform claims 10k+ edge scale (SCALE-PROOF-01 is planned for Sprint 32) but the `participants` count in the DO is unbounded with no per-plan cap. Enterprise tiers need a documented + enforced seat cap.
- _Action:_ Add `max_participants` to plan entitlements matrix; enforce in `SessionRoom.onConnect()` with a structured `capacity_exceeded` close frame. Surface remaining capacity in the run screen.

**1e. PDF/rich export completeness** (EXPORT-PDF-01, Sprint 33+)
CSV export is live; XLSX is live. Signed PDF is planned. Enterprise buyers expect a branded, shareable PDF report within seconds of closing a session — this is consistently a demo ask.
- _Action:_ Accelerate EXPORT-PDF-01 to Sprint 32 stretch. Include: session metadata header, per-question bar charts (server-side rendered via Puppeteer/html2canvas equivalent in a Worker), team logo from branding config, page numbers.

---

## 2. Authentication (Magic link, SAML SSO, LDAP, Password)

**Current state:** Magic link, password, SAML ACS + metadata endpoint, LDAP group sync, OAuth PKCE (Google/GitHub), SCIM provisioning routes mounted. **Status: 🟡 Needs polish**

### Gaps & polish actions

**2a. SCIM provisioning completeness**
The SCIM routes are mounted (`mountScimRoutes`) but the enterprise checklist for Okta/Azure AD certification requires: User create/update/deactivate, Group push, entitlement attribute mapping, and a SCIM compliance test suite. Missing any of these means the IT team's provisioning ticket won't close.
- _Action:_ Audit `routes/scim.ts` against RFC 7644 §3 (User resource) and §4 (Group resource). Add Okta SCIM 2.0 integration test harness. Publish a SCIM provisioning guide in `/knowledge-base/help/`.

**2b. SAML IdP-initiated flow**
Only SP-initiated SAML is documented. Large enterprises (banks, pharma) often mandate IdP-initiated SSO from their portal. If the ACS handler doesn't accept an unsolicited `SAMLResponse`, the deal stalls at IT review.
- _Action:_ Accept `SAMLResponse` without a prior `AuthnRequest` when `IDP_INITIATED_SSO_ENABLED=true` per-team config. Validate `InResponseTo` absence gracefully. Add a flag in team SAML settings UI.

**2c. Session token expiry UX**
JWT expiry results in a silent 401 mid-session — the participant sees a blank screen or a cryptic error rather than a smooth "your link has expired, click to re-join" prompt.
- _Action:_ Intercept 401 responses in the WS/HTTP client; show a non-disruptive re-auth toast for voters (magic-link-less re-join via session code) and a modal for presenters.

**2d. MFA/step-up auth for sensitive operations**
GDPR deletion, custom role assignment, and billing changes are not gated on a second factor. Enterprise security teams will flag this in vendor reviews.
- _Action:_ Add a `require_mfa` flag per team (team settings → Security). Enforce step-up challenge (TOTP or email OTP) for: GDPR delete, role promote/demote, billing portal open, SAML config change.

**2e. Audit-trail completeness for auth events**
Login, logout, SSO assertion, and failed login are not consistently written to `AUDIT_KV`. This is a SOC 2 CC6.1 / CC6.3 gap.
- _Action:_ Ensure every auth handler writes `audit.write()` with `action`, `user_id`, `ip_hash`, `result` (success/failure). Add a CI grep gate that rejects new auth routes without an audit call.

---

## 3. AI Features (Wizard, Copilot, Insights, Sentiment, Coaching, Recap)

**Current state:** AI wizard (SSE generation + refinement with grounding hash), Copilot context routes, live coaching, sentiment lib, insights daily, AI badge provenance, Workers AI only (no egress). **Status: 🟡 Needs polish**

### Gaps & polish actions

**3a. AI wizard consent UX needs enterprise-grade transparency**
`ai_consent_at` is stored but the consent UI is a single checkbox. Enterprise procurement teams ask: "what data leaves the tenant?" — the answer (nothing, Workers AI only) is a strong moat but it isn't visible in the product.
- _Action:_ Add an expandable "How Qesto AI works" disclosure on the wizard consent step listing: model name, no data retention, EU-only inference, no third-party egress. Link to the GDPR trust page. Persist per-team AI policy (allow/deny AI features) in team settings.

**3b. AI copilot is not yet surfaced in the run screen UI**
The copilot context routes exist but the live presenter panel showing AI suggestions during a session is not in the shipped frontend (per the competitive epics doc — "presenter copilot UI" is listed as net-new). This is the #2 competitive differentiator against Mentimeter's AI facilitator coaching.
- _Action:_ Promote COPILOT epic to Sprint 33. The copilot panel should be a collapsible sidebar on the run screen showing: next question suggestion, engagement signal (% responded), and a one-click "add follow-up question" from AI draft.

**3c. AI rate-limit visibility for users**
When AI generation fails due to rate limiting or a circuit-breaker OPEN state, users see a generic error. Enterprise users on high plans expect degraded-mode messaging ("AI is temporarily unavailable, your session continues normally") rather than a broken flow.
- _Action:_ Detect `CIRCUIT_BREAKER_OPEN` in the AI route handlers and return a structured `{ok:false,error:{code:'ai_unavailable',retryAfter:30}}`. Frontend shows a banner, not a modal blocker.

**3d. Cross-session Insights+ is the retention hook (INSIGHTS+ epic)**
Single-session AI summaries are table-stakes. What drives enterprise renewal is longitudinal intelligence — "what themes recur across all of Q2's sessions?" Enterprise L&D buyers specifically ask for trend dashboards.
- _Action:_ Prioritise the INSIGHTS+ epic (COMPETITIVE_EPICS #3). Minimum viable: a `/teams/:id/insights/themes` endpoint that queries DECISIONS_VECTORIZE with a date range and clusters recurring themes. Surface as a new "Insights" tab in the team dashboard.

**3e. AI-generated content labeling (provenance)**
`AIBadge` marks AI-generated sessions. But in exported reports, there's no indication of which questions were AI-generated vs. human-authored. Enterprise compliance teams require clear AI attribution.
- _Action:_ Add `ai_generated: boolean` per-question to the export payload (CSV, XLSX, future PDF). Include an AI attribution footnote in the PDF report header.

---

## 4. Gamification & Energizers (Energizers, Quick Finger, Team Quiz, Leaderboard, Badges)

**Current state:** ENERGIZING pre-session state with multiple energizer types (Balloon Pop, Emoji Pulse, Tug of War, Find Your Match, etc.); LIVE energizer WebSocket protocol shipped (Sprints 25–29); Quick Finger, Team Quiz, Leaderboard, badges all shipped. **Status: 🟡 Needs polish**

### Gaps & polish actions

**4a. Energizer content moderation**
Open-text energizers (e.g., Find Your Match answers) have no profanity screening. The Townhall backlog notes a `Todo` for Workers AI profanity screening (TOWNHALL-12). Enterprise HR clients are particularly exposed here.
- _Action:_ Implement `TOWNHALL-12`: run open-text energizer submissions through a Workers AI content filter before broadcasting. Reject with `{type:'error',code:'content_rejected'}` and show "Response flagged" to the submitter privately.

**4b. Leaderboard anonymization**
Leaderboard by default shows display names. For internal enterprise sessions (e.g., team training), employees may not want competitive visibility. The zero-knowledge mode disables the leaderboard entirely — but that's too blunt.
- _Action:_ Add a `leaderboard_display` setting per session: `names` | `aliases` | `hidden`. When `aliases`, the DO generates deterministic per-session pseudonyms (e.g., "Blue Falcon") and uses those on all leaderboard broadcasts.

**4c. Badge definitions are hardcoded**
Current badge hooks are deterministic but the badge types and thresholds are not configurable by the team. Enterprise L&D buyers want custom badge tiers (e.g., "Department Champion", "Top Contributor Q2").
- _Action:_ Move badge definitions to a `BADGES_KV` namespace keyed by team ID. Add a badge editor in Team Settings (name, icon URL, threshold type). Seed with Qesto defaults if no custom badges exist.

**4d. Gamification analytics**
`emitEnergizerMetric()` lacks `teamId`+`plan` fields (OBS-ENERGIZER-FIX-01). Without segmentation, there's no way to report to an enterprise customer "your teams completed 84% of energizers last month" — a key retention/expansion talking point.
- _Action:_ Ship OBS-ENERGIZER-FIX-01 immediately (it's already in the backlog). Add a "Gamification" tab in the admin analytics panel showing per-team funnel: activations → participants → completions → dropout rate.

---

## 5. Teams & RBAC (Custom roles, permissions, SCIM)

**Current state:** Base 5-role model shipped; custom role permission matrix built (Sprint 21); role management UI shipped; RBAC middleware enforces route-level permissions; SCIM routes mounted. **Status: 🟡 Needs polish**

### Gaps & polish actions

**5a. Delegated admin — org-level vs. team-level admin split**
Currently there's platform admin (superuser) and team owner. Large enterprises need an "org admin" role that can manage all teams under a domain without being a platform superuser. A customer IT admin should be able to reset SSO, provision members, and view billing for their org — without calling Qesto support.
- _Action:_ Add an `org_admin` role scoped to the organization/domain. Gates: can manage all teams in the org, can configure SSO, can view (not modify) billing. Requires the federation/organization layer (`mountOrganizationRoutes` is already mounted) to be fully wired.

**5b. Role assignment audit trail**
Role changes are not explicitly surfaced in the audit viewer (they may be in `AUDIT_KV` but not filterable). Enterprise security requires "who granted what role, when, and from where."
- _Action:_ Ensure every role assignment/revocation writes an audit event with `action: 'role.assigned'|'role.revoked'`, `actor_id`, `target_user_id`, `role_name`, `team_id`. Add a "Role changes" filter in the audit viewer.

**5c. Permission inheritance — guest/external users**
Guests invited via `POST /sessions/:id/invite/guest` have no role in the broader team. If a guest submits a decision and that decision is later recalled for a compliance audit, there's no identity anchor.
- _Action:_ Create a `guest` pseudo-role that is team-scoped, time-limited, and records `invited_by`. Include guest activity in the audit export.

---

## 6. Templates

**Current state:** Customer + Qesto template groups shipped (Sprint 22); template overview/confirmation flow; wizard seeding; 3+ templates per topic. **Status: 🟡 Needs polish**

### Gaps & polish actions

**6a. Template sharing across teams**
Templates are currently scoped to a single team or personal. Enterprise organizations with multiple teams want a "company template library" — a set of approved templates the org admin curates and teams draw from.
- _Action:_ Add `scope: 'personal' | 'team' | 'organization'` to the template model. Org-scoped templates are read-only for team members, editable only by org admins. Surface as a third group in the Templates tab.

**6b. Template versioning**
If a template is updated after sessions have been created from it, there's no way to roll back or see what version was used. For regulated industries (financial services, pharma training), this is an audit requirement.
- _Action:_ Add `version: number` and `parent_id` to templates. On update, create a new version instead of mutating. Keep the last 10 versions. Show "This template was updated since you last used it" banner in the wizard.

**6c. Template approval workflow**
For highly-regulated enterprise customers, a template needs to go through an internal approval workflow before it can be used for official sessions (e.g., HR surveys, compliance training).
- _Action:_ Add a `status: 'draft' | 'pending_approval' | 'approved' | 'retired'` to org-scoped templates. Org admins approve/reject. Only `approved` templates appear in the team picker. This is a gating feature for pharma/financial services verticals.

---

## 7. Integrations (Slack, Teams, Zoom, PowerPoint, Webhooks)

**Current state:** Integration provider library with AES-GCM token encryption (INT-PROVIDER-01 shipped Sprint 31); Slack, Teams, Zoom, Notion, Salesforce providers present; webhook routes mounted; PowerPoint embed. **Status: 🔴 Enterprise blocker**

### Gaps & polish actions

**7a. Slack and Teams result posting is not yet GA**
SLACK-01/02 and TEAMS-01 are planned for Sprint 33. These are the **#1 documented lost-deal reason**. Without "post results to Slack" working in a demo, enterprise deals stall.
- _Action:_ Pull Slack result posting into Sprint 32 as a hardened P0. Minimum: `POST /integrations/slack/send` posts a session summary card (title, top responses, participation rate) to a configured Slack channel. Ship a Slack App manifest in the docs.

**7b. Webhook reliability gaps**
`webhook-dlq.ts` and `webhook-sla.ts` exist but `DEVOPS-INT-SECRETS-01` notes the DO alarm vs. cron retry decision is not yet made. For enterprise integrations, a missed webhook with no retry is a trust-breaker.
- _Action:_ Adopt the DO alarm pattern (per `DEVOPS-INT-SECRETS-01`). Implement: 3 retries with exponential backoff, DLQ after 3 failures, a per-webhook delivery log visible in team settings ("Last 50 deliveries"), and an alert email to the team owner on 3 consecutive failures.

**7c. No integration status / health page in team settings**
Users have no visibility into whether their Slack/Teams/Zoom token is still valid. A silently expired OAuth token means results stop posting with no notification.
- _Action:_ Add an "Integrations" tab in Team Settings showing each connected integration: status (connected/expired/error), last successful sync, re-authorize button. Poll token validity on page load.

**7d. Zoom integration is a deal blocker for event organizers**
ZOOM-01 is the #2 documented loss reason for event organizers. The win-loss analysis calls it out explicitly.
- _Action:_ Accelerate ZOOM-01 to Sprint 33 alongside Slack. Minimum: on session close, post a results summary card to the Zoom meeting chat via Zoom REST API. Full OAuth flow already partially scaffolded.

**7e. PowerPoint add-in publishing**
`integrations/powerpoint` routes exist but there's no Office Store listing. Enterprise IT departments install add-ins via centralized deployment — an unlisted add-in requires a manual manifest upload per user.
- _Action:_ Publish the PowerPoint add-in to AppSource (Office Store). This is a GTM action, not a code change, but it unblocks the enterprise procurement path entirely.

---

## 8. Billing & Plan Gating

**Current state:** Stripe Checkout + Customer Portal, invoice history, plan middleware, entitlements matrix with contract tests (Sprint 20), referral codes, plan badge on dashboard. **Status: 🟡 Needs polish**

### Gaps & polish actions

**8a. Usage metering and overage notifications**
When a team approaches their plan limit (session count, participant cap, AI generation quota), there's no proactive notification. Users discover the limit by hitting it mid-session — a catastrophic UX for an enterprise demo or all-hands.
- _Action:_ Add a `quota.ts` threshold alert: at 80% and 100% of any plan limit, send an in-app notification (toast + dashboard banner) and an email to the team owner. Triggered by the existing `tenant-quota.ts` module.

**8b. Annual billing and custom pricing**
Stripe Checkout only shows monthly pricing. Enterprise deals are almost always annual contracts with custom pricing and purchase orders.
- _Action:_ Add annual billing toggle to the Stripe Checkout session (already supported by Stripe `subscription_data.payment_behavior`). Add an "Enterprise pricing" CTA that opens a Calendly/HubSpot form (not an in-app flow). Ensure the billing portal shows the annual renewal date prominently.

**8c. Multi-seat / volume licensing**
Teams can invite multiple members but billing is per-team flat rate. Enterprise procurement expects per-seat or tiered volume pricing with a seat count selector.
- _Action:_ Add a `seat_count` parameter to the Checkout flow. Wire to a Stripe per-seat price. Show "You have X of Y seats used" in the billing section of Settings.

**8d. Invoice customization**
Stripe invoices go out with Qesto's default branding. Enterprise finance teams need invoices addressed to their company name with a PO number.
- _Action:_ Add a billing settings form: company name, billing address, VAT/tax number, PO number. Pass as Stripe `customer.metadata` and `invoice.custom_fields`. Render in the invoice PDF.

---

## 9. Compliance & Privacy (GDPR, Zero-knowledge, EU residency, Audit, CMK)

**Current state:** Zero-knowledge anonymity mode (ANON-DEPTH-01 shipped); GDPR trust page; GDPR respondent erasure; audit log (AUDIT_KV); CMK routes mounted (`lib/cmk.ts`); data residency routes (`mountResidencyRoutes`); DPA template planned Sprint 34. **Status: 🟡 Needs polish**

### Gaps & polish actions

**9a. GDPR deletion is not self-service for org admins**
Respondent erasure via the API exists but the UI for an org admin to trigger it without calling support is not surfaced. Under GDPR Art. 17, a deletion request must be actioned within 30 days. If it requires a support ticket, that SLA is hard to guarantee.
- _Action:_ Add a "Data deletion" section in Team Settings (org admin only) with: search by email, confirm-to-delete flow, confirmation email to the requester, and an audit log entry. Wire to the existing `gdpr-delete-user.ts` lib.

**9b. Data retention policy configuration**
Session data is retained indefinitely unless manually deleted. Enterprise customers (especially in the EU) need configurable retention policies (e.g., "auto-archive sessions older than 2 years, delete after 7 years").
- _Action:_ Add a `retention_policy` to team settings (configurable by org admin). Implement as a cron-triggered Worker that reads each team's policy from `TEAMS_KV` and soft-deletes eligible sessions. Log deletions to the audit trail.

**9c. CMK (Customer-Managed Keys) is not surfaced in the UI**
`lib/cmk.ts` exists but there's no UI for enterprise customers to configure their own KMS key. This is a hard requirement for financial services and healthcare.
- _Action:_ Add a "Encryption" section in the Enterprise settings panel: input for AWS KMS ARN or Azure Key Vault URI, test-connection button, status indicator. Restrict to Enterprise plan. Show a "CMK protected" badge on the session list.

**9d. SOC 2 Type I evidence collection is not yet started** (ENT-COMPLIANCE-01, Sprint 34)
Without a SOC 2 Type I, large enterprise procurement will require a security questionnaire that takes weeks to respond to manually.
- _Action:_ Start the SOC 2 Type I evidence framework in Sprint 32 (not Sprint 34). Tooling: use Vanta or Drata to auto-collect Cloudflare, Stripe, and GitHub evidence. The audit period should start immediately — every week of delay is a week of evidence lost.

**9e. Breach notification route exists but no customer-facing flow**
`mountBreachRoutes` is mounted. But there's no SLA-backed process visible to customers for "what happens if there's a breach."
- _Action:_ Add a public-facing "Security incident response" page under `/trust/security`. Document: detection → containment → notification timeline (72h to DPA, concurrent customer notification). Wire the breach route to auto-draft a notification email.

---

## 10. Admin Panel (Platform ops, analytics, user management)

**Current state:** Platform KPIs, live/historical metrics, user CRUD/suspend, engagement analytics (energizer funnel, CSV export), OPS health, multi-region admin routes. **Status: 🟡 Needs polish**

### Gaps & polish actions

**10a. Tenant-level admin view**
The admin panel is platform-wide (superuser only). Enterprise deployments need a tenant-level admin: a view showing one organization's usage, sessions, members, and billing without exposing other tenants' data. This is critical for a white-label or multi-tenant SaaS enterprise deal.
- _Action:_ Add an "Org overview" mode to the admin panel, accessible by `org_admin` role. Shows only their org's metrics. Separates platform admin (superuser) from org admin (customer IT).

**10b. Admin analytics export is not self-service for customers**
`POST /admin/metrics/export` is superuser-gated. Enterprise customers want to pull their own usage data into BI tools (Tableau, PowerBI, Looker).
- _Action:_ Add a `GET /api/teams/:id/analytics/export` endpoint (JM + Enterprise plan) that returns a usage CSV covering: sessions run, participants, question types used, AI usage, export count — for a configurable date range. This is distinct from platform admin.

**10c. Ops health dashboard is text-only**
`GET /admin/ops/summary` returns JSON but the admin tab shows a text dump. Operational incidents need visual triage: which circuit breakers are OPEN, what's the WS error rate trend, is D1 write latency spiking?
- _Action:_ Replace the text OPS tab with a sparkline/status-badge grid: each service (Resend, Stripe, Workers AI, D1, KV, DO) shows current state (green/amber/red) + 24h trend. Auto-refresh every 30s.

---

## 11. Townhall (Moderated anonymous Q&A at scale)

**Current state:** `mountTownhallRoutes` is mounted; described in COMPETITIVE_EPICS as a shipped epic. **Status: 🟡 Needs polish**

### Gaps & polish actions

**11a. Moderator queue UX**
The moderation queue (approve/reject/group/dismiss/mark-answered) needs to be a dedicated, distraction-free view — not a panel on the run screen. A moderator is often a different person from the presenter.
- _Action:_ Add a `/session/:id/moderate` route accessible to team members with `moderate_content` permission. Real-time moderation queue with keyboard shortcuts (A=approve, R=reject, G=group). Shows submitter pseudonym (never real identity) for context.

**11b. Upvoting deduplication**
Participants can potentially submit multiple upvotes for the same question by resending the WebSocket message. In a high-stakes all-hands, gaming the upvote order is a trust issue.
- _Action:_ Store `upvotes: Set<voterToken>` per question in DO state. Reject duplicate upvotes from the same voter token with a silent no-op (no error, just idempotent).

**11c. "Now answering" spotlight**
When the host moves a question to "answering" status, the participant view should visibly highlight it — large text, animation, transitions from the queue. Currently this is not differentiated from a regular question display.
- _Action:_ Add a `status: 'queued'|'answering'|'answered'` to townhall questions in DO state. Broadcast `townhall_question_spotlighted` when status → `answering`. Participant view renders a full-screen "spotlight" card with the question text and upvote count.

---

## 12. Public API & Developer Portal (v1/v2/v3, API keys, Webhooks)

**Current state:** Public API v1/v2/v3 routes mounted; API key management (`api-keys.ts`); developer portal (`mountDeveloperPortalRoutes`); webhook routes with HMAC + DLQ; OpenAPI v3 spec generated (`openapi-v3-spec.ts`). **Status: 🟡 Needs polish**

### Gaps & polish actions

**12a. API documentation is not publicly hosted**
`openapi-v3-spec.ts` generates a spec but there's no hosted Swagger/Redoc page. Enterprise developers expect to browse and test the API without asking for a spec file.
- _Action:_ Mount a Redoc or Swagger UI at `/developer/docs` using the generated OpenAPI spec. Auto-update on deploy. Add a "Try it" panel with sandbox API keys.

**12b. API key scoping**
API keys appear to be all-or-nothing. Enterprise integrators need scoped keys: `read:sessions`, `write:votes`, `read:insights` — so a BI tool can't accidentally write session data.
- _Action:_ Add a `scopes: string[]` field to API keys. Enforce in `api-abuse.ts` middleware. Show a scope selector in the developer portal key creation UI.

**12c. Webhook event catalog is undocumented**
The webhook routes exist but there's no published list of event types, payload schemas, or retry semantics. Enterprise integrators block on this during security review.
- _Action:_ Add a `/developer/webhooks` page listing all event types (`session.closed`, `vote.submitted`, etc.) with example payloads. Generate from `webhook-templates.ts`. Include retry policy and HMAC verification example.

**12d. Rate limit headers are not returned**
Enterprise API consumers need `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers to implement adaptive backoff.
- _Action:_ Update `rate-limit.ts` middleware to set these headers on every response, not just on 429. Add a `Retry-After` header on 429 responses.

---

## 13. Realtime Infrastructure (Durable Objects, multi-region, circuit breakers)

**Current state:** DO-backed session rooms; versioned message protocol (ADR-0005); circuit breakers for Stripe, Resend, Workers AI, JWKS; multi-region routing snapshot; distributed trace headers; reconnect-safe init snapshots. **Status: 🟡 Needs polish**

### Gaps & polish actions

**13a. Multi-region writes are not yet activated**
`multi-region.ts` and `multi-region-mutation.ts` exist and the routing snapshot is read, but actual write replication to a secondary region is not active. A DO bound to `colo=AMS` serves EU traffic fine, but a failover to `colo=ORD` on a AMS outage means session state is lost.
- _Action:_ Implement the Sprint 60–62 plan: DO write replication via `session-room-cross-region.ts`. Minimum viable: on DO eviction/colo failover, serialize state to R2 with a 1-minute TTL and rehydrate on the new colo. Wire to the circuit-breaker for the primary colo's availability check.

**13b. Session-level SLA visibility**
There's no mechanism for an enterprise customer to see the realtime health of their active sessions (e.g., "your session has a 2% reconnect rate right now"). This matters for large all-hands events with a dedicated AV team.
- _Action:_ Add a `GET /api/sessions/:id/health` endpoint (presenter-only, JO) that returns: participant count, vote rate (votes/min), reconnect count in the last 5 min, DO latency p50. Surface as a collapsible "Session health" panel on the run screen.

**13c. WebSocket message versioning enforcement**
ADR-0005 defines the v1 protocol envelope but the DO currently accepts both enveloped and bare messages for backward compatibility. Once enterprise integrators build against the API, an unversioned breaking change is catastrophic.
- _Action:_ Set a hard sunset date for bare-message support (suggest v1 support window: 6 months). Add a `deprecated` warning in the `init` snapshot: `{protocol:{version:'v1',bare_support_deprecated_at:'2026-12-01'}}`. Log bare-message usage per session to AE to measure adoption.

---

## 14. Observability & SLOs

**Current state:** Analytics Engine events, distributed trace headers, `slo.ts`, `observability.ts`, metrics KV, admin engagement analytics. **Status: 🔴 Enterprise blocker**

### Gaps & polish actions

**14a. No customer-visible uptime/SLA page**
There's no public status page (status.qesto.com or similar). Enterprise procurement always asks for an SLA and a link to current status. Without one, "99.9% uptime SLA" in the contract is unverifiable.
- _Action:_ Set up a public status page (Betterstack, Statuspage.io, or a static Cloudflare Pages site reading from `GET /api/version` health checks). Commit to publishing P1/P2 incidents within 15 minutes of detection. This is a GTM action but blocks enterprise procurement.

**14b. `slo.ts` error budget is not tracked**
`slo.ts` exists but there's no dashboard showing current error budget burn rate. If the error budget is exhausted, the deployment freeze should trigger automatically — currently it's manual.
- _Action:_ Add an SLO dashboard tab to the admin panel: 7-day/30-day error budget, burn rate sparkline, auto-freeze threshold. Wire to `METRICS_AE` data.

**14c. Vote latency end-to-end is not measured**
`OBS-VOTE-01` (vote.submitted AE event) is still in Sprint 30. Without it, there's no data to back the "sub-100ms global latency" claim required for PERF-PROOF-01 and enterprise procurement.
- _Action:_ Ship OBS-VOTE-01 immediately as a P0 blocker. The AE event must include: `vote_ts` (client submit), `do_recv_ts` (DO receive), `broadcast_ts` (DO broadcast to all). P50/P99 latency can then be calculated in AE queries.

---

## 15. Mobile / PWA

**Current state:** PWA push notifications (`mountPwaPushRoutes`, `pwa-push.ts`); responsive layout; i18n in 5 locales; QR code join flow. **Status: 🟡 Needs polish**

### Gaps & polish actions

**15a. Offline resilience for voter view**
If a participant's connection drops during voting, the vote is silently lost. A service worker could buffer the vote and retry on reconnect — this is especially important for mobile users in large venues with spotty WiFi.
- _Action:_ Implement a service worker vote buffer: on WS disconnect, queue pending votes in IndexedDB; on reconnect, replay if the question is still open (checked against the `init` snapshot). Show "Vote saved, reconnecting…" toast.

**15b. Native-app-like install prompt**
The PWA install prompt is browser-default. Enterprise IT wants to distribute the app via MDM (Mobile Device Management) — which requires either an App Store listing or a signed `.apk`/`.ipa`.
- _Action:_ Publish a TWA (Trusted Web Activity) wrapper to the Google Play Store and a WKWebView wrapper to the App Store. This is a packaging action, not a re-architecture. Required for enterprise MDM distribution.

---

## 16. Internationalization (EN/NL/ES/DE/FR)

**Current state:** 5 locale bundles, CI `check:i18n` gate, Sprint 71–80 i18n plan for additional locales. **Status: 🟡 Needs polish**

### Gaps & polish actions

**16a. Missing locales for target enterprise markets**
The DACH market (DE) is served, but enterprise deals in France (FR) frequently require formal/informal register distinctions in the UI. Japanese (JA) and Portuguese (PT-BR) are high-signal enterprise markets not covered.
- _Action:_ Add JA and PT-BR locale bundles as Sprint 71–80 scope. Partner with a native-speaker review process (not purely automated translation) for each new locale.

**16b. Date/number formatting is not locale-aware in exports**
CSV and XLSX exports use ISO 8601 dates and dot-decimal numbers regardless of locale. German users expect DD.MM.YYYY and comma-decimal.
- _Action:_ Pass `Accept-Language` (or user locale preference from `USERS_KV`) to the export handler. Use the `Intl.DateTimeFormat` and `Intl.NumberFormat` APIs (available in Workers) to format dates and numbers per locale.

**16c. RTL language readiness**
Arabic and Hebrew are not in the current plan but are increasingly requested by global enterprises. The Tailwind layout uses `ml-*`/`mr-*` directional utilities that would break in RTL.
- _Action:_ Migrate directional spacing to `ms-*`/`me-*` (CSS logical properties) across the component library as a Sprint 71–80 prerequisite. This is a low-risk migration that unblocks RTL without requiring an immediate locale addition.

---

## Summary: Priority Matrix

| Area | Status | Top action | Sprint target |
|------|--------|------------|---------------|
| Integrations (Slack/Teams/Zoom) | 🔴 | Pull Slack to S32; Zoom to S33 | S32–33 |
| Observability / status page | 🔴 | Public status page + OBS-VOTE-01 | S32 |
| SCIM provisioning completeness | 🔴 | RFC 7644 audit + Okta test harness | S33 |
| GDPR self-service deletion UI | 🟡 | Team settings deletion flow | S32 |
| AI copilot run screen panel | 🟡 | Promote COPILOT epic | S33 |
| Session capacity enforcement | 🟡 | Plan entitlement + DO cap | S32 |
| Webhook reliability (DO alarm + delivery log) | 🟡 | DO alarm retry + team settings log | S33 |
| SOC 2 Type I evidence start | 🟡 | Start Vanta/Drata immediately | S32 |
| API docs hosted (Redoc) | 🟡 | Mount at /developer/docs | S32 |
| Quota overage notifications | 🟡 | 80%/100% in-app + email | S32 |
| Question timer server-side enforcement | 🟡 | DO `closedAt` + contract test | S32 |
| Response moderation (open questions) | 🟡 | `moderated` flag + DO buffer | S33 |
| Cross-session Insights+ | 🟡 | INSIGHTS+ epic — team Vectorize query | S33 |
| Template org-level sharing + versioning | 🟡 | `scope` field + version chain | S33 |
| Leaderboard anonymization option | 🟡 | `leaderboard_display` session setting | S32 |
| CMK UI | 🟡 | Enterprise settings panel | S34 |
| Multi-region write failover | 🟡 | R2 state serialization on eviction | S60+ |
| RTL layout prep | 🟡 | Migrate to CSS logical props | S71+ |

---

_This document should be reviewed at each release-train planning session and items promoted to [`BACKLOG_ACTIVE.md`](./backlog/BACKLOG_ACTIVE.md) when committed to a train (cadence contract: [`RELEASE_TRAIN_MASTER.md`](./planning/RELEASE_TRAIN_MASTER.md))._
