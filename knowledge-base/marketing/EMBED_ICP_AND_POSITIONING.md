---
id: EMBED_ICP_POSITIONING
type: marketing
domain: marketing
category: positioning
status: active
version: 1.0
created: 2026-06-12
updated: 2026-06-12
tags:
  - embed
  - icp
  - positioning
  - developer-platform
  - widget
  - privacy
relates_to:
  - EMBED_HUB_CONTENT
  - COMPETITOR_PROFILES
  - BRAND_VOICE
  - ADR-0050
  - SPRINT87_PLAN
---

# EMBED ICP & Positioning — Sprint 87

**Sprint context:** E87 (Embeddable Platform) ships Sprint 87–88. LEARN gate (S93) requires ≥10 live embeds. Positioning must emphasize privacy-by-default, edge latency, and Developer Trust.

---

## EMBED ICP (Ideal Customer Profile)

### Primary Personas

#### 1. **Community & Course Creators**
- **Who:** Creators running online courses, workshops, training platforms (Teachable, Kajabi, Circle, Maven)
- **Job to be done:** Embed a live engagement tool into the course/community experience without losing participants to an external platform
- **Buying trigger:** "We need a poll/Q&A in our course without sending learners off-site"
- **Current state:** Using Typeform embeds (no realtime), Mentimeter (owned by external platform), or plain survey widgets (no interactivity)
- **Pain points:**
  - **Data fragmentation:** Learner responses scattered across multiple platforms, no single source of truth
  - **Latency and loading time:** Typeform embeds load slowly, disrupt the learning experience
  - **Privacy concern:** Course creators want to preserve learner data inside their own experience, not feed third-party SaaS
  - **Feature mismatch:** Generic form tools don't offer realtime polling, Q&A, or ranking (learning-specific needs)

#### 2. **Internal Comms & Intranet Owners**
- **Who:** Internal communications leads, HR ops, intranet managers running employee engagement programs
- **Job to be done:** Embed live pulse surveys, all-hands feedback, internal Q&A directly into the intranet or comms portal
- **Buying trigger:** "We want to run quick pulse checks inside Slack/Teams or our internal portal without bouncing employees off-site"
- **Current state:** Using Slido iframes, Mentimeter embeds (loading external widget), or Typeform for company-wide surveys
- **Pain points:**
  - **Cold starts & latency:** Embedded widgets take 2–5 seconds to load inside busy intranets
  - **Data sovereignty concern:** GDPR-sensitive employee input stored on third-party infrastructure; compliance headache
  - **Anonymity loss:** Embedded widgets still reveal IP/behavioral signals to the platform
  - **Context loss:** Employee feedback disconnected from intranet flow; low response rates

#### 3. **SaaS Product Owners (Embedded Engagement)**
- **Who:** Product managers, growth leads at SaaS platforms (e.g., Notion, Asana, Airtable, Slack app developers) wanting to add engagement features
- **Job to be done:** Embed interactive engagement (polling, consent, Q&A) into the app itself, as a native feature, with zero platform redirect
- **Buying trigger:** "Our users want to ask each other questions in-context; we need a lightweight, privacy-first polling API"
- **Current state:** Building custom polling UIs (effort), using Typeform/Mentimeter (users leave the app), or shipping nothing
- **Pain points:**
  - **Vendor lock-in:** Standard embed widgets control the user experience and data pipeline
  - **Latency:** SaaS users expect sub-500ms interactions; polling platforms are slow
  - **Privacy boundary:** Product teams want engagement data inside their own data model, not siphoned to a polling company
  - **Developer DX:** Standard embed codes are inflexible; want a headless SDK instead

#### 4. **Event Hosts & Hybrid Event Platforms**
- **Who:** Event organizers, conference organizers, webinar platform operators (Hopin, Sessions, etc.)
- **Job to be done:** Embed live polling, Q&A, or consent voting into the event experience (virtual + hybrid sessions)
- **Buying trigger:** "Our speakers/facilitators want live engagement without navigating to a separate tool; it must work on mobile"
- **Current state:** Using Slido, Mentimeter, Kahoot! on separate screens or unstable iframe embeds
- **Pain points:**
  - **UX fragmentation:** Speakers juggle multiple tools; participants get confused by the handoff
  - **Cold starts:** Network latency on event WiFi makes loading external embed widgets slow and unreliable
  - **Privacy perception:** Event organizers want to assure attendees data is not being sold; edge-native solutions feel more trustworthy
  - **Moderation complexity:** Embedded Q&A must handle abuse/spam without external review delay

#### 5. **LMS & EdTech Platform Teams**
- **Who:** Learning management system operators, EdTech platform engineers (Canvas, Blackboard, Moodle, etc.)
- **Job to be done:** Offer live assessments, knowledge checks, and engagement widgets to instructors, natively in the LMS
- **Buying trigger:** "We need to add real-time engagement to the LMS without forking code or managing external widgets"
- **Current state:** Using Blackboard Collaborate for webinars, Slido iframes (unstable), or building nothing at all
- **Pain points:**
  - **Grade sync complexity:** Polling platforms don't integrate with LMS gradebooks; instructors must export and re-import
  - **FERPA compliance:** LMS directors are cautious about third-party integrations; edge-native feels safer
  - **Performance at scale:** LMS sessions with 300+ students need sub-100ms polling response times
  - **Mobile reliability:** LMS users are often on weak networks; edge-cached responses matter

---

## Current Competitive Context: Where Embed Buyers Shop Today

### Typeform
- **Embed offering:** iFrame embed; no realtime (responses update on refresh)
- **Buyer experience:** "It works, but slow and not interactive"
- **Privacy:** Stored on Typeform cloud; European data residency available

### Mentimeter
- **Embed offering:** iFrame embed with realtime polls; dashboard on separate screen
- **Buyer experience:** "Realtime, but cold starts are 2–3s; requires speaker/moderator to monitor separate window"
- **Privacy:** Hosted on Mentimeter SaaS; data not edge-cached

### Slido
- **Embed offering:** iFrame embed with realtime; Cisco ecosystem (if enterprise)
- **Buyer experience:** "Realtime, but integrates tightly with Cisco products; feels heavy for standalone use"
- **Privacy:** Cisco-hosted; GDPR compliant but perceived as enterprise-only

### Kahoot!
- **Embed offering:** Limited embed; better as standalone
- **Buyer experience:** "Gamified and fun, but juvenile for corporate/academic use"
- **Privacy:** Kahoot-hosted; not privacy-first

### Custom Builds
- **Embed offering:** None; teams build polling UX in-house
- **Buyer experience:** "Full control but weeks of engineering work"
- **Privacy:** 100% owned

---

## Qesto EMBED Positioning Statement

**"Privacy-first live engagement widgets for teams who build platforms and communities."**

### One-Liner for Developers
"Drop a one-line script, get realtime polls + Q&A with zero cold start, full anonymity control, and no vendor lock-in."

### One-Liner for Buyers (Non-Technical)
"Bring your audience into conversations without sending them off-site. Edge-first, GDPR-by-default, fast."

---

## Three Differentiators (Developer + Trust)

### 1. **Anonymity-Preserving Aggregate-Only Widget**
**Why it matters:** LMS directors, intranet owners, and course creators are cautious about third-party data handling. Qesto's embed does not require participant sign-in and does not store participant identity in the aggregate view.

- Participants join with a join code; no account required
- Responses are anonymized at the edge (Cloudflare Workers)
- Widget displays only real-time aggregate results (poll count, ranking, themes)
- Read-only, aggregate-only data surface: the embed never returns participant details, just the room consensus
- Audit log (for compliance) stored server-side, never in the embed
- **Proof point:** "Embed origin can be allowlisted; no cross-origin data leakage via postMessage"

**Against:** Mentimeter, Slido (both store identifiable participant data in embeds), Typeform (no realtime, so privacy irrelevant)

### 2. **Edge Latency / No Cold Start — Sub-100ms Widget Load**
**Why it matters:** Embeds on intranets, event platforms, and LMS systems live in high-latency environments (busy networks, mobile, geographic spread). Cold-start latency kills adoption.

- Widget served from Cloudflare edge; same region as participant
- Realtime delta broadcasts (ADR-0038) mean participants see results light up as responses arrive, not in batches
- No external API calls on render; all state cached on edge
- Join-to-first-response: <100ms (industry baseline: 2–5s for Mentimeter/Slido)
- **Proof point:** "Deploy to 200+ edge locations globally; run `time curl -w '%{time_total}' https://embed.qesto.io/...` for latency"

**Against:** Mentimeter (cold starts 2–3s), Slido (cloud-hosted latency), Typeform (no realtime)

### 3. **One-Line Embed Snippet (Developer Trust + Control)**
**Why it matters:** SaaS product teams, developers, and platform engineers want minimal surface area for security and integration. Custom token scoping (via ADR-0050) means platforms own the auth boundary.

- Snippet: `<script src="https://embed.qesto.io/widget.js" data-session-id="..." data-token="..."></script>`
- Scoped, short-lived embed tokens (no account JWT in the widget)
- Sandboxed iframe: strict `frame-ancestors` CSP; origin allowlist per API key
- Headless SDK available for platforms wanting to build custom UI
- No hidden tracking; origin validation via postMessage contract
- **Proof point:** "GitHub Gist showing snippet + token-refresh loop; iframe sandbox attribute hardened per ADR-0050"

**Against:** Mentimeter, Slido, Typeform (all rely on generic iFrame embeds; no developer scoping or origin isolation)

---

## Objection Handling

### "Will it work on our network? Our event WiFi is slow."
**Response:** Qesto embed is edge-cached at 200+ Cloudflare locations. Participant latency is determined by their distance from the nearest edge location, not your event WiFi. Worst-case latency is <200ms globally; typical <50ms in urban areas. Typeform/Mentimeter depend on round-trip to cloud data center (2–5s).

### "What if participants are on mobile? Will the widget be responsive?"
**Response:** Widget is 100% mobile-first. Renders at any width; touch-optimized. Anonymity modes simplify mobile UX (no login, join code only). Test at [placeholder demo link].

### "We use Typeform/Mentimeter today. Why switch?"
**Response:** Typeform has no realtime. Mentimeter has realtime but slow cold starts and requires participants to see results on a separate screen. Qesto embed gives you realtime + fast + aggregate-only (so your data doesn't leave your platform).

### "Can we integrate with our LMS?"
**Response:** Embed works standalone inside any LMS (Canvas, Blackboard, Moodle via iFrame). For grade passback (moving scores into gradebook), that's the LEARN epic (S93+, requires ≥10 live embeds to gate). Embed alone is read-only aggregate results.

### "Is it GDPR-compliant?"
**Response:** Yes. Aggregate widget stores no participant identity. Audit log (for access review) is encrypted at rest and not visible in the embed. Runs on Cloudflare edge with EU data residency option. See [privacy page].

### "What if we want a custom UI?"
**Response:** Headless SDK available. Mint a session, get back a scoped token, use the realtime WebSocket contract directly. Full control.

---

## Activation Metric: Live Embeds

**Definition:** A "live embed" is a session running in EMBED mode (iframe or headless SDK) with ≥1 participant responding in realtime.

**Why this metric:** 
- Validates that the widget works in production environments outside Qesto-owned pages
- Unambiguous: countable, auditable (logged in `DECISIONS_VECTORIZE` metadata, tagged `embed=true`)
- Gated by LEARN (S93) — must hit ≥10 live embeds before proceeding to LMS integration epic

**Measurement:**
- `session.embed_mode = true` in D1
- `session.status = 'closed'` (completed session)
- `n_participants > 0` (at least one response)
- Query: `SELECT COUNT(DISTINCT session_id) FROM sessions WHERE embed_mode=true AND status='closed' AND n_participants>0 AND closed_at > DATETIME('now', '-30 days')`

**Tracking (Sprint 87–92):**
- S87: First 2–3 friendly-customer embeds (internal validation)
- S88–S90: Sales/Customer Success drives 5+ enterprise pilot embeds
- S92: Hit ≥10 target before S93 LEARN gate decision

**Customer cohort:** Community managers, LMS ops, intranet teams running pilot integrations

---

## Go-to-Market Sequence (Top of Funnel)

1. **Developer Trust** (Day 1–14 post-launch): Code examples, security audit summary (origin isolation, token scoping), GitHub Gist template
2. **Use-Case Validation** (Day 15–30): Beta customer testimonials (course creator, intranet, event platform) — focus on "no cold start" and "data stays in our platform"
3. **SEO Ramp** (Day 31+): `/embed` hub page, `/vs/mentimeter` and `/vs/typeform` competitor pages (privacy angle)
4. **Sales Plays** (Day 45+): Warm outbound to LMS platform teams, community builders, EdTech platforms
5. **Partner Program** (Day 60+): Shopify app, Notion integration, Zapier trigger for embed-launch workflows

---

## Evidence & Gates

- **ADR-0050 accepted** — required before messaging origin sandboxing and token scoping
- **[CITATION NEEDED] Embed load time benchmark** — need internal load test results (JS bundle size, edge cache hit rate, p99 latency) before claiming <100ms in copy
- **[CITATION NEEDED] Competitor latency claim** — verify Mentimeter cold-start latency via public documentation or third-party benchmark
- **Compliance-claims audit:** All privacy claims must pass legal review before `/embed` hub ships

---

## Handoff Notes (to Sales & Partnerships)

1. Sales deck should focus on **privacy + no vendor lock-in** for SaaS product teams; **edge latency** for LMS/event platforms
2. Enterprise pilots will drive live-embed activations; coordinate with CS to onboard first 3–5 customers in S87–S88
3. Handoff to `/embed` hub page copy (see EMBED_HUB_CONTENT.md) happens post-ADR-0050 acceptance
