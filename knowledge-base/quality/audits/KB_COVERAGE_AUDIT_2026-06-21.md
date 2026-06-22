---
id: KB_COVERAGE_AUDIT_2026_06_21
title: Knowledge Base Coverage Audit
type: audit
domain: quality
category: audit
status: active
version: 1.0
created: 2026-06-21
updated: 2026-06-21
tags:
  - audit
  - knowledge-base
  - coverage
  - rag
  - help-assistant
  - billing
relates_to:
  - CHANGELOG
  - help/billing
  - help/getting-started
---

# Knowledge Base Coverage Audit — 2026-06-21

**Auditor role:** Senior KB Coverage Reviewer
**Scope of this pass:** user-facing + RAG-fed documentation and high-stakes business rules
(billing, refunds, retention), measured against the live product code.

## Source of truth used

This audit measures the knowledge base against the **shipped product code**, not against
documentation tone or polish. Specifically:

- **Plan quotas / feature gates:** `functions/api/types.ts` → `PLAN_QUOTAS` (authoritative,
  hydrated to clients via `GET /api/plans/catalog`).
- **Pricing copy:** `src/pages/Pricing.tsx`, `src/config/plans.ts`, `src/config/pricing-matrix.ts`.
- **Billing / dunning behaviour:** `functions/api/routes/billing.ts`.
- **Retention:** `src/pages/Privacy.tsx`, `src/config/pricing-matrix.ts`.
- **Shipped surfaces:** route map in `functions/api/routes/**` and page map in `src/pages/**`.
- **RAG help index:** `functions/api/seed/help-documents.json` (seeded by
  `scripts/seed-help-docs.ts` into `HELP_VECTORIZE`) — i.e. *what the help assistant actually
  retrieves*, vs. the human-readable `knowledge-base/help/*.md`.

See **Scoping limitations** at the end for what was *not* verified.

---

### [CRITICAL] Failed-payment "5-day downgrade" deadline is fabricated
**Document(s):** `knowledge-base/help/billing.md` (§ Failed Payments); `functions/api/seed/help-documents.json` (`billing-002`)
**Gap/Issue:** Both docs state: *"You have 5 days to update your payment method … After 5 days,
your plan downgrades to [Pulse/Free]."* No such 5-day cliff exists in code. `billing.ts:793–795`
(`handleInvoicePaymentFailed`) explicitly comments that a failed payment **does not** immediately
revoke access — Stripe runs standard dunning (`subscription.updated → past_due`, then `deleted` on
final failure), and Qesto only writes an audit record. There is no "5 days" constant anywhere in
`functions/` or `src/`.
**Impact:** A user reading this (or the help assistant quoting it) believes they have a hard 5-day
deadline and that their plan auto-downgrades on day 6. Both are false — Stripe's retry window is
weeks, not 5 days. Users may panic-pay or, worse, assume they've been downgraded when they haven't.
Billing is the highest-stakes topic in any KB.
**Source of truth used:** `functions/api/routes/billing.ts:781–799`.
**Fix:** Rewrite the "Failed Payments" section in both `help/billing.md` and the seed to describe the
actual flow: Stripe retries automatically over its dunning schedule; access continues during
`past_due`; the subscription is cancelled (and the account reverts to Pulse) only on final failure.
Remove the invented "5 days" number.

### [CRITICAL] Refund policy contradicts the live Pricing page (and the 14-day guarantee is undocumented in help)
**Document(s):** `knowledge-base/help/billing.md` (§ Refund Policy), `help/faq.md`, seed `billing-002` vs. `src/pages/Pricing.tsx`
**Gap/Issue:** The live Pricing page makes two refund promises that the help KB does not contain and
partly contradicts:
- Pricing FAQ: *"If your first session doesn't beat the response rate of your last survey, email us
  within **14 days** of your first billing. We'll **refund the full quarter**."* — a money-back
  guarantee.
- Pricing FAQ: *"Monthly cancels immediately with no refund on the current month. **Annual cancels at
  renewal.**"*

`help/billing.md` instead says: monthly = *"Refunds only if payment processing errors"*; annual =
*"Pro-rated refunds if you downgrade or cancel within 30 days of purchase."* The **14-day
first-session guarantee appears in zero help docs**, and `help/faq.md` only says "cancel anytime"
with no refund terms at all. The annual terms also differ (refund-at-renewal vs. prorated-within-30-days).
**Impact:** A customer asking the help assistant "can I get a refund?" will be told *no* (or given the
wrong 30-day rule) when the company actually offers a 14-day money-back guarantee. This directly costs
goodwill and creates support disputes where the doc and the marketing promise disagree.
**Source of truth used:** `src/pages/Pricing.tsx:51–57` (FAQ array).
**Fix:** Decide the canonical refund policy with commerce, then make Pricing page, `help/billing.md`,
`help/faq.md`, and the seed `billing-002` all state the *same* terms — explicitly including the
14-day first-session guarantee and the annual-cancellation rule.

### [HIGH] RAG help index is staler and narrower than the human-readable help docs
**Document(s):** `functions/api/seed/help-documents.json` (the seeded index) vs. `knowledge-base/help/*.md`
**Gap/Issue:** The help assistant retrieves from `help-documents.json` (15 docs), **not** from
`knowledge-base/help/*.md` (11 docs). The two have already drifted:
- Seed `billing-002` still says payment failure *"downgrades to **Free**"* — an old plan name. The
  markdown was updated to the **Pulse/Signal/Chorus** branding; the seed was not.
- Seed `billing-002` § Tax/Non-profit says only *"Email support for discount"* and omits the **40%
  Chorus nonprofit/education discount** that both `help/billing.md` and the Pricing page now carry.
The *indexed* (retrieved) copy is the **older** one, so the assistant surfaces the stale answer while
the curated doc that humans see is correct.
**Impact:** Classic RAG failure mode — a near-duplicate stale document wins retrieval and the
assistant answers from it. Users get outdated plan names and miss the nonprofit discount.
**Source of truth used:** `scripts/seed-help-docs.ts:33` (reads the JSON), `functions/api/lib/seed-help.ts:61`.
**Fix:** Make the seed a *generated artifact* from `knowledge-base/help/*.md` (single source), or at
minimum re-sync `billing-002`/`billing-001`/`billing-003` now and add a CI check that fails when the
seed JSON diverges from the help markdown.

### [HIGH] Whole RAG topics are missing from the index (auth, GDPR, teams, semantic search, templates)
**Document(s):** seed covers only `getting-started-*`, `faq-*`, `billing-*`, `troubleshooting-*`. Missing from the index: `account-and-auth.md`, `privacy-gdpr.md`, `teams-and-collaboration.md`, `semantic-search.md`, `templates-and-ai.md`, `hosting-sessions.md`, `participant-guide.md`
**Gap/Issue:** Seven curated help articles exist as markdown but were never seeded into
`HELP_VECTORIZE`. The help assistant therefore has **no retrievable content** for account/login/SSO
issues, GDPR/privacy rights, team roles & invites, semantic decision search, or template/AI usage.
**Impact:** A user asking "how do I reset my password / export my GDPR data / invite a teammate / use
semantic search" gets a no-context or hallucinated answer, even though Qesto wrote good docs for each.
High-traffic, support-deflecting topics are simply absent from the assistant.
**Source of truth used:** `functions/api/seed/help-documents.json` (id list) vs. `ls knowledge-base/help/`.
**Fix:** Add seed entries (or auto-generate the seed from `help/*.md`) for all seven topics so the
index matches the curated help set.

### [HIGH] Shipped session modes have little or no end-user documentation
**Document(s):** none found for Ideate, Deliberate, Tournament, Live Copilot, Marketplace; thin (1 incidental mention) for Townhall and Live Captions
**Gap/Issue:** The product ships distinct **session modes** with dedicated pages and API routes:
Townhall (`TownhallJoin/Present/Display`, `routes/townhall`), Ideate
(`IdeateJoin/Present/Board`, `routes/ideate-sessions`), Retro (`Retro*`, `routes/retro-sessions`),
Deliberate (`DeliberateJoin`, `routes/deliberate-sessions`), Tournaments (`routes/tournaments`),
Event/Stage suite, Marketplace (`MarketplacePage`, `routes/marketplace-*`), Embed widgets, and the
Live Facilitator Copilot (`routes/copilot-context`, ADR-0046). Yet the help docs only describe
**question types** (Poll / Ranking / Consent / Open / Word Cloud / Multi-select) and energizers.
Coverage counts across `help/`: Ideate 0, Deliberate 0, Tournament 0, Copilot 0, Marketplace 0,
Townhall 1 (passing), Live Captions 1 (passing), Retro 3, Embed 2.
**Impact:** A host who buys Chorus to run a town hall, retro, or ideation board has no instructions
and no assistant answers. These are flagship/differentiating surfaces (some Beta, some GA) shipping
without user docs — a typical "feature shipped, docs lag" gap, here at large scale.
**Source of truth used:** `src/pages/**` + `functions/api/routes/**` vs. `grep` over `knowledge-base/help/`.
**Fix:** Triage by GA status (start with GA Townhall/Retro/Ideate, then Beta Copilot/Captions/XR),
write one help article per session mode (what it is, how to host, participant view, plan tier), and
seed them into the help index.

### [MEDIUM] KB CHANGELOG is frozen at the 2026-05-11 restructuring
**Document(s):** `knowledge-base/CHANGELOG.md`
**Gap/Issue:** The only entry is `[2026-05-11] Complete Migration & Restructuring`. Nothing has been
logged since, despite the product reaching **v7.0.0** (latest in `product/releases/`) and ~6 weeks of
work by today's date (2026-06-21).
**Impact:** The one artifact meant to signal "what changed and when" is itself stale, so it can't be
used to judge the recency of any other doc. Undermines the whole "assume stale until proven otherwise"
defense.
**Source of truth used:** `knowledge-base/product/releases/` (v6.0.0, v7.0.0 present) vs. CHANGELOG.
**Fix:** Either resume per-change entries or replace the file with a pointer to
`product/releases/` as the canonical version log, and note the cadence in CONTRIBUTING.

### [MEDIUM] KB README document count is off by ~3×
**Document(s):** `knowledge-base/README.md`
**Gap/Issue:** README states *"Total Documents: 123 markdown files + design assets"* and references "12
major folders". The KB now contains ~370 markdown files (523 total incl. assets) across 18 top-level
folders. The "123 files" figure dates to the 2026-05-11 migration and was never updated.
**Impact:** A reader (or new contributor) trusts a structural overview that understates the KB by 3×
and mis-describes its shape — erodes trust in the index and hides how much content exists.
**Source of truth used:** `find knowledge-base -name '*.md' | wc -l` vs. README claims.
**Fix:** Update the count and folder list, or remove the hard number in favour of a generated index.

### [MEDIUM] Help articles carry no update/version provenance
**Document(s):** all `knowledge-base/help/*.md`
**Gap/Issue:** Help front-matter contains only `id/title/topic/scope/excerpt` — no `updated` or
`version` field, unlike the rest of the KB (governed by `OBSIDIAN_KB_STANDARD.md`, which mandates
`updated`/`version`). There is no way to tell which help doc predates which product change.
**Impact:** Reviewers can't spot stale help docs by date; the audit has to diff against code every
time. Compounds the RAG staleness risk (no signal to re-embed).
**Source of truth used:** front-matter of `help/*.md` vs. `governance/OBSIDIAN_KB_STANDARD.md`.
**Fix:** Add `updated:` and `version:` to every help doc and enforce via the existing page-quality
checklist.

### [MEDIUM] Retention is described at three different specificity levels
**Document(s):** `help/billing.md`, `src/config/pricing-matrix.ts`, `src/pages/Privacy.tsx`
**Gap/Issue:** Chorus retention is stated three ways: pricing matrix *"Up to 7 years"*, `help/billing.md`
*"Custom"*, Privacy page *"custom, as low as 7 days or as high as 7 years."* Not strictly
contradictory, but a reader cross-checking gets three different answers and `help/billing.md` (the one
the assistant should quote) is the least specific.
**Impact:** A compliance-driven buyer asking "what's the max retention on Chorus?" gets a vague answer
from the help doc when the product/Privacy page commits to a 7-year ceiling.
**Source of truth used:** `src/pages/Privacy.tsx:157–159`, `src/config/pricing-matrix.ts:23`.
**Fix:** State the concrete 7-year ceiling (and 7-day floor) in `help/billing.md` to match Privacy.

### [LOW] RAG seed uses a retired plan name ("Free")
**Document(s):** `functions/api/seed/help-documents.json` (`billing-002`)
**Gap/Issue:** Seed text says *"downgrades to Free"*. Customer-facing brand names are
**Pulse / Signal / Chorus** (`src/config/plans.ts:82` `PLAN_BRAND_NAMES`; `free→Pulse`). "Free" no
longer appears in the UI.
**Impact:** The assistant uses a plan name users won't recognise on their billing screen.
**Source of truth used:** `src/config/plans.ts:82–86`.
**Fix:** Replace "Free" with "Pulse" throughout the seed (folds into the HIGH re-sync fix above).

---

## Summary (findings by severity)

| Severity | Count | Findings |
|---|---|---|
| Critical | 2 | Fabricated 5-day downgrade deadline; refund policy contradicts Pricing / 14-day guarantee undocumented |
| High | 3 | Stale RAG seed vs. markdown; missing RAG topics (auth/GDPR/teams/search/templates); shipped session modes undocumented |
| Medium | 4 | CHANGELOG frozen; README count off 3×; no help provenance dates; retention stated 3 ways |
| Low | 1 | RAG seed uses retired "Free" plan name |

## Top 3 priorities

1. **Fix the two billing CRITICALs** (5-day deadline + refund/14-day guarantee). Highest-stakes,
   user-facing, and currently *actively wrong* in both the human doc and the assistant index.
2. **Re-sync and de-duplicate the RAG help index** — make `help-documents.json` a generated artifact
   of `help/*.md` (or add a divergence CI gate). This resolves the stale-billing seed, the retired
   "Free" name, *and* the missing-topics gap in one structural change.
3. **Document shipped session modes** (Townhall, Retro, Ideate first), then seed them — the largest
   raw coverage gap, covering paid/differentiating surfaces with zero user guidance today.

## Coverage map — what is well-documented and current (don't touch)

- **Plan quotas (numeric):** `help/billing.md`'s 5/50/500 sessions and 50/500/5000 participants match
  `PLAN_QUOTAS` exactly — these hydrate from the same source as enforcement and are accurate.
- **AI-insights tiering:** "Chorus/Team only" is consistent across `help/billing.md`,
  `help/getting-started.md`, Pricing page, and `PLAN_QUOTAS.featuresUnlocked.insightsAI` (team-only).
- **Question types & energizers:** Poll/Ranking/Consent/Open/Word Cloud/Multi-select and energizer
  catalog are well covered in `getting-started.md` and the seed (`faq-003`).
- **Privacy / retention tiers (Privacy page):** per-plan retention windows are accurate and specific.
- **ADRs:** the `adr/` corpus is extensive and recent (through ADR-0067) — architectural decision
  coverage is strong and out of scope for this user-facing audit.

## Scoping limitations

- **No canonical feature list / product changelog was provided.** I reconstructed the "shipped"
  surface from `functions/api/routes/**` and `src/pages/**`. A feature with a route+page is treated as
  shipped; I did **not** verify GA-vs-Beta status per surface against a release matrix, so the session-mode
  coverage gap is sized by route/page existence, not by GA commitment.
- **I assumed the repo seed equals the deployed help index.** I did not query the live `HELP_VECTORIZE`
  index; if production was re-seeded from a different source, the stale-seed findings would need
  re-confirmation.
- **Not every one of the ~370 KB docs was checked.** This pass deliberately prioritised user-facing +
  RAG-fed content and the high-stakes billing/retention business rules. Internal accuracy of specs,
  sprint plans, ops runbooks, and ADRs vs. current code was **not** exhaustively verified and could
  hide further drift.
- **Marketing/SEO long-form pages** (`knowledge-base/marketing/**`) and the `archive/` tree were not
  audited for product accuracy beyond what intersected the findings above.
