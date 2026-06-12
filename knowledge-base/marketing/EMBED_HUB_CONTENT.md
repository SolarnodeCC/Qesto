---
id: EMBED_HUB_CONTENT
type: marketing
domain: marketing
category: messaging
status: active
version: 1.0
created: 2026-06-12
updated: 2026-06-12
tags:
  - embed
  - widget
  - marketing-copy
  - hub-page
  - developer
  - privacy
  - edge-latency
relates_to:
  - EMBED_ICP_AND_POSITIONING
  - BRAND_VOICE
  - ADR-0050
  - SPRINT87_PLAN
---

# EMBED Hub Page Content — Sprint 87

**Purpose:** Marketing hub copy for `/embed` public page. Targets community managers, L&D teams, SaaS product owners, event hosts, and LMS operators who want to embed live engagement into their own platform/website.

**Key message:** Privacy-first live engagement — drop a script, no vendor lock-in, realtime aggregate results, edge-native latency.

**Voice:** Human-first, room-aware (per BRAND_VOICE.md). Focus on what happens in the room when participants see results light up in real time, not the technical architecture.

---

## Hero Section

### Headline
**Bring your audience into conversations. Without sending them off-site.**

### Subheadline
Embed realtime polls, Q&A, and rankings directly into your platform or website. Privacy-first, fast, and yours to control.

---

## Pain Points Section

**Context:** Three consequences hosts face today when they use external polling tools or build nothing at all.

1. **Silence when you ask a question.** Participants hesitate to leave your experience; responses drop.
2. **Data scattered across platforms.** Participant feedback lives somewhere else; you lose the thread.
3. **Slow embeds that feel clunky.** Generic widgets take seconds to load on mobile and event WiFi.

---

## How It Works in 3 Steps

**Voice note:** Lead with the action the host *does*, not what the product does. Host job: mint → drop → it's live.

### Step 1: Mint an Engagement Token
Create a session in your Qesto team. Copy the embed token (scoped, short-lived). No sign-in needed — participants join with a code.

### Step 2: Drop the Snippet
Paste this one-line script into your website, course platform, or LMS:

```html
<!-- qesto embed snippet -->
<script src="https://embed.qesto.io/widget.js" data-session-id="..." data-token="..." data-origin="https://yoursite.com"></script>
```

Real token contract defined in [ADR-0050](../adr/ADR-0050-Embeddable-SDK-Auth-Widget-Origin-Sandboxing.md). Headless SDK also available for custom UI.

### Step 3: Go Live
Participants join with a code. Responses appear on your page in realtime. You stay in control; Qesto handles the rest.

---

## Feature Bullets

**Frame:** What the host can do with an embedded widget.

- **Ask any question format:** polls, rankings, consent votes, open-ended Q&A, knowledge checks
- **See results light up in real time:** as responses arrive, aggregate counts update (no refresh)
- **Anonymity control:** Full anonymous, cohort-masked, or identified — your choice per session
- **Mobile-first by default:** Touch-optimized. Works on event WiFi, intranets, weak networks.
- **No participant login required:** Join code only. Lower friction. Higher response rates.
- **Realtime themes from open questions:** AI-powered summaries surface automatically (Workers AI on Cloudflare edge)
- **Embed anywhere:** Any website, LMS (Canvas, Blackboard, Moodle), learning platform, or intranet
- **Export when ready:** Close the session, download data in bulk or send to your own analytics

---

## Developer Trust Section

**Context:** Address the fears of product teams and platform engineers integrating embedded widgets.

### Sandboxed. No Cross-Origin Data Leakage.

The widget runs in a strict `sandbox` iframe with `frame-ancestors` CSP per ADR-0050. PostMessage contract is origin-validated. The embed cannot access your page's data or cookies.

- **Origin allowlist:** You control which domains can load this embed token (set via API)
- **Read-only aggregate results:** Widget displays only aggregate counts, rankings, and themes — never participant identity
- **No hidden tracking:** Zero pixel or telemetry calls from the embed; no audience data sent elsewhere

### Scoped, Short-Lived Tokens

Your backend mints a token with limited scope: session ID, origin, and TTL. No account JWT exposed in the widget.

- **Token refresh loop:** Your backend can rotate tokens on a schedule (e.g., hourly for long-running events)
- **Per-API-key origin validation:** Different embed tokens can allowlist different domains
- **No vendor lock-in:** Token response includes the WebSocket endpoint so you can build a headless client

### Compliance & Audit Ready

Aggregate widget displays no personally identifiable information. Full audit log (with PII) stored server-side, encrypted at rest, never in the widget.

- **GDPR-by-default:** EU data residency available. Consent logs per participant (server-side only).
- **FERPA-ready:** LMS use case — embed stores no student identity in results view
- **SOC 2 Type II:** Qesto platform certified; embed inherits audit scope via ADR-0050 security boundary

---

## Outcome / Proof Tiles

**Frame:** What changes in the room when you embed live engagement.

| Value | Label | Note |
|-------|-------|------|
| **&lt;100ms** | Join-to-first-response latency | Widget served from Cloudflare edge; no cold start. [check:compliance-claims-comparative latency] |
| **85%+** | Typical participant response rate | No sign-in friction; join code only; realtime feedback loop. [check:customer-research-embed-pilots] |
| **3–5 min** | Time to first insight | Ask → responses arrive → themes surface (via Workers AI) → decision-ready. [check:product-evidence] |
| **50+ locales** | Supported languages | Realtime captions + theme summaries available in major languages (post-S88 CAPTIONS). [check:roadmap-CAPTIONS-ship-date] |

---

## FAQ Section

**Audience:** Product managers, L&D ops, event producers asking practical integration questions.

**Q: Can we integrate with our LMS (Canvas, Blackboard, Moodle)?**
A: Yes. Embed works inside any LMS via iFrame. Responses are counted in your Qesto dashboard and can be exported to your gradebook or analytics tool. Grade passback (automatic gradebook sync) is roadmap (after we hit ≥10 live embeds in production).

**Q: What if our participants are on mobile? Will it work on slow WiFi?**
A: Widget is 100% mobile-first and edge-cached globally. Response time is determined by distance to nearest Cloudflare edge (typical &lt;50ms in cities, &lt;200ms anywhere). Event WiFi latency doesn't apply — participants' device connects to the edge, not to your event infrastructure.

**Q: Can we build a custom UI instead of using the embed widget?**
A: Yes. Use the headless SDK. Mint a session, get a scoped token, use the realtime WebSocket contract directly. Full control over rendering. See the token response schema in ADR-0050.

**Q: Is it really GDPR-compliant? Where is the data stored?**
A: The aggregate widget itself stores no participant identity — only counts, rankings, and AI-generated themes. Full participant audit log (with PII) is encrypted at rest and not visible in the widget. Runs on Cloudflare edge; EU data residency available on request.

**Q: We use Typeform / Mentimeter today. Why switch?**
A: Typeform has no realtime. Mentimeter has realtime but slow cold starts and participants see results on a separate screen. Qesto embed gives you realtime + fast + aggregate-only (participant data never leaves your platform). No vendor lock-in; you own the participant relationship.

**Q: Will this increase our compliance risk?**
A: No. The aggregate widget itself is read-only and anonymized. You control anonymity settings per session. Audit log (for compliance review) stays server-side, encrypted. Runs under Qesto's SOC 2 Type II certification. See [privacy page](#).

**Q: What's the cost?**
A: Embed is included on all Qesto plans (Free, Pro, Enterprise). Free tier covers up to 50 participants per session. Pro tier ($X/month) unlocks unlimited participants + AI theme summaries. Enterprise pricing is custom.

---

## Bottom CTA Section

### Heading
Ready to bring your audience in?

### Subheading
Start embedding live engagement in minutes. No code review needed.

### Button Text
Launch your first embed

### Button Link
`/sessions/new?template=embed` or `/try-embed` (product team to define)

---

## SEO Metadata

**Meta title (≤60 chars):**
"Embed live polls | Privacy-first engagement widgets"

**Meta description (≤155 chars):**
"Drop a script. Realtime polls, Q&A, rankings—no vendor lock-in. Privacy-first embed for websites, LMS, platforms. Edge-native speed."

**H1 (page headline):**
"Bring your audience into conversations. Without sending them off-site."

**Primary keyword:**
`embed polls` · `engagement widget` · `realtime polling embed` · `privacy-first polls`

**Secondary keywords:**
LMS embed, course engagement, event polling, intranet polls, headless polling SDK

---

## Compliance Checks Before Launch

- [ ] **[CITATION NEEDED] Latency claim (&lt;100ms)** — load test results showing join-to-first-response p99 &lt;100ms on Cloudflare global network. Reference or run internal benchmark.
- [ ] **[CITATION NEEDED] Participant response-rate claim (85%+)** — embed pilot results from first 3–5 customers (S87–S88). Or label as "Typical outcome from early pilots" if not yet available.
- [ ] **[CITATION NEEDED] Time-to-insight claim (3–5 min)** — evidence from product testing or early customer session walkthroughs.
- [ ] **ADR-0050 acceptance** — required before messaging origin sandboxing and token scoping as "features"
- [ ] **Legal review — compliance claims** — all GDPR, FERPA, SOC 2 claims pass legal/compliance review before publication
- [ ] **Privacy page link** — `/privacy` or `/privacy/embed` page must exist and cover data residency, anonymity modes, audit log scope
- [ ] **Mobile smoke test** — load `/embed` page on iOS Safari and Android Chrome; verify widget renders, no overflow, touch targets ≥44px
- [ ] **Competitor URL spot-check** — verify Mentimeter & Typeform links (if included in final version) are current as of publication date

---

## Go-to-Market Sequence

1. **Day 1–7 post-launch:** Dev-focused content (GitHub Gist with working embed example, security audit summary, token-refresh loop code)
2. **Day 8–21:** Beta customer testimonials (course creator, intranet, event platform) focus on "no cold start" and "data stays in our platform"
3. **Day 22+:** Competitor comparison pages (`/embed/vs/mentimeter`, `/embed/vs/typeform`) anchored on privacy + latency
4. **Day 45+:** Warm outbound to LMS platform teams, community builders, SaaS platforms wanting to add engagement
5. **Day 60+:** Integrate with partner channel (Shopify app, Notion integration, Zapier)

---

## Handoff Notes

**To Frontend:** Copy assumes ADR-0050 is accepted and widget API is stable. Test snippet placeholder (`<!-- qesto embed snippet -->`) with real token response from backend before final publish.

**To Product:** Button link `/sessions/new?template=embed` or `/try-embed` needs to be wired up. Verify free-tier embed limit (50 participants) is enforced.

**To Sales:** Embed hub page is top-of-funnel; no lead capture form on `/embed` itself. Sales outreach to LMS/platform teams happens via warm intro (not form submission). See EMBED_ICP_AND_POSITIONING.md for sales plays.

**To Legal:** All [CITATION NEEDED] compliance claims require review before page goes live. Privacy claims (GDPR, FERPA, audit log scope) must be approved by legal.

---

## Activation Metric Reminder

**Live embeds** = session in EMBED mode with ≥1 participant response. This is the north-star input for the LEARN gate (S93) — must hit ≥10 live embeds before proceeding to LMS integration epic. Track via analytics and report weekly during S87–S92.
