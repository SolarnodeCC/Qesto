---
id: I18N_SPRINT_81_90_PLAN
type: planning
domain: i18n
category: planning
status: active
version: 1.0
created: 2026-06-01
updated: 2026-06-01
tags:
  - i18n
  - localization
  - sprints-81-90
  - app-store-listings
  - captions-translation
  - locale-expansion
relates_to:
  - SPRINT81_90_PLAN
  - SPRINT81_90_AI_PLAN
  - BACKLOG_MASTER
---

# i18n Plan — Sprints 81–90 (Post-v5.0 Expansion Arc)

_Prepared: 2026-06-01 — i18n synthesis aligned to [`SPRINT81_90_PLAN.md`](./product/planning/SPRINT81_90_PLAN.md). Baseline locales: **EN/NL/ES/DE/FR**. i18n budget ~8–13 pts/sprint (parallel track)._

---

## Executive summary

S81–S90 is the first arc where localization is not just *UI strings* — it touches **app-store listings** (a new distribution surface), **partner-facing marketplace** copy, and most significantly **live machine translation** (CAPTIONS, ADR-0051) which makes locale coverage a *runtime* feature, not just a build-time one.

**Locale-expansion recommendation:** Hold the **UI** at 5 locales (EN/NL/ES/DE/FR) through v6.0 — adding a 6th UI locale is a multi-sprint commitment that competes with shipping the expansion arc. **But** introduce **CAPTIONS live-translation locales** (read-only, model-driven) as a separate, lower-cost track in S88, gated on the WER bar. This lets Qesto market "live translation into N languages" without taking on full UI-localization debt for each. Re-evaluate a 6th *UI* locale (recommend **PT-BR** or **IT**) for the post-v6 arc based on captions-locale demand signals.

---

## Per-sprint i18n stories

| Sprint | ID | Item | Pts |
|--------|----|------|-----|
| S81 | `I18N-SPRINT81-01` | App-store listing copy + ASO keywords, 5 locales (iOS + Play) | 10 |
| S82 | `I18N-SPRINT82-01` | Native shell UI strings + marketplace partner-facing copy | 10 |
| S83 | `I18N-SPRINT83-01` | Marketplace listing/checkout/payout strings; creator dashboard | 10 |
| S84 | `I18N-SPRINT84-01` | TOWNHALL surface keys (queue, moderation, anonymous prompts) | 10 |
| S85 | `I18N-SPRINT85-01` | RETRO/IDEATE/STAGE workspace surface keys | 13 |
| S86 | `I18N-SPRINT86-01` | DELIBERATE governance + receipt/verify copy (legal-reviewed) | 10 |
| S87 | `I18N-SPRINT87-01` | EMBED config console + SDK-facing strings; locale param in widget | 10 |
| S88 | `I18N-CAPTIONS-01` | CAPTIONS MT locale coverage + overlay strings (WER-gated) | 13 |
| S89 | `I18N-SPRINT89-01` | Sovereign/gov tier copy; AAA-conformant locale rendering audit | 8 |
| S90 | `I18N-SPRINT90-01` | v6.0 GA full-locale QA sweep + release notes (5 locales) | 10 |

**Total:** ~104 pts across 10 sprints.

---

## Key-extraction & CI validation

- All new surfaces (TOWNHALL, RETRO, IDEATE, STAGE, DELIBERATE, EMBED, CANVAS, CAPTIONS) register namespaces via the existing extraction pipeline; CI fails on missing keys across the 5 locales (per CLAUDE.md Hard Rule + `I18N-03` pattern).
- App-store listing copy lives outside the runtime bundle but is tracked in the same review workflow to keep ASO strings versioned.
- Marketplace + governance copy requires **legal review** before locale fan-out (governance/financial language).

---

## CAPTIONS live-translation track (ADR-0051)

- Source ASR (Workers AI) → target-locale MT (Workers AI). No third-party MT, no audio egress.
- **WER/quality bar** per target locale before that locale's caption claim is marketed (gate with QA + AI plan S88).
- Priority target locales: EN↔{NL, DE, FR, ES} first (parity with UI), then expand based on demand. Captions locales can exceed UI locales because they are runtime, model-driven, and read-only.
- PII in transcripts handled per security/retention policy — captions are not stored long-term by default.

---

## Pluralization / RTL notes

- New count-bearing surfaces (upvotes in TOWNHALL, votes in DELIBERATE, ideas in IDEATE, workspace history counts) must use ICU plural rules — no string concatenation of counts.
- **RTL:** no RTL UI locale is committed this arc (baseline is LTR EN/NL/ES/DE/FR). However, captions overlay and embed widget should not *assume* LTR in layout primitives, to avoid rework if an RTL locale (e.g. AR) is added post-v6. Track as a forward-compat note, not a deliverable.

---

## Acceptance criteria (every i18n story)

- [ ] All 5 locales present; CI key-parity check green.
- [ ] No hard-coded user-facing strings in new components.
- [ ] ICU plurals/interpolation for all dynamic values.
- [ ] Legal-reviewed copy for marketplace + governance surfaces.
- [ ] Captions target locales meet the WER bar before marketing claim (S88).
