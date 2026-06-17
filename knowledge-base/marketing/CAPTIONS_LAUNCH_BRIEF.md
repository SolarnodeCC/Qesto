---
id: CAPTIONS_LAUNCH_BRIEF
type: marketing
domain: marketing
category: launch-brief
status: active
version: 1.0
created: 2026-06-13
updated: 2026-06-15
tags:
  - captions
  - live-translation
  - workers-ai
  - launch
  - accessibility
relates_to:
  - ACCESSIBILITY_MULTILINGUAL_POSITIONING
  - BRAND_VOICE
  - ADR-0051
  - SPRINT88_PLAN
---

# Live Captions & Translation — Launch Brief (Sprint 88)

**Context:** Sprint 88 ships live captions and real-time translation, powered by Workers AI on Cloudflare's edge. This brief guides launch messaging, feature-focused copy, and objection handling. Coordinate timing with `ACCESSIBILITY_MULTILINGUAL_POSITIONING.md` (WCAG AAA story) and the `/accessibility` hub page.

---

## Hero Message

**"Everyone reads what's being said — in their language, in real time."**

### Subheading (Supporting Promise)
"Live captions and translation powered by edge-native AI. No audio leaves the room. No setup required."

---

## The 3-Step Value Story

### 1. **Turn on captions** (one toggle)
- Host enables captions when starting a session
- No third-party integrations, no separate transcription service
- Participants see captions appear as people speak, in real time
- Works in all session modes (Q&A, polling, open discussion)

### 2. **Everyone reads in their language** (no session restart)
- Participants select their preferred language on join
- Captions and question text auto-translate
- No need to rejoin or navigate to a language-specific session
- Results aggregate across all languages (participants see the same consensus, not fragmented votes)

### 3. **Nothing leaves the edge** (zero data egress)
- Speech-to-text and translation both run on Cloudflare's edge via Workers AI
- Audio is never stored, never sent to Google/Otter/AWS/Azure
- Captions themselves are stored (for session recap); source audio is transient only
- GDPR-compliant by architecture, not policy

---

## Feature Bullets (Copy Guidelines)

**Principles:**
- Lead with the human benefit, not the technology
- Each bullet ≤ 24 words
- Use brand voice: room-aware, peer-to-peer, specific over vague
- Flag quantitative claims (latency, language coverage, accuracy) for compliance review

### Core Feature Bullets

1. **Real-time captions in the moment**
   *Speakers don't need to slow down or repeat. Captions light up as words are spoken.*
   [check:compliance-claims] Latency claim

2. **100+ language pairs supported**
   *Participants choose their language on join. One session, multiple languages, zero fragmentation.*
   [check:compliance-claims] Language-pair count (validate against Workers AI MT model current scope)

3. **No third-party speech service**
   *Powered by Cloudflare Workers AI. Speech never leaves the edge. No Otter, no Google, no vendor lock-in.*

4. **GDPR-ready by design**
   *Transient audio buffers (never persisted). No international data transfer. No DPA required with external vendors.*
   [check:compliance-claims] GDPR compliance claim (legal review required)

5. **Participants control caption visibility**
   *Captions are on by default but toggleable. Respects the principle that accessibility is a feature for everyone, not a special mode.*

6. **Caption-aware Q&A ranking**
   *Ranked Q&A, consent votes, and polling all work seamlessly with live captions. No degraded UX for caption readers.*

### Objection-Handling Bullets (for FAQ / Sales)

- **"Will captions slow down the session?"**
  No. Captions are generated on the Cloudflare edge in your region, not routed to a cloud data center. Latency is <2s. Speech-to-text happens in the background; facilitators feel no delay.

- **"What if we need a language you don't support?"**
  [check:compliance-claims] Workers AI supports [list]. If you need a language outside that list, captions fall back to source language — no broken experience, just no translation for that participant.

- **"Does audio get logged for analytics?"**
  No. Audio is never persisted. Captions are generated, logged (for recap), then the source audio is discarded. No analytics, no profiling, no hidden retention. See the [architecture brief](ADR-0051) for details.

- **"How do we prove this to procurement?"**
  [check:compliance-claims] We provide a GDPR impact assessment and architecture audit confirming transient buffers and no third-party egress. Available for public-sector RFx.

---

## Privacy Proof Point (Core Value Differentiator)

### Why This Matters
Live captions are a compliance blocker for public-sector, education, and multinational orgs today. They want captions but can't use Otter.ai, Google, or Zoom because their legal teams block "international data transfer" or "third-party AI training data."

Qesto solves this at the architecture level: Workers AI on the edge = same-region processing = GDPR pre-compliant.

### The Proof
- **Architecture truth:** All speech-to-text and translation run on `c.env.AI.run()` (Cloudflare Workers AI), not a third-party vendor
- **Code review path:** `ai.ts` and captions route review confirms zero Anthropic/Google/Azure API calls
- **Retention policy:** Audio buffer TTL is 30s post-transcription; no backup, no audit logs of audio
- **DPA-free:** No Data Processing Addendum required because no third-party processes the audio
- **Regulatory evidence:** Available for EU public-sector RFx (GDPR/Data Protection Act compliance)

### Claim Validation (Before Public Copy)
| Claim | Status | Reviewer | Evidence |
|-------|--------|----------|----------|
| "Works AI only, no third-party ASR" | [check:compliance-claims] | DevOps + Security | Code audit of `ai.ts`; confirm `c.env.AI.run` only |
| "Captions <2s latency" | [check:compliance-claims] | AI engineer | Benchmark from real session; define conditions (language pair, audio quality) |
| "100+ language pairs" | [check:compliance-claims] | AI engineer | Current Workers AI MT model language matrix; update quarterly |
| "Transient buffers, 30s TTL" | [check:compliance-claims] | Legal + Security | Architecture spec in ADR-0051; GDPR impact assessment |

---

## Target Segments (Go-to-Market Angles)

### 1. **Public Sector & Government Procurement**
**Pain:** "We need captions but our legal team blocks Otter.ai. Compliance reviews take 8 weeks."
**Value:** "Captions via edge-native Workers AI. GDPR-compliant by architecture. Compliance sign-off in 2 weeks, not 8."
**Proof:** GDPR impact assessment + architecture audit available for RFx.

### 2. **Educational Institutions (K–12, Higher Ed)**
**Pain:** "Deaf and hard-of-hearing students need live captions. Video captions are post-hoc and slow."
**Value:** "In-session live captions with zero third-party. Students see captions at the moment of participation."
**Proof:** WCAG AAA core flows + live captions + no external service = full accessibility + compliance.

### 3. **Multinational / European HR & Internal Comms**
**Pain:** "We run all-hands across 5 countries in 4 languages. We want everyone to understand, but translation is manual or post-session."
**Value:** "Live translation. Same session, multiple languages. Participants see results in their language in real time."
**Proof:** One session with captions in DE, FR, NL, EN simultaneously; no setup complexity.

### 4. **Event Hosts & Conference Organizers (International Events)**
**Pain:** "Our audience is global. We want international accessibility but don't want to run parallel sessions or hire translators."
**Value:** "One session, captions in 100+ language pairs, automatic translation for any participant. WCAG AAA + live captions = universal welcome."
**Proof:** Demo: join a session, toggle language, see captions auto-translate.

---

## CTA (Call-to-Action) Language

**Hero CTA (Homepage, Features Page):**
"See how live captions work"
*not* "Learn more" or "Explore captions"

**Feature Page CTA:**
"Start a session with captions"
*not* "Enable captions" (participant-focused, not admin-focused)

**Objection / Sales Enablement CTA:**
"Review the GDPR impact assessment"
(for RFx buyers)

---

## Activation Metrics & Targets (S88–S90)

### What Success Looks Like

**S88 Launch:**
- ✅ Feature ships with toggle in session settings (host-controlled)
- ✅ Captions appear in all new-session flows
- ✅ Edge-to-participant latency <2s (internal benchmark)
- ✅ 100+ language pairs supported (Workers AI MT model current scope)

**S89–S90:**
- 🎯 **Captions adoption:** ≥25% of sessions with ≥10 participants have captions toggled on (tracked in session telemetry)
- 🎯 **Multilingual sessions:** ≥10% of new signups create sessions with ≥2 languages enabled (tracked in `sessions.lang_config`)
- 🎯 **Public-sector wins:** ≥2 public-sector pilots cite "compliance-ready captions" as decision driver (tracked in CRM)

### Measurement Approach

| Metric | Definition | Query / Signal | Owner |
|--------|-----------|--------|-------|
| Captions adoption | % sessions with captions toggled on (session.captions_enabled=true) | Telemetry; filter by n_participants ≥10 | Analytics |
| Multilingual sessions | % signups with ≥2 languages in session.lang_config | Telemetry; count distinct language codes per session | Analytics |
| Public-sector pilots | Won RFx mentioning "compliance-ready captions" as a factor | CRM source_reason = "captions_compliance" | Sales |
| WER (word-error-rate) | Mean % of words transcribed incorrectly across session languages | Real-session benchmark; report by language pair | AI engineer |

---

## Competitor Positioning (How Captions Differentiate)

### Main Competitors & Their Gaps

| Competitor | Live Captions? | Edge-Native? | Multilingual Session UX | GDPR Compliance Path | Verdict |
|---|---|---|---|---|---|
| **Mentimeter** | No native; requires post-hoc Otter/Rev | Cloud-only | English + post-export translation | Requires third-party DPA | Fails on captions + compliance |
| **Slido** (Cisco) | No native; Cisco ecosystem integrations | Cloud (Cisco) | Multiple language polls; not real-time together | Cisco DPA; heavy compliance review | Heavy lift for GDPR; no live translation |
| **Kahoot!** | No | Cloud | Basic; not real-time | Cloud-only | No accessibility story; juvenile brand |
| **Otter.ai** (standalone) | Yes, cloud-based | US data center | Cloud translator; requires international data transfer | DPA required; GDPR friction | Fails EU procurement (data egress) |
| **Google Meet** (as baseline) | Yes, cloud-based | US data center | Automatic translation; cloud-dependent | DPA required; Google's terms | Enterprise-only; not a polling tool |
| **Qesto** | ✅ Yes, edge-native (Workers AI) | ✅ Cloudflare edge (same-region processing) | ✅ One session, live translation, no fragmentation | ✅ GDPR pre-compliant (no third-party egress) | **Privacy moat** + **procurement win** |

### Key Messaging for Competitive Wins

**Against Mentimeter + Slido:**
"We've shipped live captions powered by Cloudflare Workers AI. You get real-time captions and translation without the GDPR friction your legal team has with Otter or Google. One session, any language, zero data egress."

**Against Google Meet / Zoom (as baseline):**
"Zoom and Google Meet are tools for video. Qesto is built for facilitation and participation. Live captions are built in, GDPR-compliant, and work across all interaction modes (polls, Q&A, rankings, consent) — not just transcription."

---

## Content Assets Required (Pre-Launch Checklist)

### Copy Assets
- [ ] **Feature page copy** (`/features/captions` or embedded on `/features`)
  - Headline, subheadline, feature bullets, FAQ answers (brand voice audit pass required)
  - [check:compliance-claims] Quantitative claims (latency, language count, accuracy)
  
- [ ] **Competitor vs. page** (`/vs/mentimeter#captions`, `/vs/slido#captions` sections)
  - Honest comparison table (captions, translation, compliance)
  - Migration guide snippet: "How to move from Mentimeter captions to Qesto"

- [ ] **Privacy + Compliance page** (dedicated `/privacy/captions` or section in `/trust/gdpr`)
  - Architecture summary (Workers AI only, no third-party egress)
  - GDPR impact assessment (summary for non-legal buyers)
  - Transient buffer lifecycle (30s TTL, no backup retention)
  - "Audit trail" offer for public-sector RFx

- [ ] **Sales Enablement**
  - Captions objection-handling guide (above)
  - Demo script: "How to set up captions in 30 seconds"
  - One-pager: "Why Qesto captions win public-sector RFx" (compliance-claims gated)

### Technical Assets
- [ ] **ADR-0051** (Captions architecture decision record)
  - Workers AI vs. alternatives analysis
  - Transient buffer lifecycle (30s TTL, no backup)
  - Language-pair coverage (current scope, roadmap)
  - WER targets and measurement approach

- [ ] **Security audit** (code review of `ai.ts` + captions route)
  - Confirm zero Anthropic/Google/Azure API calls
  - Confirm no logging of raw audio
  - Confirm edge-only processing (no multi-region copy, no cloud routing)

- [ ] **GDPR impact assessment** (for public-sector RFx)
  - Data minimization: transient buffers only
  - No international transfer (edge-local processing)
  - DPA-free architecture (no third-party processor)
  - Data retention policy (captions kept, audio discarded)

### Measurement Assets
- [ ] **Telemetry instrumentation** (shipped with feature)
  - `session.captions_enabled` (boolean)
  - `session.captions_language_config` (array of language codes)
  - `session.captions_visible_at_join` (timestamp, for engagement metrics)

- [ ] **Compliance review sign-off** (before public copy goes live)
  - Legal: "Captions + GDPR compliance claim approved for copy"
  - Security: "Code audit confirms Workers AI only, zero third-party egress"
  - AI: "WER benchmark and language-pair matrix validated"

---

## Launch Timeline & Handoff

### Sprint 88 (Build + Copy)
- **Week 1:** Finalize ADR-0051; obtain [check:compliance-claims] sign-off from legal + security
- **Week 2:** Complete feature-page copy (brand voice audit) + competitor `/vs/` pages
- **Week 3:** Captions privacy + compliance page + sales objection handling
- **Week 4:** Telemetry validation; final copy review + launch prep

### Sprint 89 (Amplification + GTM)
- **Week 1:** Soft launch (email to existing Chorus/Enterprise + invite beta customers)
- **Week 2:** Public feature announcement + competitor vs. pages live
- **Week 3:** Sales plays: warm outreach to public-sector prospects ("compliance-ready captions now live")
- **Week 4:** Measure S88 KPIs (captions adoption, multilingual sessions, public-sector interest)

### Handoff to Sales
- One-pager: "How captions close public-sector deals"
- Objection handler: "GDPR, data residency, third-party AI — all solved"
- Demo script: 30-second walkthrough of captions + language toggle
- GDPR impact assessment (for RFx attachments)

---

## Related Documents

- `ACCESSIBILITY_MULTILINGUAL_POSITIONING.md` — full positioning for the A11Y + multilingual story (WCAG AAA, audience segments, competitive angle)
- `BRAND_VOICE.md` — tone, pillars, vocabulary (follow scrupulously for all copy)
- `ADR-0051` — technical decision record for captions/translation pipeline
- `BRAND_VOICE.md` § "AI claims" — guidance on mentioning Workers AI in copy
- Competitor profiles in `knowledge-base/product/research/COMPETITOR_PROFILES.md` (reference for `/vs/` pages)

---

## Summary: What Claims Require [check:compliance-claims] Sign-Off

| Claim | Type | Review Owner | Evidence | Approved? |
|-------|------|-------------|----------|-----------|
| "Workers AI only, no third-party ASR" | Security | DevOps + Security | Code audit; zero Anthropic/Google/Azure calls | ⬜ TBD |
| "Captions <2s latency" | Performance | AI Engineer | Real-session benchmark report | ⬜ TBD |
| "100+ language pairs supported" | Feature scope | AI Engineer | Workers AI MT model current language matrix | ⬜ TBD |
| "GDPR-compliant by architecture" | Compliance | Legal | GDPR impact assessment; no international transfer | ⬜ TBD |
| "Transient buffers, 30s TTL" | Technical | Legal + Security | Retention policy document; buffer lifecycle proof | ⬜ TBD |
| "No backup or audit logs of audio" | Privacy | Security | Code review of persistence layer; confirm no logging | ⬜ TBD |

**Process rule:** None of these claims may appear in public copy (website, email, sales deck) until marked "✅ Approved."

---

## One-Line Soundbite (for all channels)

**"Live captions and translation on the Cloudflare edge — no third-party AI, no data egress, built for teams that include everyone."**
