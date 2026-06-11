# Low-Priority Stories from Platform Review REV 2026-06-09

These seven groomed user stories derive from the 2026-06-09 full platform review. They address cleanup, dead code, and incremental product value—the LOW-priority tier of improvement opportunities. Each story carries testing criteria, story points, and implementation guidance from the review codebase verification.

---

## REV-39 — Shared Base Handler for DO Mode Handlers

**Story Points:** 5  
**Priority:** P3 (LOW)  
**Dependency:** Fold into REV-14 SessionRoom decomposition (tech-debt item TD-01)

**User Story:**  
As a backend maintainer, I want to extract a shared abstract base class for DO mode handlers (townhall, retro, ideate) so that I can eliminate duplication and reduce the cognitive load when adding new session modes.

**Acceptance Criteria:**

1. GIVEN a session DO enters LIVE state in a new mode (townhall, retro, or ideate), WHEN a participant submits a handler-specific message, THEN the handler dispatches through a shared base class that manages board state (load/persist), broadcast debounce, and participant validation — with zero changes to the WebSocket protocol or message schema.

2. GIVEN the shared base exists, WHEN the three mode handlers (functions/api/lib/session-room-townhall-handler.ts, session-room-retro-handler.ts, session-room-ideate-handler.ts) implement it, THEN all 90+ existing unit tests for these handlers pass without modification.

3. GIVEN the extracted base class, WHEN code review occurs, THEN duplication across the three handlers (currently ~390 LoC each, sharing submit/vote/moderate patterns) is eliminated by moving state-load, state-persist, broadcast, and participant-validation logic into the shared abstraction.

4. GIVEN the base class, WHEN a new mode handler is added in the future, THEN it can reuse the base's state-load/persist and broadcast contracts instead of reimplementing them.

5. GIVEN the abstraction, WHEN reviewing the SessionRoom DO, THEN the three mode handlers remain separate collaborator modules in `functions/api/lib/` extending the shared base.

6. GIVEN the refactor, WHEN running `npm test`, THEN all tests pass, and no type errors arise from `tsc --noEmit`.

**Implementation Notes:**

- The three handlers reside in `functions/api/lib/` and each is approximately 390 LoC.
- Shared patterns: per-mode board state (load from context.state, persist on message), debounced broadcast to DO participants, role-based participant validation.
- This story is explicitly a folding task into the larger REV-14 SessionRoom decomposition work.

---

## REV-44 — Subresource Integrity for Static Assets

**Story Points:** 3  
**Priority:** P3 (LOW)

**User Story:**  
As a security steward, I want static assets (JS/CSS bundles) deployed to Cloudflare Pages to carry cryptographic integrity hashes so that I reduce the attack surface for CDN or MitM tampering.

**Acceptance Criteria:**

1. GIVEN a Vite production build, WHEN the bundler emits hashed asset filenames (e.g., `app-abc123.js`, `style-def456.css`), THEN a post-build step computes SHA-384 hashes for each file and injects `<script>` and `<link>` tags with `integrity="sha384-…"` and `crossorigin="anonymous"` attributes into `dist/index.html`.

2. GIVEN the post-build step, WHEN the build completes, THEN the script returns a non-zero exit code and halts the build if integrity injection fails (e.g., hash mismatch, file not found).

3. GIVEN the injected SRI attributes, WHEN the site is deployed to Cloudflare Pages (preview environment), THEN all static assets load successfully and the browser verifies their integrity using the injected hashes.

4. GIVEN the post-build script, WHEN reviewing the implementation, THEN it follows the existing precedent in `scripts/build-tokens.mjs` (hand-rolled, zero new npm dependencies).

5. GIVEN the SRI attributes, WHEN a developer runs `npm run build` locally, THEN the injected hashes match the deployed bundles exactly.

**Implementation Notes:**

- Vite already emits content-hashed bundle names; the post-build step should inject hashes into `dist/index.html` after the Vite build completes.
- Precedent: `scripts/build-tokens.mjs` is a hand-rolled build-time utility—follow that pattern rather than introducing a new npm package.
- This is low-risk defense-in-depth for edge-deployed SPAs; CDN tampering is unlikely but SRI is a standard hardening layer.

---

## REV-46 — Profanity Pre-screen for Projector Surfaces

**Story Points:** 8  
**Priority:** P3 (LOW)  
**Dependency:** Reuse TOWNHALL-12 Workers AI screening approach

**User Story:**  
As a facilitator, I want participant-submitted text on public display screens (word clouds, open responses) to be automatically filtered for profanity so that I can maintain a professional environment when sharing results on a shared projector or monitor.

**Acceptance Criteria:**

1. GIVEN a session in LIVE state with a word-cloud or open-response question, WHEN a participant submits text and the facilitator has enabled profanity screening, THEN the text is passed through a Workers AI classifier (same pattern as TOWNHALL-12 moderation) before broadcast to `/display/*` surfaces.

2. GIVEN a text submission flagged as profane by the classifier, WHEN the moderator-review rule is applied, THEN the text is blocked from display surfaces and appears only in a "blocked items" view visible to the host/moderator.

3. GIVEN the screening service, WHEN latency is measured end-to-end, THEN the added inference latency is ≤300ms (measured at p95 across a 30-minute session with 50+ submissions).

4. GIVEN a zero-knowledge session with profanity screening enabled, WHEN text is screened, THEN no participant-identifying data or raw question text is logged or persisted in AUDIT_KV or analytics; only screening decisions (blocked/allowed) are recorded.

5. GIVEN the feature, WHEN the facilitator reviews settings for a new session, THEN a toggle to enable/disable profanity pre-screening is visible and defaults to off.

6. GIVEN a blocked item, WHEN the host opens the "blocked submissions" view, THEN they see the blocked text, the question it belongs to, and an override button to allow it to display anyway.

**Implementation Notes:**

- Reuse the Workers AI screening pattern from TOWNHALL-12 (town hall moderation pre-screen).
- This affects `/display/*` surfaces (public projector screens) where text is shown on a shared monitor.
- Word clouds and open responses are the primary display surfaces; other question types do not render participant text directly.
- Screening is optional (default off) and respects the zero-knowledge anonymity contract—no raw text is persisted in audit logs.

---

## REV-47 — Help Assistant Answer Ratings

**Story Points:** 3  
**Priority:** P3 (LOW)

**User Story:**  
As a knowledge steward, I want users to be able to rate help-assistant answers (thumbs up/down) so that I can identify gaps in KB coverage and prioritize documentation improvements.

**Acceptance Criteria:**

1. GIVEN the HelpChatWidget (src/components/HelpChatWidget.tsx) displaying an answer from the RAG help assistant, WHEN the user sees the response, THEN a pair of thumbs-up and thumbs-down buttons is visible below the answer.

2. GIVEN a user clicking thumbs-up or thumbs-down, WHEN the rating is submitted, THEN a POST is made to a new endpoint (e.g., `/api/help/rate`) that persists `{question-hash, doc-ids-from-sources, rating, timestamp}` to AUDIT_KV without storing the raw question text.

3. GIVEN an anonymous user rating a help answer, WHEN the rating is persisted, THEN no PII (name, email, session ID, IP) is stored; the record contains only a hash of the question and the rating signal.

4. GIVEN the rating data accumulating in AUDIT_KV, WHEN the knowledge steward runs a weekly aggregation, THEN they receive a report of: question hashes with low ratings, sources cited but marked as unhelpful, and coverage gaps.

5. GIVEN a user rating, WHEN they click submit, THEN the action is non-blocking (rating failure does not prevent them from continuing chat or closing the widget).

6. GIVEN the rating endpoint, WHEN the code is reviewed, THEN no raw question text is logged, and all PII sanitization follows existing AUDIT_KV conventions.

**Implementation Notes:**

- The HelpChatWidget currently lives in `src/components/HelpChatWidget.tsx`.
- Add thumbs-up/down UI elements below each assistant answer.
- Persist ratings to AUDIT_KV with a `help_rating:*` key pattern.
- The endpoint should hash the user's question (same salt as the AUDIT_KV key) so that multiple ratings of the same question can be aggregated.
- Weekly report is manual aggregation initially; can be automated later if it becomes a frequent steward task.

---

## REV-48 — Per-Tenant AI Cost Attribution Dashboard

**Story Points:** 5  
**Priority:** P3 (LOW)  
**Dependency:** Ties to ADR-0032 tenant quota attribution

**User Story:**  
As an ops engineer, I want to see per-team and per-feature aggregated AI inference costs (wizard, insights, copilot, help) on a dashboard so that I can operationalize ADR-0032 tenant quota attribution and inform future plan pricing.

**Acceptance Criteria:**

1. GIVEN existing `ai.inference` events flowing into Analytics Engine (METRICS_AE) with dimensions for feature (wizard/insights/copilot/help) and account (currently `account_id`), WHEN the ops team queries the metrics, THEN a new aggregation groups inference count and estimated cost by team_id and feature.

2. GIVEN the aggregation, WHEN AE data is available (typically 30+ seconds after ingestion), THEN a new `AdminAnalyticsTab.tsx` panel displays a table: team (hashed ID per existing convention) | wizard count | insights count | copilot count | help count | 30-day total cost (estimated).

3. GIVEN the dashboard, WHEN an ops user views the panel, THEN all dimensions use hashed team IDs (no plaintext team names or UUIDs) consistent with existing PII sanitization in AE events.

4. GIVEN the dashboard panel, WHEN a user requests a date range (e.g., last 7/30/90 days), THEN the query respects the range and re-calculates cost estimates.

5. GIVEN the data, WHEN the panel is rendered, THEN an "Export CSV" button at the bottom allows download of the current view as CSV (team hash, feature, count, cost, period).

6. GIVEN the feature, WHEN the code is reviewed, THEN the AE schema does not store raw team names or PII, and all queries use hashed identifiers per the analytics audit.

**Implementation Notes:**

- The `ai.inference` events already flow into METRICS_AE with feature and account dimensions.
- This story aggregates existing telemetry; no new event instrumentation is required.
- The AdminAnalyticsTab lives in `src/components/admin/` and already has sections for users and operations.
- ADR-0032 outlines the tenant quota attribution model; this story operationalizes the metrics side.
- Team hashing is already convention in the Analytics Engine (verified in existing admin queries).

---

## REV-49 — Recap Export to PDF

**Story Points:** 8  
**Priority:** P3 (LOW)  
**Gated:** Starter+ plan only

**User Story:**  
As a facilitator, I want to export a session's post-session recap (themes, vote breakdowns, top responses) as a PDF document so that I can present the results in a slide deck or share a formatted report with stakeholders.

**Acceptance Criteria:**

1. GIVEN a session in CLOSED or ARCHIVED state, WHEN the facilitator opens the Results view, THEN an "Export as PDF" button is visible alongside the existing JSON/CSV export options.

2. GIVEN the facilitator clicking "Export as PDF", WHEN the backend receives the request, THEN it renders the recap (session title, date, question summary, vote distributions, top themes, open-response excerpts) as a PDF document and returns it as a download.

3. GIVEN the PDF generation, WHEN evaluating implementation approaches, THEN the decision between Cloudflare Browser Rendering API and a pure-JS PDF library (e.g., jsPDF, pdfkit) is made explicit in a spike (2 pts) before full implementation, because Workers do not support headless Chromium in-process.

4. GIVEN the PDF export, WHEN the facilitator reviews the output, THEN it matches the Results view layout and styling (logo, session metadata, question breakdown, theme list with vote counts).

5. GIVEN the export, WHEN the feature is gated by plan, THEN only users on Starter tier or above can generate PDFs; Free users see a "Upgrade to Starter" prompt.

6. GIVEN the PDF, WHEN it is generated, THEN a loading spinner is shown during generation (estimated <5s for a typical 50-person session with 8 questions), and the user receives a clear success/error message.

**Implementation Notes:**

- Results are currently exported as JSON/CSV in `functions/api/routes/sessions/exports.ts`.
- A spike (2 pts) should evaluate Cloudflare Browser Rendering API (if available in Workers) vs. pure-JS PDF libraries before committing to the full implementation.
- PDF generation must happen server-side because Workers cannot run headless Chrome in-process.
- The feature is plan-gated to Starter+ (exports are already a Starter feature).
- PDF should include: session name, date, moderator name, question list with vote breakdown, themes with example excerpts, and a timestamp.

---

## REV-50 — First-Session Onboarding Checklist + Template Analytics

**Story Points:** 5  
**Priority:** P3 (LOW)

**User Story:**  
As a new user setting up my first session, I want to see a guided checklist (create session → add questions → test join → go live) so that I can quickly learn the happy path and activate as a facilitator.

**Acceptance Criteria:**

1. GIVEN a user who has logged in for the first time or created zero sessions, WHEN they land on the Dashboard, THEN a non-blocking onboarding checklist appears with four steps: (1) Create a session, (2) Add at least one question, (3) Test join as a participant, (4) Go live with the session.

2. GIVEN the checklist, WHEN the user completes a step (e.g., creates a session), THEN that step is marked complete with a checkmark, and the next step is highlighted with a subtle animation.

3. GIVEN the checklist, WHEN the user has already closed at least one session (appears in their session history), THEN the checklist is hidden and never shown again (checked via USERS_KV profile state).

4. GIVEN the checklist state, WHEN the user clicks a "Dismiss" button, THEN the checklist is hidden but can be re-enabled via a Dashboard settings toggle (stored in USERS_KV).

5. GIVEN a user completing the four steps, WHEN all steps are marked complete, THEN a "You're ready!" message appears with a confetti animation, and the checklist fades out after 3 seconds.

6. GIVEN the feature, WHEN the UI is rendered, THEN all checklist text is i18n-keyed for all five languages (EN, NL, ES, DE, FR) and a CI check validates that all keys are present in `public/locales/*/common.json`.

**Template Analytics Acceptance Criteria:**

7. GIVEN a user viewing the Templates tab, WHEN they click on a template, THEN an `aem_template_viewed` event is logged to METRICS_AE with `template_id` and `user_team_id` (hashed per convention).

8. GIVEN a user creating a session from a template, WHEN the session is created, THEN an `aem_template_session_created` event is logged with `template_id`, `session_id`, and `team_id`.

9. GIVEN a session created from a template, WHEN the session goes live, THEN an `aem_template_session_live` event is logged with the same dimensions.

10. GIVEN the three events flowing into METRICS_AE, WHEN an analytics query is run, THEN a conversion funnel (template viewed → session created → session live) can be calculated to measure the activation north-star metric.

11. GIVEN the events, WHEN they are logged, THEN no PII (user names, emails) is included; only hashed team IDs and event metadata.

12. GIVEN the analytics, WHEN a weekly activation report is generated, THEN it shows: templates with highest view/create/live conversion rates, which templates drive the most live sessions, and which templates have the highest drop-off between creation and going live.

**Implementation Notes:**

- Checklist state is stored in USERS_KV under a `onboarding_checklist:*` key.
- Checklist UI is rendered on the Dashboard (src/pages/Dashboard.tsx) as a non-blocking card or sidebar panel.
- Dismissal and re-enablement are both stored in the user's profile in USERS_KV.
- Template analytics events follow the existing METRICS_AE naming convention and are logged in the same handler where template/session creation occurs.
- All checklist strings (step titles, button labels, congratulations message) must have i18n keys.
- The CI check for i18n keys already exists in the build pipeline; ensure all new keys are added to the reference locale (EN) and at least placeholders to the other four.

---

## Not Groomed — Blocked or Resolved

**REV-36** — Tune KB rerank weights with eval telemetry (S, blocked on REV-10 eval harness).

**REV-37/38/40/41/42/43/45** — Resolved or moot per the 2026-06-10 review addendum:
- REV-37: Shared Vectorize query helper (completed—`lib/embedding.ts:firstEmbeddingVector`).
- REV-38: OAuth state-signing duplication (no real duplication; different mechanisms by design).
- REV-40: Zoom integration (complete as of Sprint 40; only `verifyWebhook` unimplemented and unused).
- REV-41: LinkedIn auto-posting (complete; `lib/linkedin.ts` + scheduler worker exist).
- REV-42: PWA inbox placeholder (deleted—entirely unreferenced).
- REV-43: Ideate clustering (is used; imported by `session-room-ideate-handler.ts:372`).
- REV-45: Public API token format validation (completed; `qesto_[0-9a-f]{32}` format gate in `middleware/public-api-auth.ts`).
