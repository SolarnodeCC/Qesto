---
id: GOVERNANCE
type: guide
domain: governance
category: policy
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - governance
  - policy
  - guidelines
relates_to:
  - CONTRIBUTING
---

# Qesto copy deck

Canonical sentences for every Qesto surface. Paste directly. Every line here follows the content rules in `README.md` — sentence case, no exclamation points, AI claims focused on business value and privacy.

If you need a variant, **edit minimally**. If the variant breaks a rule (e.g. drops the AI anchor), it doesn't ship.

---

## 1. Hero headlines

Primary:
> Feel the pulse of the room, amplified by AI.

Alternates (same promise, different angle):
- Real-time decisions, private by default.
- Ranked evidence in the room, recap in your inbox.
- Live polling that survives the audit.
- Sessions that earn the decision.

## 2. Hero subheadlines (≤30 words)

- Live polling, ranked Q&A, and consent votes with AI drafting questions and summarising evidence — all private, never shared with third-party providers.
- Draft in a minute, vote in a tap, recap the same day. Your responses stay private and never reach third-party providers.
- Every vote, consent round, and AI summary logged against the participants who were actually there.

## 3. CTAs (verb-first, page-specific)

Primary:
- Launch your next session.
- Start your first pulse.
- Run a consent round.
- Draft your questions.
- Open present mode.

Secondary:
- See the anonymity modes.
- Read the privacy policy.
- Review the consent model.
- Book a walkthrough.
- Browse session templates.

Ghost:
- Skip for now →
- Keep my draft
- Save and continue

**Banned CTAs:** Get started. Click here. Learn more. Try it now. Sign up free!

## 4. Feature-strip one-liners (≤14 words)

- AI-drafted questions in &lt;90s.
- Live results for every participant.
- Full, cohort, or identified anonymity — you choose per session.
- Responses stay private, always.
- Consent rounds before any recap leaves the room.
- Same-day summaries, anchored to ranked evidence.

## 5. Proof tiles (value ≤18 chars · label ≤30 chars · note ≤18 words)

| Value | Label | Note |
|---|---|---|
| &lt;90s | Brief to draft | Target · private AI analysis |
| &lt;200ms | Result update latency | p95 · real-time for all participants |
| 96% | Consent rate | Rolling · last 12 sessions · illustrative |
| 0 | Third-party model calls | All analysis stays private |

## 6. Empty-state copy

**No sessions yet**
> Your facilitator dashboard is quiet. Launch a pulse, a ranked Q&A, or a consent round — or start from a template.
> CTA: `Launch your first session`

**No participants connected**
> Waiting for the room. Share the join code or QR on screen. Participants can leave and rejoin without losing their votes.
> CTA: `Open present mode`

**Draft saved, not launched**
> This session is a draft. Review the anonymity mode on step 3 before you launch — participants will see it on the join screen.
> CTA: `Review anonymity`

**Consent declined (host view)**
> A participant declined consent. They stay in the room as a listener. Their device doesn't appear in vote totals.

**Consent declined (participant view)**
> You're joining as a listener. You'll see results, but your device won't appear in the vote totals or the AI recap.

**AI analysis unavailable**
> AI recap is temporarily paused. Your session continues as normal — polls, ranking, and the consent log are unaffected. The recap will draft when analysis resumes.

**No AI recap yet (session closed)**
> The recap is drafting now. This usually takes under a minute. We'll notify you when it's ready to review.

## 7. Error states

**Invalid join code**
> We don't have a session with that code. Check the screen at the front of the room — codes are 4–4 characters, letters and numbers.

**Session closed**
> This session ended 2 hours ago. Ask your facilitator if a follow-up session is scheduled, or review the recap they sent.

**Email format**
> Enter a full email address — we'll send the session invite here.

**Rate limited (participant)**
> Too many join attempts from this device. Try again in 30 seconds, or scan the QR code instead.

**Network lost mid-vote**
> Your vote is safe. Qesto is retrying in the background — leave this screen open.

## 8. AI-disclosure patterns (pick one per surface)

- Private AI analysis · you edit before it ships
- Drafted from your responses · never shared with third parties
- Analysis stays within your session
- Same-day recap · you edit, then send
- Private synthesis · no third-party model calls

Never use: "AI-powered", "powered by artificial intelligence", "our AI", "the AI thinks".

## 9. Session Wizard step captions

- `QUESTIONS · STEP 2 OF 5`
- `ANONYMITY · STEP 3 OF 5`
- `REVIEW · STEP 4 OF 5`
- `LAUNCH · STEP 5 OF 5`

Transition lines (between steps):
- Continue to anonymity
- Review before launch
- Launch when you're ready

## 10. Consent-round microcopy

**Host prompt**
> Ready to open a consent round? Every connected device votes yes or no. Without consent, the AI recap won't draft.
> CTA: `Open consent round`

**Participant prompt**
> Do you consent to an AI-drafted recap of this session? Your responses will be analysed privately and never shared with third-party providers.
> Options: `Yes, include my vote` · `No, I decline` · `Ask me again at the close`

**Consent result (mixed)**
> 34 of 38 participants consented. The recap will draft with the 34 consenting responses. Declined votes are counted in the live results but excluded from the summary.

## 11. Anonymity mode descriptions

- **Full** — No identifiers recorded. Not even roles or device IDs. Use when trust is the constraint.
- **Cohort** — Roles are recorded (e.g. "Engineering", "Design"). Names and devices aren't. Use for cross-team sentiment.
- **Identified** — Names are logged against responses. Use for boards, consent rounds, and audit-heavy rooms.

## 12. Footer legal (reusable)

> © 2026 Qesto · qesto.cc

Privacy footnote:
> All analysis stays private — your responses never reach third-party providers. Read the consent model.

---

## Rules of the deck

1. Sentence case everywhere except proper nouns (Qesto, Cloudflare, Workers AI, Stripe).
2. No exclamation points. Ever.
3. Every AI sentence pairs with an anchor from §8.
4. Every numeric claim is either measurable, labelled `Illustrative`, or removed.
5. CTAs are verb-first and page-specific.
6. Banned words: *revolutionary, seamless, leverage, synergy, unleash, next-generation, cutting-edge, game-changing, AI-powered (alone).*
