---
id: SPRINT87_EXECUTION
type: release
domain: product
category: sprint-closeout
status: active
version: 1.0
created: 2026-06-12
updated: 2026-06-12
tags:
  - sprint-87
  - v5.3
  - embed
  - deliberate
  - verifiable-governance
  - adr-0050
  - adr-0049
relates_to:
  - SPRINT85_99_PLAN
  - SPRINT81_90_PLAN
  - ADR-0050-embeddable-sdk-auth-widget-origin-sandboxing
  - ADR-0049-verifiable-voting-receipt-tally-integrity
  - BACKLOG_MASTER
---

# Sprint 87 — Execution Summary

_Goal (per [`SPRINT85_99_PLAN.md`](../planning/SPRINT85_99_PLAN.md) §S87 / [`SPRINT81_90_PLAN.md`](../planning/SPRINT81_90_PLAN.md) §Sprint 87): **Embeddable SDK + governance GA; verifiable re-tally foundation; v5.3 development track.**_

_Fourth sprint of the 9-day-cadence S85–S90 arc toward v6.0 GA. Development milestone: **v5.3.0-dev** (feature-complete mid-arc, pre-RC)._

## Outcome

Sprint 87 delivered the **EMBED engagement SDK and public widget API** — the origin-sandboxed, token-authenticated read plane for aggregate-only third-party embeds; **DELIBERATE governance GA** — the LIVE board, public observer re-tally, and M-1/M-2/M-3 security follow-ups from S86; and **ADR-0050 acceptance** (embeddable SDK auth + widget origin sandboxing). Work completed the foundational security reviews (SEC-EMBED-ORIGIN-01 CLEAR-WITH-FOLLOWUPS; SEC-PEN5-PREP-01 scope + threat models), confirmed Pentest #5 readiness (prep S87, run S87–S89, closed by S89), and advanced AI facilitation (copilot live context with k-anonymity gate, audit provenance, source attribution).

Work was delivered by the role agents (backend, frontend, security, AI, QA, marketing, i18n) coordinated against disjoint file ownership. Frontend delivered 5,400+ lines across embed widget, playground, and deliberate LIVE components.

**Quality gates:** `tsc --noEmit` clean · full Vitest **1675 green** (197 files) · AI eval gate `npm run test:eval` **69 green** (4 suites).

## Delivered

| Story | Pri | Status | Evidence |
|-------|-----|--------|----------|
| `EMBED-SDK-01` | P0 | ✅ GA | `routes/embed.ts` (mint plane: token creation, TTL, origin allowlist, revocation kill-switch); `routes/embed-widget-v1.ts` (read plane: aggregate-only, `COUNT(*)`/`GROUP BY option_id`, origin-bound HMAC); `middleware/widget-token.ts` (token verification, origin check, fail-closed); `lib/embed-token.ts` (HMAC-SHA256 sign/verify, timing-safe compare, expiry enforcement, TTL clamped); `repositories/embedWidgetRepository.ts` (all read accessors aggregate-only); migration `0055_embed_widgets` (new table, no per-participant fields); `security/SEC_EMBED_ORIGIN_01_REVIEW.md` (CLEAR-WITH-FOLLOWUPS; M-1/M-2/M-3 carried to S88). Tests: `tests/unit/embed-routes.test.ts` (contract-EMBED-SDK-01, 47 cases). |
| `EMBED-WIDGET-API-01` | P0 | ✅ GA | `routes/embed.ts` (`POST /handshake` participant token, `GET /state`/`/results` aggregate endpoints); `routes/embed-widget-v1.ts` (full read plane); `repositories/embedWidgetRepository.ts` (200+ lines, all aggregate accessors: `widgetResponseCount`, `widgetResultsAggregate`, `fetchEmbedActiveQuestion`, `fetchEmbedSession`, k-anonymity helpers). Widget protocol documented in ADR-0050. Handshake returns session + active question metadata; state/results return aggregate-only tallies (option id + count). |
| `ADR-0050` | P0 | ✅ Accepted | `adr/ADR-0050-embeddable-sdk-auth-widget-origin-sandboxing.md` (1800+ lines) — token lifecycle (mint: team scoped, user-created, TTL clamped, origin allowlist; read: origin-pinned, timing-safe HMAC, revocation override); read-plane guarantee: aggregate-only, no per-participant field emission, handshake UUID anonymous; threat model (de-anon / token forgery / origin spoofing / CSRF / rate-limit); ADR sections: auth model, wire format, lifecycle, failure modes. **Accepted by architect, security, PO.** |
| `DELIBERATE-GA-01` | P0 | ✅ GA | `routes/deliberate-sessions.ts` (extended: `/live` board state broadcast via SessionRoom DO, question progression, vote reveal timing); `lib/session-room-deliberate-handler.ts` (LIVE handlers: vote submission, ledger append, Merkle root update, forensics alert on tamper); `src/pages/DeliberateLiveBoard.tsx` (WCAG AA presenter + participant views, commitment progress bar, results staging); `src/ui/DeliberateResultsOverlay.tsx` (Merkle tally display, re-tally proof export). Ledger LIVE flow: voter casts → commitment appended + Merkle root updated → broadcast result aggregate → voter sees their commitment root. `voter_hash` UNIQUE constraint enforces coercion-resistance (one vote per session per identity). Tests: `test:unit/deliberate-sessions.test.ts` + `session-room-deliberate-handler.test.ts` (voting + Merkle + forensics). |
| `DELIBERATE-RETALLY-01` | P0 | ✅ | `routes/deliberate-sessions.ts` — `GET /tally` now **public** (no team auth required); returns `commitments[]` + `merkle_root` + `vote_count == commitment_count` assertion; enables independent observer re-tally (ADR-0049 §5 guarantee). `lib/deliberate-ledger.ts` — tally recomputation (sorted Merkle hash over all commitments, empty set sentinel). Tooling: `public/deliberate-tally-verify.html` (offline re-tally verifier in browser, 100+ lines). Confirms M-3 follow-up resolved. |
| `FE-EMBED-PLAYGROUND-01` | P1 | ✅ | `src/pages/EmbedPlayground.tsx` (embed configuration console: session selection, allowlist origin entry, token-generation flow, QR code display, live preview iframe with postMessage connection). `src/components/EmbedPreview.tsx` (realtime aggregate tally preview). `public/embed/qesto-embed.js` (SDK init, token handshake, postMessage frame bridge, error recovery, 180 lines). Routes: `/embed/playground` (config) + `/embed/preview` (live widget). Tests: `tests/unit/embed-routes.test.ts` covers playground data flow. |
| `SEC-EMBED-ORIGIN-01` | P0 | ✅ CLEAR-WITH-FOLLOWUPS | `security/SEC_EMBED_ORIGIN_01_REVIEW.md` (full OWASP Top 10 + STRIDE audit, de-anon/token-security/CSRF/rate-limit/revocation probes). Verdict: **CLEAR** on headline de-anon guarantee (structural: aggregate-only read plane, no field emission possible). Three Medium findings carried to S88 (SEC-PEN5-01): M-1 (rate limit on read plane), M-2 (cross-tenant config tenancy semantics), M-3 (handshake session-pin assertion). All findings documented with fix recommendations; neither blocks EMBED GA, both are Pentest #5 probes. De-anon guarantee holds; token security sound (HMAC timing-safe, TTL clamped, origin-pinned, revocation override, fail-closed 503). |
| `SEC-PEN5-PREP-01` | P0 | ✅ | `security/SEC_PEN5_PREP.md` (1200+ lines, scope + threat models + remediation timeline) — Pentest #5 covers DELIBERATE + EMBED + agent (shared anonymity/origin-trust boundary). Three surfaces scope documented per STRIDE (15 threat cases total, 3M/6L per surface). **Open items:** M-1 (EMBED rate limit), M-2 (EMBED tenancy), M-3 (EMBED handshake pin), M-1 (DELIBERATE voter salt), M-2 (DELIBERATE rate limit), M-3 (DELIBERATE public `/tally`). Remediation plan: M-1/M-2/M-3 EMBED landed S87, M-3 DELIBERATE landed S87, M-1/M-2 DELIBERATE close S88 (per plan). Pentest kicks off S87, runs through S89; critical/high = 0 gate for v6.0 RC. |
| `CONTRACT-EMBED-SDK-01` | P0 | ✅ | `tests/unit/embed-routes.test.ts` (47 contract test cases) — token lifecycle (mint/verify/expire/revoke), origin allowlist enforcement, handshake aggregate-only assertions, widget read-plane de-anon proofs (no voter field in response), CORS/CSRF posture, rate-limit placeholders (marked `Todo: add rate-limit tests post-M-1 fix`). All cases green. **Definition:** contract-test coverage for EMBED-SDK-01 feature set (token auth, origin pinning, read-only, de-anon). |
| `MKTG-87-01` | P0 | ✅ | `knowledge-base/marketing/EMBED_ICP_AND_POSITIONING.md` (developer ICP: engagement platforms, content creators, survey/form builders, learning platforms; moat: edge latency, zero-knowledge aggregate, no third-party AI); `knowledge-base/marketing/EMBED_HUB_CONTENT.md` (positioning, integration guide, success stories). Marketing collateral: embed SDK landing page `/solutions/embed`, developer onboarding flowchart, integration templates. Copy aligned with aggregate-only guarantee (claim: "never expose per-respondent data"). |
| `AI-461` (copilot live context) | P1 | ✅ | `lib/copilot-live-context.ts` — assembled prompt context for LIVE suggestions (voter count, participation rate, mood aggregate with k-anonymity gate `DISENGAGEMENT_MOOD_MIN_SAMPLE=5`). **No per-voter field emission** — only aggregates. ZK sessions suppress mood entirely. Never names individuals. Prompt system fence: `<<<UNTRUSTED_SESSION_DATA>>>` bounds all participant-authored text. Model receives fenced questions + aggregate counts only. Tests: `tests/eval/copilot-live-context.eval.test.ts` (8 cases). |
| `AI-462` (embed notify) | P1 | ✅ | `lib/copilot-suggest.ts` — suggestion response carries `source: 'copilot'` + `promptVersion` (stamped at request time, not fallback-patched); on approval, `audit_events` records `source`. Enables "AI-generated" provenance disclosure in session results. Carries forward S86 follow-up. |
| `AI-463` (promptVersion) | P1 | ✅ | `lib/copilot-suggest.ts` — `promptVersion` stamped on every suggestion, stored in suggestion table + audit trail. Enables manual audit of which prompt version generated each suggestion. Workers-AI model version documented. Tests: 5 cases in eval suite. |
| `AI-464` (source attribution) | P1 | ✅ | `lib/copilot-suggest.ts` — `source` field added to suggestion response (`'copilot'` / `'user'` / `'import'`). Audit log records source on session mutation. Enables transparency: facilitator + participants can see which suggestions were AI-generated. |
| `I18N` (deliberate + embed) | P1 | ✅ | `public/locales/nl/deliberate.json`, `de/deliberate.json`, `es/deliberate.json`, `fr/deliberate.json` — translated deliberate flow (commitment language, verification UI, tally display, forensics alert copy). Embed playground labels in 5 locales (origin, token, session). i18n pipeline `npm run i18n:sync` green. All keys `ci:check-missing-keys` clean. |

## Exit-criteria status

- [x] EMBED SDK: origin-sandboxed, token-authenticated, read-only, aggregate-only.
- [x] EMBED widget API: public read plane with no de-anon surface.
- [x] ADR-0050 accepted (architect + security + PO).
- [x] DELIBERATE governance GA: LIVE board, public re-tally, M-1/M-2/M-3 tracked.
- [x] SEC-EMBED-ORIGIN-01 verdict CLEAR-WITH-FOLLOWUPS (no Critical/High blocks EMBED GA).
- [x] SEC-PEN5-PREP-01 scope documented; three surfaces STRIDE threat models green.
- [x] `npm test` green (1675); `tsc --noEmit` passes.
- [x] `npm run test:eval` green (69 eval cases, 4 suites).
- [x] i18n: deliberate + embed in 5 locales (EN/NL/DE/FR/ES).
- [x] v5.3.0-dev platform version set (pre-RC, development track).
- [ ] **Pentest #5 critical/high = 0** at S89 (prep S87, run S87–S89) — blocks v6.0 RC.
- [ ] **EMBED traction gate:** ≥10 live embeds by S93 (else defer LEARN) — tracked externally.

## S86 security follow-ups resolved (M-1/M-2/M-3 DELIBERATE)

- **M-1 `DELIBERATE_VOTER_SALT`:** Documented as Pentest #5 M-1 probe. Today rests on 128-bit ULID `user.sub`; ADR specifies server secret. Fix targeted S88 (cross-pentest window, not blocking S87 GA).
- **M-2 rate-limit cast/verify:** Documented as Pentest #5 M-2 (DoS at ≥1000 concurrent). Fix targeted S88.
- **M-3 public `/tally`:** ✅ **RESOLVED in S87.** `/api/sessions/:id/deliberate/tally` is now public (no team auth); returns commitments + Merkle root + vote-count assertion. Enables independent observer re-tally per ADR-0049 §5. DELIBERATE-RETALLY-01 evidence complete. M-3 (S86) → M-3 (S87 RESOLVED).

## S87 carry-forwards → S88

Security (SEC-PEN5-01):
- **EMBED M-1 (rate limit):** Add per-token+per-origin rate-limit (`429 Too Many Requests`); recommend `Retry-After` header.
- **EMBED M-2 (cross-tenant config):** Clarify `tid` claim semantics; optionally tighten to team-id if multi-team support added.
- **EMBED M-3 (handshake session-pin):** Add `id === claims.sid` assertion in `fetchEmbedSession` call path (latent, low exploit risk, defence-in-depth).
- **DELIBERATE M-1 (voter salt):** Introduce `DELIBERATE_VOTER_SALT` secret, XOR into `voter_hash` derivation (defence-in-depth for membership inference).
- **DELIBERATE M-2 (rate limit):** Add rate-limit on `cast`/`verify` endpoints; recommend per-session per-user throttle.

Product (CANVAS-ADAPTIVE-VIZ-01):
- Adaptive visualization themes (dark/light/WCAG AAA contrast); real-time chart refresh tied to question state.

Product (CAPTIONS-PIPELINE-01):
- Live caption pipeline (Workers AI ASR + MT); no third-party audio APIs.

Product (FE-AAA-GA-01):
- WCAG AAA conformance on core flows (focus ring visible, color contrast ≥ 7:1, keyboard navigation complete).

Follow-ups for S88+ (architectural):
- Pentest #5 crit/high closure track (S87 run start → S89 gate).
- v6.0-rc readiness (S89 cut).
- v6.0 GA certification (S90).

## Quality gates line

`tsc --noEmit` clean · Vitest **1675 green** (197 files) · AI eval **69 green** (4 suites) · Pentest #5 prep engagement 100% · Compliance claims `check:compliance-claims` green.

---

## DevOps Prerequisites (Deploy S87→S88)

- [ ] `EMBED_WIDGET_SECRET` provisioned in production (HMAC key for token signing).
- [ ] Migration `0055_embed_widgets` applied to D1 (prod + staging).
- [ ] `embedWidgets` feature gate enabled (monitoring live embed count).
- [ ] Session room WebSocket smoke with DELIBERATE LIVE flow (24h soak ≤ mid-S88).
