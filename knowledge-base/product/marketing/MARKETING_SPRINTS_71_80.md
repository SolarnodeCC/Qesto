---
id: MARKETING_SPRINTS_71_80
type: planning
domain: marketing
category: growth-strategy
status: active
version: 1.0
created: 2026-05-27
updated: 2026-05-27
tags:
  - marketing
  - growth
  - sprints-71-80
  - competitor-strategy
  - demand-generation
  - content-strategy
relates_to:
  - SPRINT60_70_PLAN
  - BACKLOG_MASTER
  - marketing.md (L2 skill)
---

# Qesto — Marketing Sprint Track S71–S80 (10-Sprint Horizon)

_Master plan: v3.0–v4.2 GTM execution (10 sprints, 130–160 pts/sprint across Marketing, Growth, and Sales Enablement)._

_Created_: 2026-05-27 (UTC) | _Aligned to_: [`SPRINT60_70_PLAN.md`](./knowledge-base/product/planning/SPRINT60_70_PLAN.md), Market Pulse integration (anonymity, GDPR, 50k scale, Zoom events, AI coach)

---

## Overview

This track covers **Growth & Marketing** deliverables for Sprints 71–80 (v3.0 GA through v4.2 feature parity):

- **Competitor positioning pages** (`/vs/[competitor]`) — SEO, win strategies, migration guides
- **Case studies + ICP research** — deep dives into Vevox, HR/L&D, event organizers, enterprise buy-in
- **Launch packs** (v4.1, v4.2, v5.0) — email sequences, sales materials, GTM checklists
- **Content strategy roadmap** — 12-month pillar topics, evergreen blog, SEO playbook
- **Email lifecycle + nurture flows** — signup sequences, feature adoption, reactivation, churn prevention
- **Sales enablement** — one-pagers, objection handlers, ROI calculators
- **Pricing & tier validation** — WTP studies, competitor benchmarking, packaging experiments

**Deliverable ownership**: `docs/EMAIL_SEQUENCES/`, `docs/SALES_KIT/`, `docs/PRICING_SPEC.md`, `docs/CONTENT_ROADMAP.md`, `docs/ICP_PERSONAS.md`, competitor pages in `src/pages/vs/`.

**Change coordination**: Pricing changes → raise to PO. New public routes → raise to frontend/PO.

---

## Sprint 71: Competitor Baseline (14 pts, Week of 2026-06-03)

**Goal**: Establish SEO-ready competitor pages for Mentimeter and Slido. Validate ICP positioning through market research.

| MKTG-ID | Item | Pts | Pri | Acceptance | Status |
|---|---|---:|---|---|---|
| **MKTG-71-01** | Competitor page: Qesto vs Mentimeter | 8 | P0 | `/vs/mentimeter` route; TL;DR box, 12-row feature table (realtime, privacy, pricing, AI), "who it suits best", migration guide with 3 case points; no fabricated claims; `check:compliance-claims` passes | Planned |
| **MKTG-71-02** | Competitor page: Qesto vs Slido | 5 | P1 | `/vs/slido` route; 10-row table (focus: Cisco lock-in vs. open, GDPR data residency, per-user pricing), competitive positioning vs. Mentimeter | Planned |
| **MKTG-71-03** | ICP research: Vevox market leadership (confidential) | 1 | P0 | Customer research doc (not public): 60+ anonymous-feedback mentions (Capterra/G2), Vevox feature depth (moderation, live discussion, employee voice), positioning gap vs. Qesto; informs ANON-DEPTH-01 GTM | Planned |

**Definition of Done**: Pages pass spell-check, comply-check, and SEO audit (meta descriptions, h1/h2 structure, internal links). Competitor claims backed by visible evidence (G2 reviews, public feature docs, pricing pages). Pages soft-launch to staging before production deploy in S72.

---

## Sprint 72: Competitor Expansion + Email Baseline (16 pts, Week of 2026-06-17)

**Goal**: Complete competitor suite (Kahoot, Poll Everywhere). Launch onboarding email sequence.

| MKTG-ID | Item | Pts | Pri | Acceptance | Status |
|---|---|---:|---|---|---|
| **MKTG-72-01** | Competitor page: Qesto vs Kahoot! | 5 | P1 | `/vs/kahoot` route; positioning: "serious facilitation for teams, not gamified classroom fun"; table: voting speed, adult UX, realtime insights, enterprise support | Planned |
| **MKTG-72-02** | Competitor page: Qesto vs Poll Everywhere | 5 | P1 | `/vs/poll-everywhere` route; positioning: "edge speed vs. cloud latency, modern UX, fair pricing"; 700-cap quote from SCALE-PROOF-01 research | Planned |
| **MKTG-72-03** | Email sequence: Onboarding (signup → first session) | 6 | P0 | 5-email sequence (HTML, Resend): Email 1 (welcome + Launchpad intro), Email 2 (create first session, 2d delay), Email 3 (join as participant, 3d), Email 4 (template gallery, 5d), Email 5 (upgrade prompt, 7d if no session). Trigger: `user.created`; tracking: `email.opened`, `email.clicked`, `session.created`. Sequence owner: `docs/EMAIL_SEQUENCES/ONBOARDING.md` | Planned |

**Dependencies**: SCALE-PROOF-01 research (S32) must land first for Poll Everywhere positioning accuracy.

**Definition of Done**: All competitor pages rank in top-10 for `qesto vs [competitor]` search by S74. Email sequence has >40% open rate baseline before optimization. Resend tracking wired to Analytics Engine.

---

## Sprint 73: Case Studies + Content Strategy (15 pts, Week of 2026-07-01)

**Goal**: Ship 2 detailed case studies. Define 12-month content roadmap aligned to ICP buyer journey.

| MKTG-ID | Item | Pts | Pri | Acceptance | Status |
|---|---|---:|---|---|---|
| **MKTG-73-01** | Case study: L&D leader (training team, 200 people, 15% engagement uplift) | 5 | P0 | Public page `/case-studies/l-and-d-transformation`; story arc (before: passive training, after: 15% engagement jump); quote + metrics; Qesto features highlighted (anonymity, AI recap, fast setup); CTA: request demo | Planned |
| **MKTG-73-02** | Case study: Event organizer (conference, 500 attendees, 8x faster polling) | 5 | P0 | `/case-studies/conference-engagement`; story (before: slow Zoom polls, after: realtime Qesto edge); metrics (poll speed 200ms vs 2s, NPS 8.5); 1 customer quote; integration with Zoom narrative | Planned |
| **MKTG-73-03** | Content roadmap: 12-month pillar topics + content calendar | 5 | P1 | `docs/CONTENT_ROADMAP.md`: 6 pillar topics (hybrid work facilitation, GDPR compliance, AI in meetings, energizer strategy, enterprise scale, realtime engagement), 30 article ideas ranked by intent/volume, 90-day priority content plan (blogs, webinar topics, SEO keywords); owned by Content team | Planned |

**Dependencies**: Vevox case study deferred until ANON-DEPTH-01 (S31) ships and benchmarks privacy differentiation.

**Definition of Done**: Case study pages drive >50 demo requests/month by S76 (measurement gate). Content calendar locked for H2 2026. Pillar topics → cluster mapping complete.

---

## Sprint 74: ICP Personas + Email Nurture (14 pts, Week of 2026-07-15)

**Goal**: Publish detailed ICP persona doc. Ship nurture sequences for warm leads.

| MKTG-ID | Item | Pts | Pri | Acceptance | Status |
|---|---|---:|---|---|---|
| **MKTG-74-01** | ICP personas v2: 5-persona detailed profiles | 5 | P0 | `docs/ICP_PERSONAS.md`: Facilitator (triggers, pain, solution fit), Event Host, HR Pro, Enterprise Buyer, AI Coach user; each persona: title, company size, KPIs, objections, objection handlers; linked to competitor positioning + case studies | Planned |
| **MKTG-74-02** | Email sequence: Product nurture (feature adoption for Pro/Enterprise) | 6 | P1 | 4-email sequence (HTML, Resend): Email 1 (congrats on paid upgrade), Email 2 (AI insights tutorial + link to docs, 1d), Email 3 (team member invite, 3d), Email 4 (advanced energizer setup, 5d). Trigger: `plan.upgraded`; gate: only for Pro+. Tracking wired to AE | Planned |
| **MKTG-74-03** | Email sequence: Reactivation (dormant teams 30d+) | 3 | P1 | 3-email reactivation: Email 1 (we miss you), Email 2 (new feature highlight + fresh template, 2d), Email 3 (special reactivation offer if exists, 4d). Trigger: `session.none_30d`; Resend tracking | Planned |

**Definition of Done**: ICP personas reviewed by Sales and PO. Email sequences pass A/B test framework (open rate, CTR, signup targets). Reactivation sequence starts by S75.

---

## Sprint 75: Sales Kit v1 + Pricing Validation (14 pts, Week of 2026-07-29)

**Goal**: Publish sales one-pagers, objection handler, ROI calculator. Validate pricing against WTP research.

| MKTG-ID | Item | Pts | Pri | Acceptance | Status |
|---|---|---:|---|---|---|
| **MKTG-75-01** | Sales kit: One-pagers (3 variants) | 5 | P0 | `docs/SALES_KIT/ONE_PAGERS/`: Product overview (1-page, features + pricing), L&D buyer brief (1-page, ROI focus), Event organizer brief (1-page, integration focus); PDF + Markdown for easy editing | Planned |
| **MKTG-75-02** | Sales kit: Objection handler | 4 | P0 | `docs/SALES_KIT/OBJECTION_HANDLER.md`: 10 common objections (price vs Mentimeter, data residency assurance, GDPR compliance, team adoption, technical setup, Zoom integration, export features, mobile app, custom branding, SSO). Each: statement, reframe, evidence, CTA. Shared with Sales + CS | Planned |
| **MKTG-75-03** | Pricing validation: WTP + competitor benchmark study | 5 | P1 | Confidential research doc: survey 50 ITMs + L&D leaders (pricing sensitivity, perceived value, competitor awareness); benchmark vs Mentimeter ($60–250/mo), Slido ($68–300/mo); recommendation: Pro tier positioning $99–150/mo, Enterprise custom (gate change → raise to PO) | Planned |

**Definition of Done**: One-pagers in Sales team repo. Objection handler reviewed by Sales + CS. WTP research completed, PO review signoff on pricing recommendation. Sales enablement training scheduled for S76.

---

## Sprint 76: Launch Pack v4.1 (16 pts, Week of 2026-08-12)

**Goal**: Produce comprehensive go-to-market package for v4.1 release (energizers depth + AI coaching).

| MKTG-ID | Item | Pts | Pri | Acceptance | Status |
|---|---|---:|---|---|---|
| **MKTG-76-01** | Launch pack: GTM checklist + timeline | 3 | P0 | `docs/SALES_KIT/LAUNCH_PACKS/V4.1_GTM_CHECKLIST.md`: pre-launch (week 1: QA, comms), launch day (social, email, PR), post-launch (week 2–4: support, metrics, feedback); owner assignments; go/no-go gate; measurable targets (adoption, NPS, churn) | Planned |
| **MKTG-76-02** | Launch pack: Email sequence (announcement + nurture) | 5 | P0 | 3-email launch sequence + embedded 2-email nurture: Announce (subject: "Introducing v4.1: AI-Powered Energizers + Live Coaching"), Feature deep-dive (AI coach explained, 2d), Customer success story (realtime replay, 3d). Trigger: release date + prior customers list. Resend + AE tracking | Planned |
| **MKTG-76-03** | Launch pack: Social media content plan (30-day calendar) | 4 | P1 | `docs/SALES_KIT/LAUNCH_PACKS/V4.1_SOCIAL_CALENDAR.md`: LinkedIn (5 posts: feature hints, customer quote, hiring), Twitter (10 posts: tips, feature announce, retweet), YouTube/webinar promo (1 webinar + 3 clips). Cadence: LinkedIn 2x/week, Twitter daily, YouTube weekly. Includes design asset links + alt text | Planned |
| **MKTG-76-04** | Launch pack: Sales one-pager (v4.1 highlights) | 3 | P1 | `docs/SALES_KIT/LAUNCH_PACKS/V4.1_ONE_PAGER.md`: Quick ref for Sales team (energizers overview, AI coach ROI, deployment story, competitive pitch vs Mentimeter + Slido). 1-page, editable by Sales | Planned |
| **MKTG-76-05** | Launch pack: Website hero update (copy + positioning) | 1 | P0 | Update `src/pages/index.tsx` hero copy: "Run live events with AI-powered insights" + subhead: "Energizers, coaching, and realtime engagement — all on the edge." Links to `/learn/energizers` + v4.1 release page | Planned |

**Dependencies**: v4.1 feature freeze must complete by S76 week 1 for marketing review and compliance-claim validation.

**Definition of Done**: Launch pack assembled and reviewed. All email sequences loaded into Resend by Friday S76. Social calendar pre-scheduled via Buffer or native tools. Go/no-go gate passed. First email ships at go-live +1h.

---

## Sprint 77: Cold Email Outreach + Webinar (15 pts, Week of 2026-08-26)

**Goal**: Launch cold email sequences to high-intent ICP segments. Announce educational webinar.

| MKTG-ID | Item | Pts | Pri | Acceptance | Status |
|---|---|---:|---|---|---|
| **MKTG-77-01** | Cold email sequence: HR professionals (ANON-DEPTH positioning) | 5 | P0 | `docs/COLD_EMAIL_SEQUENCES.md` - Segment: HR/L&D leaders at 100–5000 employee firms, budget $50k+. Sequence 1–5 (subject: privacy-first employee pulse → → → → ROI case study). Personalization: {company_name}, {growth_metrics}. Call-to-action: book 15m demo. Resend + HubSpot/Outreach tracking. Expected reply rate 5–8% | Planned |
| **MKTG-77-02** | Cold email sequence: Event organizers (Zoom integration narrative) | 5 | P1 | `docs/COLD_EMAIL_SEQUENCES.md` - Segment: conference/webinar hosts, 500+ attendee events. Sequence: faster polls than Zoom, realtime engagement, post-event replay, integration ready. CTR target: 3–5%. Trigger: identify via EventBrite/LinkedIn event organizer job titles | Planned |
| **MKTG-77-03** | Webinar: "Realtime Engagement at Scale" (50-min educational) | 5 | P1 | Live webinar (or on-demand recording): speaker (CEO/Head of Growth), topic: facilitation best practices + case study (Conference organizer 500-person event). Registration → email nurture → post-attendee follow-up sequence. Landing page: `/webinars/engagement-at-scale`. Resend invites, tracking. Target: 200 registrations, 50% attendance | Planned |

**Definition of Done**: Cold email sequences tested (Q/A review, spam check). Webinar speaker confirmed, deck drafted, landing page live, registration link tested. First email deploy week 1. Webinar scheduled for S77 midweek.

---

## Sprint 78: Content Hub Pivot + Product Guides (14 pts, Week of 2026-09-09)

**Goal**: Launch `/learn` content hub. Ship buyer's guides and "getting started" docs.

| MKTG-ID | Item | Pts | Pri | Acceptance | Status |
|---|---|---:|---|---|---|
| **MKTG-78-01** | Content hub: Architecture (6-page navigation structure) | 3 | P0 | `/learn` hub with 6 topic clusters: Facilitation Fundamentals (vs Zoom, meeting best practices), Privacy & Compliance (GDPR, zero-knowledge, SOC 2), Integrations (Slack, Teams, Zoom, webhooks), AI Insights (recap, sentiment, coaching), Energizers (types, strategy, templates), Enterprise (SSO, audit, custom branding). Each cluster has 4–6 articles linked internally | Planned |
| **MKTG-78-02** | Buyer's guide: L&D leaders (10-page PDF + web version) | 5 | P1 | `docs/BUYER_GUIDES/L_AND_D_LEADER_BUYING_GUIDE.pdf`: Chapter 1 (why realtime feedback matters), Chapter 2 (feature checklist vs Mentimeter/Slido), Chapter 3 (deployment checklist), Chapter 4 (ROI framework), Chapter 5 (case studies + testimonials). CTA: request demo. PDF + HTML version on `/learn/buyer-guides/` | Planned |
| **MKTG-78-03** | Getting started guide: 5-min video + walkthrough doc | 5 | P1 | YouTube video (5 min): create session → add question → invite participants → launch → see realtime results. Accompanying doc: `docs/GETTING_STARTED.md` (both Markdown and Notion embed). Linked from dashboard onboarding | Planned |
| **MKTG-78-04** | SEO: keyword research + high-priority article list | 1 | P0 | SEO audit doc: 20 high-intent keywords (realtime polling, employee engagement, meeting facilitation, GDPR-compliant tools, etc.), search volume, CPC, Qesto content gaps vs competitors. Prioritize: "realtime polling for meetings" (1.2k searches/mo), "GDPR employee feedback tool" (800/mo), "Zoom polling alternative" (2.1k/mo) | Planned |

**Definition of Done**: `/learn` hub live and indexed by Google. Buyer's guide downloaded >50 times by end S78. Video published to YouTube + embedded on `/learn`. SEO strategy locked for H2 content production.

---

## Sprint 79: Launch Pack v4.2 + Ad Strategy (16 pts, Week of 2026-09-23)

**Goal**: Release v4.2 GTM materials (enterprise compliance depth). Begin paid acquisition strategy planning.

| MKTG-ID | Item | Pts | Pri | Acceptance | Status |
|---|---|---:|---|---|---|
| **MKTG-79-01** | Launch pack: GTM checklist v4.2 (compliance + audit focus) | 3 | P0 | `docs/SALES_KIT/LAUNCH_PACKS/V4.2_GTM_CHECKLIST.md`: same template as v4.1, adapted for enterprise compliance narrative (SOC 2 badge, GDPR residency proof, audit trail, DPA support). Go/no-go gate criteria | Planned |
| **MKTG-79-02** | Launch pack: Email + social v4.2 | 4 | P0 | 3-email launch + social calendar (LinkedIn 5, Twitter 10); theme: "Enterprise trust starts with data sovereignty." Resend + Buffer scheduling | Planned |
| **MKTG-79-03** | Trust page: GDPR compliance hub (3-page deep dive) | 5 | P1 | Marketing page `/trust/gdpr`: GDPR architecture (edge-native, no 3rd party AI), EU data residency proof (Cloudflare London), processor list, DPA template, deletion procedure. Linked from pricing + competitor pages. CTA: request DPA | Planned |
| **MKTG-79-04** | Paid acquisition strategy (search + LinkedIn pilot) | 4 | P1 | Confidential strategy doc: Google search campaign brief (keywords, bids, landing pages, monthly budget target), LinkedIn campaign brief (audience: ITMs, L&D managers, event organizers; creative ideas; CPA targets). Pilot: $2k/month test over 60 days; success gate: CPA <$150. Requires PO/Finance approval | Planned |

**Dependencies**: v4.2 feature freeze by S79 week 1. Compliance claims cleared by `check:compliance-claims`.

**Definition of Done**: Launch emails scheduled. Trust page live and indexed. Paid strategy approved by PO and Finance. Google + LinkedIn campaigns set to go live in S80.

---

## Sprint 80: Campaign Execution + Measurement (15 pts, Week of 2026-10-07)

**Goal**: Execute paid campaigns, finalize launch pack for v5.0 roadmap, lock YE 2026 marketing metrics.

| MKTG-ID | Item | Pts | Pri | Acceptance | Status |
|---|---|---:|---|---|---|
| **MKTG-80-01** | Paid campaign execution: Google search (30-day run) | 3 | P0 | Deploy Google Ads campaigns (keywords: "realtime polling", "Zoom polling alternative", "GDPR employee engagement tool"). Landing pages: competitor comparison pages + `/learn` hub. Daily budget: $66 ($2k/mo). Tracking: GA4 + Resend leads pipeline. Report due S81 | Planned |
| **MKTG-80-02** | Paid campaign execution: LinkedIn (30-day pilot) | 3 | P0 | Deploy LinkedIn ads (audience: 100–5k employee firm ITMs + L&D). Creative: "Trust. Speed. Insights." → competitor pages + one-pagers. CPA target <$150. Daily budget: $66 ($2k/mo). Tracking: LinkedIn Ads + HubSpot lead form. Report due S81 | Planned |
| **MKTG-80-03** | Launch pack v5.0 roadmap: Planning doc | 3 | P0 | `docs/SALES_KIT/LAUNCH_PACKS/V5.0_ROADMAP.md`: v5.0 feature roadmap, GTM narrative (white-label expansion, partner portal, advanced compliance), email sequence ideas, social calendar template. Due by S80 EOW for S81 execution | Planned |
| **MKTG-80-04** | Marketing metrics baseline: YE 2026 performance report | 4 | P0 | `docs/METRICS/YE_2026_MARKETING_REPORT.md`: funnel metrics (signup conversion, free → paid, plan mix), content performance (blog traffic, webinar attendance), paid campaign ROI, email open/CTR rates, competitor page traffic, sales cycle velocity, NPS by cohort. Gating decision: continue paid acquisition into 2027? | Planned |
| **MKTG-80-05** | Website refresh: v3.0 GA announcement page | 2 | P1 | `src/pages/v3-ga.tsx`: v3.0 GA milestone announcement, release video, 2–3 customer testimonials, feature summary, upgrade CTA. Linked from homepage. Live for 2 weeks during S80 | Planned |

**Definition of Done**: Google and LinkedIn campaigns live and tracking conversions. v5.0 launch pack roadmap locked. YE 2026 marketing report complete and reviewed by leadership. Website refresh live. Measurement foundation ready for 2027 GTM scaling.

---

## Sprint-to-Sprint Dependencies

| Sprint | Blocker | Gate |
|---|---|---|
| S72 | SCALE-PROOF-01 (S32) shipped | Poll Everywhere competitor page accurate |
| S73 | Customer interviews completed (Q2 2026) | Case study quotes approved by customers |
| S75 | Sales + CS review | One-pagers and objection handler finalized |
| S76 | v4.1 feature freeze | Marketing compliance-claims audit passed |
| S77 | ICP list + lead database ready | Cold email sequences targeted correctly |
| S78 | `/learn` CMS provisioning | Content hub architecture ready for 50+ pages |
| S79 | v4.2 compliance deliverables (SOC 2, GDPR) | Trust page accuracy verified |
| S80 | Google & LinkedIn account setup | Paid campaign tracking configured |

---

## Estimation & Capacity Model

**Assumption**: 1–2 FTE marketing engineers (designer, writer, ops) per sprint.

| Sprint | Total Pts | Breakdown | Capacity Note |
|---|---|---|---|
| S71 | 14 | Competitor pages (8), research (6) | High-leverage baseline |
| S72 | 16 | Competitor pages (10), email (6) | Parallel work; email templating |
| S73 | 15 | Case studies (10), content strategy (5) | Requires customer access |
| S74 | 14 | Personas (5), email sequences (9) | Email template reuse |
| S75 | 14 | Sales kit (9), pricing research (5) | Cross-functional (Sales, PO) |
| S76 | 16 | Launch pack v4.1 (16) | Concentrated execution sprint |
| S77 | 15 | Cold email (10), webinar (5) | Event coordination required |
| S78 | 14 | Content hub (3), buyer guides (10), SEO (1) | Content-heavy; high touch |
| S79 | 16 | Launch pack v4.2 (7), trust page (5), ads strategy (4) | Finance/PO alignment gate |
| S80 | 15 | Campaign execution (6), v5.0 planning (3), metrics (4), website (2) | Execution + reporting |
| **Total** | **149** | | ~10–16 pts/sprint sustainable |

---

## Key Metrics & Success Gates

### Acquisition Funnel
- Competitor page organic traffic: >500 visits/mo by S75
- Cold email reply rate: 5–8% by S77
- Paid campaign CAC: <$150 (Google + LinkedIn combined)
- Webinar attendance: 50% of registrations

### Activation & Engagement
- Email open rates: >35% (onboarding), >25% (nurture)
- First session creation: >30% of signups within 7 days
- Case study page CTR: >3% → demo request

### Retention & Growth
- Reactivation sequence response: >10% (dormant team re-engagement)
- Sales cycle velocity: <30 days (free → paid)
- NPS baseline: >40 (by S75 survey)

### Content & SEO
- `/learn` hub pages indexed: >50 by S79
- Blog/resource page organic traffic: >200 visits/mo by S80
- Top-10 ranking for 3+ high-intent keywords by EOY 2026

---

## Deliverable Checklist

_All marketing work lives in `docs/` or public `src/pages/`. Update this at sprint close._

| Deliverable | Location | S71 | S72 | S73 | S74 | S75 | S76 | S77 | S78 | S79 | S80 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Competitor pages | `src/pages/vs/*.tsx` | 1 | 3 | — | — | — | — | — | — | — | — |
| Email sequences | `docs/EMAIL_SEQUENCES/` | — | ✅ | — | ✅ | — | ✅ | — | — | — | — |
| Case studies | `src/pages/case-studies/` | — | — | ✅ | — | — | — | — | — | — | — |
| Content roadmap | `docs/CONTENT_ROADMAP.md` | — | — | ✅ | — | — | — | — | — | — | — |
| ICP personas | `docs/ICP_PERSONAS.md` | — | — | — | ✅ | — | — | — | — | — | — |
| Sales kit | `docs/SALES_KIT/` | — | — | — | — | ✅ | — | — | — | ✅ | — |
| Launch packs | `docs/SALES_KIT/LAUNCH_PACKS/` | — | — | — | — | — | ✅ | — | — | ✅ | ✅ |
| Cold email sequences | `docs/COLD_EMAIL_SEQUENCES.md` | — | — | — | — | — | — | ✅ | — | — | — |
| Webinar | Live event | — | — | — | — | — | — | ✅ | — | — | — |
| Content hub | `src/pages/learn/` | — | — | — | — | — | — | — | ✅ | — | — |
| Trust/compliance pages | `src/pages/trust/` | — | — | — | — | — | — | — | — | ✅ | — |
| Metrics reports | `docs/METRICS/` | — | — | — | — | — | — | — | — | — | ✅ |

---

## Skill Loading & Guardrails

**Load skill** [`marketing.md`](/.claude/skills/marketing.md) before each sprint task.

**Apply guardrails**:
1. **No fabricated claims**: All competitor page claims backed by visible evidence (G2 reviews, public docs, pricing pages).
2. **Compliance gate**: All copy mentioning GDPR, EU residency, compliance, or latency must pass `check:compliance-claims` before merge.
3. **ICP alignment**: Case studies and personas must reflect Market Pulse findings (anonymity, GDPR, 50k scale, Zoom, AI coach).
4. **Pricing changes**: Any pricing tier update requires PO escalation before implementation.
5. **Public routes**: Any new `/vs/*`, `/case-studies/*`, or `/trust/*` page requires frontend coordination + `src/App.tsx` route mount.

---

## Q3–Q4 2026 Platform Narrative

**V3.0 GA** (S70 end): Mobile PWA, white-label foundations, admin analytics v3, trust badges shipped.

**V3.1–V4.1 GTM** (S71–S76): Competitor differentiation locked, content hub live, sales kit mature, v4.1 energizers + AI coach positioned as premium.

**V4.2–V5.0 Planning** (S77–S80): Enterprise compliance narrative (SOC 2, GDPR depth), integrations roadmap (Salesforce, LDAP), advanced white-label. Paid acquisition pilot data informs 2027 scaling.

---

## See Also

- [`marketing.md`](/.claude/skills/marketing.md) — L2 marketing skill (copywriting, email-sequence, competitor-alternatives, sales-enablement, content-strategy, cold-email)
- [`CLAUDE.md`](/CLAUDE.md) — Qesto L1 context + hard rules
- [`SPRINT60_70_PLAN.md`](./knowledge-base/product/planning/SPRINT60_70_PLAN.md) — main platform roadmap S60–S70
- [`BACKLOG_MASTER.md`](./knowledge-base/product/backlog/BACKLOG_MASTER.md) — product backlog (ICP research items, competitor positioning references)
- [`ROADMAP_FULL.md`](./knowledge-base/product/roadmap/ROADMAP_FULL.md) — v3.0–v4.2 release targets
- Market Pulse integration: [`MARKET_PULSE_INTEGRATION_2026-05-19.md`](./knowledge-base/product/backlog/research/MARKET_PULSE_INTEGRATION_2026-05-19.md)

---

_Last updated: 2026-05-27 (UTC) — Ready for sprint grooming and backlog refinement._
