# Qesto Brand Voice — One-Page Card

**Audience for this card:** marketing, content, and i18n teams writing for solutions, features, and use-case pages.
**Anchor page (canonical voice expression):** `/features/privacy`.

---

## Voice in one sentence
Confident, evidence-first, never breathless. Sentences earn their length.

## What we sound like
- **Practical over poetic.** Specific verbs, concrete nouns, real numbers.
- **Peer-to-peer.** We address professionals who already know their craft (HR ops, facilitators, event producers, L&D leads, board secretaries) — we don't explain their job back to them.
- **Architecture-aware.** We talk about Cloudflare's edge, Workers AI inference, anonymity modes, and consent logs because those are the real reasons we are different.
- **Quietly confident.** No exclamation points, no superlatives, no "revolutionary".

## What we don't sound like
- "AI-powered" used as a standalone claim. Always anchor AI mentions to *what runs where* (Workers AI on Cloudflare's edge).
- Marketing filler: *seamless, leverage, best-in-class, world-class, cutting-edge, revolutionary, next-generation*.
- Vague metric tiles: a tile that says "Higher" with no defensible note should be replaced with a real number or removed.
- Empty empathy: "We get it — meetings are hard." Skip. Show the failure mode in one sentence and move to what we do.
- Em-dash sentence breaks for emphasis. We use them for parenthetical asides only.

## Vocabulary to favour
*decision evidence · consent log · anonymity mode (full / cohort / identified) · edge inference · Workers AI · facilitator-first · session-level · audit-ready · ranked Q&A · consent round · join code · same-day recap*

## Vocabulary to avoid
*revolutionary · best-in-class · world-class · seamless · leverage · synergy · unleash · next-generation · cutting-edge · AI-powered (alone) · game-changing · empower (when used as filler)*

## Numbers rule
Every number on the page must be defensible to a procurement reviewer. If it isn't, do one of three things:
1. Replace with a measurable claim ("`<90s` brief-to-draft" instead of "Faster").
2. Label the tile clearly: `Illustrative target` or `Internal benchmark`.
3. Drop the tile.

## CTA voice
- **Verb first.** "Launch your next session." "Review the consent model." "Run your first pulse."
- **No exclamation points.**
- **Page-specific where possible.** Privacy → "Read the privacy policy". HR → "See the anonymity modes". Nonprofit → "Talk to the governance team". Avoid "Click here" and "Learn more".

## AI claims (hard rule from `CLAUDE.md`)
Any sentence that mentions AI must be paired, in the same paragraph or the very next sentence, with one of:
- "on Cloudflare's edge" / "Workers AI on Cloudflare"
- "inside the same network as your session"
- "no third-party model providers"

If we cannot say one of those truthfully for a feature, the AI claim is inappropriate for that page.

## Page rhythm (template-aware)
- **Hero subheadline:** ≤ 30 words. One promise, one differentiator.
- **Pain points:** 3 items, ≤ 22 words each. Each names a *consequence*, not just a feeling.
- **Features / How-it-works:** 3–4 items, ≤ 24 words each. Lead with the verb the user does.
- **Outcome / Proof tiles:** value ≤ 18 chars; label ≤ 30 chars; note ≤ 18 words.
- **FAQ answers:** ≤ 80 words, written as if a buyer pasted them into Slack to share with a peer.
- **Bottom CTA:** heading ≤ 10 words, subheading ≤ 14 words.

## SEO hygiene
- **Meta title:** ≤ 60 chars. Primary keyword first.
- **Meta description:** ≤ 155 chars. Promise + differentiator.
- **H1:** Includes a noun phrase that matches user search intent (`anonymous pulse survey`, `live polling tool`).
- **Subhead:** Repeats the primary keyword once, naturally.

## Quality gate (run after every page draft)
1. `/marketing:brand-review` against this card — flag banned vocabulary.
2. SEO length check (title ≤ 60, description ≤ 155).
3. AI-claim audit (every AI mention anchored to Workers AI / edge).
4. JSON validity check on `solutions.json`.
5. Visual smoke test — render the page locally, check that no headline overflows the hero grid.
6. Trigger `/i18n` for `nl/de/fr/es` only after EN is approved.
