---
id: ACCESSIBILITY_MULTILINGUAL_POSITIONING
type: marketing
domain: marketing
category: positioning
status: active
version: 1.0
created: 2026-06-13
updated: 2026-06-13
tags:
  - accessibility
  - wcag
  - multilingual
  - captions
  - live-translation
  - public-sector
  - compliance
relates_to:
  - CAPTIONS_LAUNCH_BRIEF
  - EMBED_ICP_AND_POSITIONING
  - BRAND_VOICE
  - A11Y_FULL
  - ADR-0051
---

# Accessibility & Multilingual Positioning — Sprint 88

**Core narrative:** Qesto is the privacy-first engagement platform that is also the **most accessible and most multilingual by design** — inclusion as a differentiator and regulatory requirement, not an afterthought. This matters most to public sector procurement, universities, large multinationals running multilingual all-hands and works-councils, and event hosts serving diverse audiences.

---

## The Story: Inclusion Unlocks Reach

### Positioning Statement

**"The engagement platform where accessibility and privacy go together. WCAG AAA core flows + live captions and translation with zero data egress — built for teams and institutions that include everyone."**

### Why Now

Three converging forces make accessibility + multilingual a **category-defining differentiator**:

1. **Procurement mandates tightening.** EU public-sector procurement increasingly enforces **EN 301 549** (European accessibility standard, equivalent to WCAG 2.1 AAA for citizen-facing tech). US federal and education buyers enforce **Section 508** (WCAG 2.1 AA baseline; AAA increasingly expected). Qesto ships WCAG AAA on core flows (session join, voting, results reading) — competitors max out at AA.

2. **Global teams demand native multilingual UX.** Multinational orgs, associations, works councils, and global events no longer accept "English first, translation later." Qesto ships live captions + edge-native translation (no third-party data egress) in the session, not in post-processing. This unlocks new ICPs: associations holding member votes across 3+ languages, Eurozone HR teams running works councils, international universities, EU institutions.

3. **Privacy regulation becomes a feature gate.** GDPR + UK Data Protection Act enforcement is tightening on where voice/speech data can go. Live captions via Workers AI (edge-native, transient buffers, zero egress) address the pain point: "We need live captions but can't send audio off-premises." Competitors' solutions (Otter.ai, Google Live Translate, Microsoft Presenter Coach) all require cloud transcription service, failing compliance reviews in sensitive sectors.

---

## Job to Be Done (JTBD)

### Primary Buyer Segments

#### 1. **Public Sector & Government Procurement Teams**
- **Who:** Accessibility/procurement officers, IT directors running RFx evaluations for citizen-facing or employee-facing engagement platforms
- **Job:** "We need to run a public consultation, town hall, or regulatory hearing that meets EN 301 549 (or Section 508) and doesn't ask some participants to 'just deal with it.'"
- **Current failure mode:** Mentimeter, Slido, and Kahoot! are AA-at-best; no live captions; audio handled by third-party cloud vendors (non-compliant for GDPR-sensitive sectors).
- **Qesto unlock:** WCAG AAA core flows + live captions via Workers AI (edge-native, transient) = procurement criteria met, participants included, no compliance review delays.

#### 2. **Educational Institutions (K–12, Higher Ed, MOOCs)**
- **Who:** Accessibility coordinators, instructional designers, faculty running lectures with diverse learners
- **Job:** "We serve deaf and hard-of-hearing students, ESL students, and students with cognitive disabilities. Engagement tools must work for them, not exclude them."
- **Current failure mode:** Polling platforms offer generic AA compliance (keyboard nav, high contrast) but no live captions. Video/live-session captions are outsourced to Otter, Rev, or YouTube (post-hoc, slow, inaccessible in real-time).
- **Qesto unlock:** Live captions in-session (no external service), WCAG AAA keyboard / focus / motion handling, color-contrast checks on all UI states, reduces cognitive load on facilitators ("it just works for everyone").

#### 3. **Multinational / European HR & Internal Comms**
- **Who:** CHRO, L&D leads, internal-comms directors at companies with operations in 2+ EU countries, works councils, group-wide HR
- **Job:** "We run all-hands and town halls across 5 countries in 4 languages. Current tools force us to run parallel sessions or pick a dominant language — both exclude people."
- **Current failure mode:** Slido + manual post-session translation; Mentimeter with English default and no live translation; home-grown spreadsheet polls with human transcription (slow, error-prone).
- **Qesto unlock:** Live captions + edge-native translation (participants see responses in their chosen language in real-time) + WCAG AAA means no one sits out the conversation.

#### 4. **Associations, Unions & Governance Bodies**
- **Who:** Board secretaries, governance coordinators, membership directors running member votes and deliberative sessions
- **Job:** "We serve a multinational membership or geographically distributed constituency. Voting and deliberation must be transparent, accessible, and linguistically inclusive — it's a legitimacy requirement."
- **Current failure mode:** ElectionBuddy, Mentimeter, and bespoke voting tools all default to a single language and offer accessibility as a checkbox, not a core experience.
- **Qesto unlock:** Native multilingual voting (no separate sessions), WCAG AAA audit trails, live captions for deliberations, consent log compliance → faster RFx approval.

#### 5. **Event Organizers & Conference Hosts (Public-Facing)**
- **Who:** Event producers, conference organizers, virtual/hybrid event managers for public or large membership events
- **Job:** "Our event serves an international or neurodivergent audience. Polling and Q&A must feel welcoming, not gatekeeping."
- **Current failure mode:** Slido/Mentimeter embedded on screens; English default; no live captions; setup requires a second operator to manage accessibility (defeats the purpose).
- **Qesto unlock:** One tool, universally accessible (captions baked in, language-agnostic, no setup needed) = more participants, less liability, better NPS.

---

## Competitive Angle & Differentiators

### The Main Competitors (and Their Gaps)

| Competitor | AA Status | Live Captions? | Multilingual Session UX | GDPR-Compliant Speech Route | Verdict |
|---|---|---|---|---|---|
| **Mentimeter** | AA (reported) | No native; requires post-hoc service | English + translation post-export | Requires third-party ASR | Fails procurement on *both* axes |
| **Slido** (Cisco) | AA | No | Supports multiple polls per language; clunky UX | Cisco cloud | Heavy compliance review; not privacy-first |
| **Kahoot!** | A/AA (self-reported) | No | Basic; not real-time | N/A (no captions) | Juvenile positioning; accessibility second |
| **Poll Everywhere** | AA | No | English + clunky translation | Third-party | Aging platform; losing market share to Slido/Menti |
| **Typeform** | AA | No | Locale-aware defaults; no in-session translation | N/A | No realtime; embed-only |
| **Custom/Home-built** | Varies; usually AA | Rare (requires Otter/Rev integration) | Possible; high effort, slow | Varies | No SaaS economies; compliance burden all customer-owned |

### Qesto's Three Differentiators

#### 1. **WCAG AAA on Core Flows (Procurement Gate)**

**What it is:**
- Session join, voting interface, results display, keyboard navigation, focus management, color contrast, motion preferences — all tested and passing **WCAG 2.1 AAA** (zero violations, formal audit path).
- Broader app (settings, admin) maintains **AA** compliance while core session UX achieves AAA.
- [check:compliance-claims] — engineering must certify via `npm run test:eval` + axe-core audit + manual keyboard traversal.

**Why it matters:**
- Public-sector RFx now explicitly require "WCAG 2.1 AAA on critical user paths" (EN 301 549 harmonization).
- Competitors max at AA; AAA means procurement officers can recommend Qesto without a accessibility waiver.
- Reduces sales cycle friction: "Yes, we meet your accessibility mandate, full stop."

**Proof point:**
"All core session flows pass WCAG 2.1 AAA (tested via axe-core v4 and manual audit); broader app maintains AA. Formal accessibility statement available at [link]."

---

#### 2. **Live Captions + Translation with Zero Data Egress (Privacy Moat)**

**What it is:**
- **Workers AI on the edge:** Real-time speech-to-text + neural machine translation running on Cloudflare's edge, not a third-party cloud service.
- **Transient buffers:** Audio stream never persisted; only text embeddings (for translation context) are temporary, then discarded.
- **No third-party vendor:** Qesto's speech/MT pipeline bound entirely to `c.env.AI.run()` — no Otter.ai, Google Cloud Speech, Microsoft, or Anthropic API calls (hard rule per CLAUDE.md).
- **GDPR-compliant:** Edge processing + transient storage means no "international data transfer" risk, no DPA required with external ASR vendors, no consent-complexity explosion.
- [check:compliance-claims] — privacy/legal must certify that transient edge buffers meet GDPR/UK PDPA standards for the public-sector ICP.

**Why it matters:**
- Public-sector procurement officers' #1 objection to Mentimeter/Slido: "Our legal review blocks Otter/Google for speech data." Qesto solves this at architecture level.
- Multinationals running DACH/EU operations: "Can we run this in Ireland/Frankfurt?" Yes — edge-native means no data leaves the region.
- Reduces compliance-review timeline from 8 weeks to 2 weeks (no external DPA negotiation).

**Proof point:**
"Live captions and translation run on Cloudflare's edge via Workers AI. Audio is never stored or sent to a third-party service. Captions are available in 100+ language pairs with <2s latency. Edge processing means GDPR compliance without vendor complexity."

[Note: Claims on language-pair count, latency, and WER (word-error-rate) require engineering validation before copy goes live. Flag in compliance review.]

---

#### 3. **Multilingual Sessions as Default (Inclusion UX)**

**What it is:**
- **Same session, multiple languages:** Participants don't rejoin or navigate to a language selector. They see questions, results, and captions in their chosen language in real-time.
- **No session fragmentation:** Unlike home-built solutions (parallel sessions per language) or Slido (one language per poll), Qesto's session is linguistically agnostic — translation happens live, results aggregate across languages.
- **Accessibility + translation together:** Captions are auto-translated; participants who are deaf or hard-of-hearing can read captions in their native language (not just the question language).

**Why it matters:**
- EU/DACH legal requirement for works councils and member votes: "All participants must have equal access to the vote and deliberation, regardless of primary language."
- Reduces facilitator cognitive load: one session, zero setup complexity, participants feel included.
- Differentiates from Slido (language-per-poll) and Mentimeter (English + post-export translation).

**Proof point:**
"Participants choose their language on join; live translation means they see questions, results, and captions in their selected language. One session serves 1–100 languages without fragmentation."

[Note: "1–100 languages" is illustrative; actual number depends on Workers AI MT model scope. Validate with AI team before public claim.]

---

## Objection Handling

### "Will AAA certification slow down our release cycle?"
**Response:** WCAG AAA is a UX bar, not a process tax. Qesto's core-flow AAA (join, vote, results) is locked in at design time; new features adopt AAA patterns from component library (SkipLink, MainLayout, focus management, color-contrast tokens). No additional QA step for AAA features; it ships with the feature. Broader app stays AA while core paths stay AAA.

### "We use Slido today. Is the switch worth the migration effort?"
**Response:** Yes, if your RFx asks for AAA (Slido can't claim it), if you serve multilingual teams (Slido's language-per-poll model fragments your sessions), or if you need GDPR-compliant captions (Slido uses third-party ASR). If you run English-only events with no accessibility procurement gate, Slido works; Qesto is the upgrade when you need to include everyone.

### "What if I need captions in a language Workers AI doesn't support?"
**Response:** [check:compliance-claims] We support [list of language pairs from Workers AI MT model]. If you need a language outside that list, captions fall back to source language (no broken experience, just no translation). We prioritize high-demand EU languages (DE, FR, NL, ES, IT, PL) in S88 rollout; additional languages tracked in the roadmap.

### "Does 'edge' mean faster or just 'feels private'?"
**Response:** Both. Because captions are generated on the edge in your region (not routed to a US data center), latency is <2s, and GDPR compliance is immediate (no data leaves the edge). Edge also means no vendor lock-in: if another provider offers the same architecture, switching is a URL change, not a rearchitect.

### "How do I audit that audio isn't being stored?"
**Response:** Qesto's architecture log and security audit (ADR-0051) document the transient buffer lifecycle. Audio → text (on edge) → text discarded after translation (30s TTL). No persistence layer, no backup retention. GDPR impact assessment available for RFx. Captions themselves are stored (for the session recap), but never the source audio.

### "Do participants need to opt in to captions?"
**Response:** Captions are always on by default (no opt-in friction), but participants can toggle visibility. This respects the principle that accessibility is a feature, not a special mode — everyone benefits from reading real-time captions, not just deaf/hard-of-hearing participants.

---

## Claims Needing Compliance Review (check:compliance-claims)

Before `/accessibility` page or any public copy goes live, **flag these claims for legal + security review:**

| Claim | Status | Reviewer | Evidence required |
|-------|--------|----------|-------------------|
| "WCAG 2.1 AAA on core flows" | [check:compliance-claims] | QA (A11Y audit) + Legal | Formal axe-core audit report + manual keyboard traversal checklist + scoped statement ("core flows: join, vote, results; broader app: AA") |
| "Workers AI only, no third-party ASR" | [check:compliance-claims] | DevOps + Security | Code review of `ai.ts` confirming `c.env.AI.run` only; no Anthropic/Google/Azure calls in captions path |
| "Zero data egress" | [check:compliance-claims] | Legal + Security | GDPR impact assessment confirming transient buffers; retention policy doc (30s TTL, no backup); proof that audio stream is not logged/exported |
| "GDPR-compliant" | [check:compliance-claims] | Legal | DPA audit trail (none required if edge-native); Data Processing Addendum alignment if selling to EU public sector |
| "WER [X]% and <2s latency" | [check:compliance-claims] | AI engineer | Benchmark report from real session data; define conditions (language pair, audio quality, network); note variance ranges |
| "[N] language pairs supported" | [check:compliance-claims] | AI engineer | Hardened list of language pairs from Workers AI MT model; update quarterly as model improves |

**Process rule:** Any claim marked [check:compliance-claims] cannot appear in public copy (website, email, sales deck) until the reviewer marks it "✅ approved." 

---

## Activation Metrics & Targets

### What Success Looks Like (S88–S90)

- **Public-sector RFx:** Win ≥2 public-sector pilots (local government, education, association) in S89–S90.
- **Multilingual sessions:** ≥10% of new signups create sessions with ≥2 languages enabled (tracked in `sessions.lang_config`).
- **Accessibility audit adoption:** ≥50% of Pro/Enterprise teams run a formal WCAG audit on their session (tracked via `/api/audit` or feature telemetry).
- **Captions usage:** ≥25% of sessions with participants ≥10 have captions toggled on (tracked in session telemetry).

### Customer Research to Validate (Pre-Copy Launch)

Before finalizing positioning copy, validate with:
- **2–3 public-sector procurement leads** (EU + US): "Does WCAG AAA + live-captions positioning resonate? What gaps remain in your RFx?"
- **2–3 multinational HR leads** (DACH/EU): "Would you switch from Slido if you got native multilingual + live captions?"
- **2–3 association/governance heads** (EU): "What role does accessibility play in your member-vote legitimacy evaluation?"

Document findings in `/docs/RESEARCH/CUSTOMER_INTERVIEWS_S88_A11Y.md` (owned by knowledge team).

---

## Customer Evidence & Guardrails

### Research Artifacts (as inputs to positioning)

| Artifact | Location | Owner | Status |
|----------|----------|-------|--------|
| EU Procurement Accessibility Standards (EN 301 549, WCAG 2.1 alignment) | `docs/RESEARCH/` | Knowledge | Required before copy ships |
| Section 508 & ADA compliance landscape (US education/federal) | `docs/RESEARCH/` | Knowledge | Required before copy ships |
| GDPR + UK Data Protection Act guidance on speech/ASR | `docs/RESEARCH/` | Knowledge | Required for privacy claim validation |
| Internal A11Y audit report (scope: core flows, WCAG 2.1 AAA) | `knowledge-base/quality/accessibility/` | QA | Required for WCAG claim |
| Workers AI model coverage & language pairs (current) | `knowledge-base/specifications/domain/` | AI team | Update monthly; freeze before each copy release |

### No Claims Without Evidence

- **Competitor latency claims**: Cross-check public docs (Slido help center, Mentimeter blog) or dated third-party benchmarks (e.g., G2 review scores, not subjective marketing).
- **Feature completeness claims** ("Supports 100+ languages"): Document against Workers AI v4+ language-pair matrix, not aspirational roadmap.
- **WCAG/compliance claims**: Link to formal audit report or statement in copy itself (not hidden in an FAQ). Use scoped language: "WCAG 2.1 AAA on session core flows (join, vote, results display)."

---

## Handoff to Copy & Launch (Timeline)

- **S88 Week 1:** Compliance review of this document; flag any claim requiring evidence.
- **S88 Week 2:** Evidence collection (audit reports, GDPR assessment, language-pair matrix).
- **S88 Week 3:** `/accessibility` page copy drafted (use brand voice + pillars from BRAND_VOICE.md).
- **S88 Week 4:** Captions feature copy written (see CAPTIONS_LAUNCH_BRIEF.md) + competitor `/vs/*` updates.
- **S89 Week 1:** Final compliance review; launch.

---

## Related Documents

- `CAPTIONS_LAUNCH_BRIEF.md` — feature-focused launch messaging (WIP)
- `BRAND_VOICE.md` — tone, pillars, vocabulary (follow scrupulously)
- `A11Y_FULL.md` — technical baseline & test coverage
- `EMBED_ICP_AND_POSITIONING.md` — developer positioning (similar structure, reference for consistency)
- ADR-0051 — Live captions/translation pipeline (technical decision record)
