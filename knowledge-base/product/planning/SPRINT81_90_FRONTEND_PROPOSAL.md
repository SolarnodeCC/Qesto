---
id: SPRINT81_90_FE_PROPOSAL
type: planning
domain: product
category: frontend
status: proposed
version: 1.0
created: 2026-06-01
updated: 2026-06-01
author: qesto-frontend
tags:
  - planning
  - frontend
  - v5.1
  - v5.2
  - v6.0
  - native-mobile
  - marketplace
  - agentic
  - townhall
  - stage
  - retro
  - ideate
  - deliberate
  - embed
  - canvas
  - captions
  - wcag-aaa
relates_to:
  - SPRINT81_90_PLAN
  - SPRINT71_80_FRONTEND_PROPOSAL
  - ROADMAP_FULL
  - BACKLOG_MASTER
---

# Sprint 81–90 Frontend Proposal — Post-v5.0 Platform Expansion Arc

_Prepared: 2026-06-01 — Frontend agent synthesis aligned to [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md), [`SPRINT71_80_FRONTEND_PROPOSAL.md`](./SPRINT71_80_FRONTEND_PROPOSAL.md) §Deferred to S81+, and competitive epics (TOWNHALL, STAGE, RETRO, IDEATE, DELIBERATE, EMBED, CANVAS, CAPTIONS)._

---

## Executive Summary

Ten sprints (**S81–S90**) of frontend work spanning **v5.1 → v5.2 → v6.0 GA**: native mobile shell GA (Capacitor offline voter, store submission UX), marketplace partner-earnings dashboard, agent marketplace UI, TOWNHALL big-screen moderation queue, STAGE hybrid-event presenter, RETRO/IDEATE recurring workspace boards and team-health trends, DELIBERATE voter receipt and verify UX, EMBED SDK config playground, CANVAS adaptive themes and dataviz, CAPTIONS live overlay, and WCAG AAA GA certification at v6.0.

**Capacity:** **120–150 pts/sprint** total (3× reference arc). FE owns **four parallel streams** each sprint. FE total across the arc: **~380 pts**.

---

## Foundation Assumptions (v5.0 shipped at S80)

| Shipped (S71–S80) | What exists entering S81 |
|-------------------|--------------------------|
| Dark mode GA | CSS variable token layer, `prefers-color-scheme` + manual toggle, CI axe gate |
| Realtime v3 client | `results_delta` client handler live, shadow-mode toggle; no polling in LIVE state |
| Developer portal v2 | OAS explorer, try-it console, webhook event log |
| Federation UX | SAML IdP config wizard, SCIM group mapping, consent modal |
| Scale trust UI | Public scale-proof counter (`aria-live`), EU residency badge |
| Marketplace depth | Install flow, permission audit panel, categories home |
| Region selector | Tenant region map + pinning status |
| Webhook replay | Delivery replay + DLQ inspect UI |
| AAA conformance path | High-contrast mode, AAA partial audit S79; full audit + fixes S80 |
| Capacitor shell | ADR-0042 accepted; shell only (no store submission) |
| PWA inbox + presenter remote | GA from S75/S80 |

Do not re-implement v5.0 surfaces; extend and GA them.

---

## New i18n Namespaces (S81–S90)

| Namespace | Owner sprint | Surface |
|-----------|--------------|---------|
| `native.json` | S81–S82 | Offline banner, push permission, sync status |
| `marketplace_partner.json` | S82–S83 | Paid listing, earnings, payout status |
| `agent_marketplace.json` | S83–S84 | Agent card, capability list, run status |
| `townhall.json` | S84 | Moderation queue, upvote labels, big-screen overlay |
| `stage.json` | S84–S85 | Hybrid-event presenter, backstage, stream status |
| `retro.json` | S85 | Board columns, team-health chart labels, history nav |
| `ideate.json` | S85–S86 | Brainstorm card, dot-vote, priority matrix |
| `deliberate.json` | S86–S87 | Voter receipt, audit trail, re-tally status |
| `embed.json` | S87 | SDK playground, origin config, widget preview |
| `canvas.json` | S88 | Theme picker, dataviz style labels |
| `captions.json` | S88–S89 | Overlay controls, language selector, WER indicator |

Full key budget: [`I18N_SPRINT_81_90_PLAN.md`](./I18N_SPRINT_81_90_PLAN.md).

---

## Parallel Stream Model

| Stream | Focus | Active sprints |
|--------|-------|----------------|
| **A — Native & Mobile** | Capacitor shell GA, offline voter, store release, push UX | S81–S82 → maintenance S83+ |
| **B — Marketplace & Economy** | Paid listing UX, partner-earnings dashboard, agent marketplace | S82–S84, resurface S87 (embed config) |
| **C — New-Business Surfaces** | TOWNHALL moderation, STAGE presenter, RETRO/IDEATE boards, DELIBERATE receipt | S84–S87 |
| **D — Adaptive Experience & AAA** | CANVAS themes/dataviz, CAPTIONS overlay, WCAG AAA GA, v6.0 polish | S88–S90 (AAA path starts S85) |

Streams run in parallel; each sprint table shows which stream owns each story. Stream leads hand off ownership at the sprint boundary noted above.

---

## Sprint Summary Table

| Sprint | FE pts | Theme | Release milestone |
|--------|--------|-------|-------------------|
| S81 | ~39 | Native mobile beta — offline voter shell + store build | v5.1-alpha |
| S82 | ~34 | Native GA + marketplace paid listing UX | v5.1-alpha |
| S83 | ~26 | Partner earnings dashboard + Pentest #4 FE | v5.1 RC |
| S84 | ~34 | TOWNHALL moderation queue + STAGE foundation | v5.2-alpha |
| S85 | ~39 | STAGE suite + RETRO/IDEATE boards + team-health | v5.2-alpha |
| S86 | ~26 | DELIBERATE voter receipt + v5.2 RC FE readiness | v5.2 RC |
| S87 | ~34 | EMBED SDK playground + governance finish | v6.0-alpha |
| S88 | ~52 | CANVAS themes/dataviz + CAPTIONS overlay + AAA path | v6.0-alpha |
| S89 | ~29 | AAA final audit + v6.0 RC FE sign-off | v6.0 RC |
| S90 | ~26 | v6.0 GA polish + final conformance + regression | v6.0 GA |

_FE pts are the frontend slice only; full sprint load includes BE/SEC/QA/AI/MKT per master plan._

**Arc total (FE): ~339 pts committed + ~41 pts stretch = ~380 pts.**

---

## Sprint 81 — Native Mobile Beta

**Goal:** Capacitor iOS/Android beta to TestFlight/internal; offline voter shell with sync queue; native push permission UX.

**Stream A: Native & Mobile**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-NATIVE-OFFLINE-01` | Offline voter shell: IndexedDB vote queue, optimistic submit, sync-on-reconnect banner (`aria-live`) | 13 | P0 |
| `FE-NATIVE-PUSH-01` | Native push permission prompt + notification action handler (deep-link to session) | 8 | P0 |
| `FE-NATIVE-SHELL-UI-01` | Capacitor shell layout: safe-area insets, bottom-nav adaptation, splash/icon assets | 8 | P0 |
| `FE-NATIVE-OFFLINE-INDICATOR-01` | Network status ribbon + queue depth badge (`aria-live="polite"`) | 5 | P1 |
| `FE-NATIVE-A11Y-01` | Keyboard + TalkBack/VoiceOver audit on shell and join flow | 5 | P1 |

**P0 parent:** `NATIVE-SHELL-01` (master plan S81). Total: **39 pts**.

---

## Sprint 82 — Native GA + Marketplace Paid Listing UX

**Goal:** Store GA release; paid listing creation and discovery UX.

**Stream A: Native & Mobile**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-NATIVE-STORE-01` | Store release page + "Download on App Store / Google Play" deep-link entry points in web shell | 8 | P0 |
| `FE-NATIVE-SYNC-STATUS-01` | Persistent sync-status sheet (offline queue, last-synced timestamp, retry action) | 5 | P1 |

**Stream B: Marketplace & Economy**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-MKTPL-LISTING-01` | Paid listing creation wizard: pricing tier, description, preview card, submit for review | 13 | P0 |
| `FE-MKTPL-DISCOVER-01` | Marketplace discovery page: filter by price/category/rating, paid badge, preview modal | 8 | P1 |

Total: **34 pts**.

---

## Sprint 83 — Partner Earnings Dashboard + v5.1 RC FE

**Goal:** Partner earnings/payout status dashboard; FE sign-off for v5.1 RC gate; Pentest #4 FE surface hardening.

**Stream B: Marketplace & Economy**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-MKTPL-REVENUE-01` | Partner earnings dashboard: revenue chart (weekly/monthly), per-listing breakdown, Stripe Connect payout status, next-payout date | 13 | P0 |
| `FE-MKTPL-KYC-STATUS-01` | KYC onboarding status widget: steps completed, pending document indicator, support CTA | 5 | P1 |
| `FE-MKTPL-LISTING-MGMT-01` | Listing management panel: edit, unpublish, version history | 8 | P1 |

**Stream D (early): AAA / RC readiness**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-V51-RC-CHECKS-01` | v5.1 RC FE checklist: axe clean, keyboard regression, dark-mode smoke on all new S81–S83 surfaces | 5 | P0 |

Total: **26 pts** (Pentest #4 FE surface review is SEC-owned but FE fixes land here).

---

## Sprint 84 — TOWNHALL Moderation Queue + STAGE Foundation

**Goal:** TOWNHALL big-screen moderation queue and anonymous Q&A UX at scale; STAGE hybrid-event foundation.

**Stream C: New-Business Surfaces**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-TOWNHALL-QUEUE-01` | Moderator queue panel: approve/reject/pin questions, drag-to-reorder, live upvote count (`aria-live="polite"`), keyboard moderation shortcuts | 13 | P0 |
| `FE-TOWNHALL-BIGSCREEN-01` | Big-screen attendee view: approved question display, upvote button (≥ 44×44px), anonymous submission form with char counter | 13 | P0 |
| `FE-TOWNHALL-WS-01` | WebSocket integration for queue DO: `moderator_action`, `question_approved`, `upvote_delta` message handlers; reconnect backoff | 8 | P0 |

**Stream B (handoff):** Agent marketplace UI foundation

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-STAGE-FOUNDATION-01` | STAGE skeleton: backstage/stage layout split, stream-status pill, hybrid-event join modal | 8 | P1 |

Total: **34 pts** (TOWNHALL-MODERATE-01 shared BE/FE item; FE slice above).

---

## Sprint 85 — STAGE Suite + RETRO/IDEATE Boards + Team Health

**Goal:** STAGE hybrid-event presenter GA; RETRO recurring workspace board; IDEATE brainstorm board; team-health trends chart.

**Stream C: New-Business Surfaces**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-STAGE-PRES-01` | Hybrid presenter: in-room + remote participant split view, reaction overlay, backstage countdown timer | 13 | P0 |
| `FE-RETRO-BOARD-01` | RETRO workspace board: column cards (Went well / Improve / Actions), add/edit/vote, sprint selector, persistent history nav | 13 | P0 |
| `FE-RETRO-HEALTH-01` | Team-health trend chart: rolling 6-sprint sparklines per dimension, hover tooltip, export PNG | 8 | P0 |
| `FE-IDEATE-BOARD-01` | IDEATE brainstorm canvas: card creation, affinity clustering drag, dot-vote overlay | 13 | P1 |

**Stream D (AAA path ramp)**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-AAA-PATH-01` | AAA gap analysis on S84–S85 new surfaces; fix focus order + target size regressions | 5 | P0 |

Total: **39 pts** (RETRO-WORKSPACE-01 parent shared BE/FE; IDEATE-BOARD-01 partial in S85).

---

## Sprint 86 — DELIBERATE Voter Receipt + v5.2 RC

**Goal:** DELIBERATE voter receipt and verify UX; IDEATE prioritization matrix; v5.2 RC FE sign-off.

**Stream C: New-Business Surfaces**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-DELIBERATE-VERIFY-01` | Voter receipt screen: QR code download, receipt hash display, re-tally status indicator (pending / verified / mismatch), help tooltip | 13 | P0 |
| `FE-DELIBERATE-RECEIPT-DETAIL-01` | Receipt detail modal: cryptographic proof fields (non-technical summary mode toggle), link to public audit log | 8 | P1 |
| `FE-IDEATE-PRIORITIZE-01` | IDEATE priority matrix: 2×2 drag placement, bucket export, share-to-session action | 5 | P1 |

**Stream D: RC readiness**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-V52-RC-CHECKS-01` | v5.2 RC FE checklist: axe clean, keyboard regression, dark-mode + high-contrast smoke on all S84–S86 surfaces | 5 | P0 |

Total: **26 pts**.

---

## Sprint 87 — EMBED SDK Config Playground + Governance Finish

**Goal:** EMBED SDK configuration console/playground; DELIBERATE governance GA finish; Pentest #5 FE surface review.

**Stream B: Marketplace & Economy (resurface)**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-EMBED-PLAYGROUND-01` | Embed config console: live widget preview iframe, origin allowlist editor, copy-paste snippet generator, event inspector panel | 13 | P0 |
| `FE-EMBED-WIDGET-PREVIEW-01` | Widget preview: resize handles (mobile/desktop/custom), dark/light mode toggle, locale switcher | 8 | P1 |

**Stream C: New-Business Surfaces (close-out)**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-DELIBERATE-GA-POLISH-01` | DELIBERATE GA polish: empty states, loading skeletons, re-tally error handling, `aria-live` for tally updates | 8 | P0 |

**Stream D: AAA path**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-AAA-EMBED-AGENT-01` | AAA audit on embed playground + DELIBERATE surfaces; keyboard trap in widget preview modal | 5 | P1 |

Total: **34 pts**.

---

## Sprint 88 — CANVAS Themes + CAPTIONS Overlay + AAA Push

**Goal:** CANVAS adaptive themes and dataviz; CAPTIONS live overlay; major AAA conformance work.

**Stream D: Adaptive Experience & AAA**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-CANVAS-THEME-01` | Theme picker: built-in presets (light, dark, high-contrast, brand), live preview, `prefers-color-scheme` auto-apply, white-label override | 13 | P0 |
| `FE-CANVAS-ADAPTIVE-VIZ-01` | Adaptive dataviz: chart type selector (bar, word-cloud, scatter) bound to session type; `prefers-reduced-motion` fallback to static; colour-blind-safe palette switch | 13 | P0 |
| `FE-CAPTIONS-OVERLAY-01` | Captions overlay: collapsible panel, font-size slider (100%–200%), language selector, WER quality indicator, `aria-live="assertive"` for caption stream | 13 | P0 |
| `FE-AAA-GA-01` | WCAG AAA core flows: 7:1 contrast tokens, enhanced focus indicators, target-size audit (≥ 44×44px all interactive), motion preference, captions + transcript coverage | 13 | P0 |

Total: **52 pts** — heaviest FE sprint; includes CANVAS-THEME-01 and CANVAS-ADAPTIVE-VIZ-01 from master plan.

---

## Sprint 89 — AAA Final Audit + v6.0 RC FE Sign-off

**Goal:** WCAG AAA 0-violation audit on core flows; v6.0 RC FE checklist; Pentest #5 FE fixes.

**Stream D: Adaptive Experience & AAA**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-AAA-AUDIT-FINAL-01` | Full AAA conformance audit across all S81–S89 surfaces; produce violation report; fix P0/P1 items to 0 violations | 13 | P0 |
| `FE-CAPTIONS-GA-POLISH-01` | CAPTIONS GA polish: transcript download, fullscreen overlay, low-latency reconnect indicator | 8 | P1 |
| `FE-V60-RC-CHECKS-01` | v6.0 RC FE checklist: axe AAA clean, keyboard + touch regression, all new surfaces smoke-tested in dark + high-contrast mode | 8 | P0 |

Total: **29 pts** (FE fixes from Pentest #5 remediation land here alongside `SEC-PEN5-REM-01`).

---

## Sprint 90 — v6.0 GA Polish + Final Conformance

**Goal:** v6.0 GA; final AAA conformance evidence; full E2E regression; v5.x sunset messaging.

**Stream D: Adaptive Experience & AAA (close-out)**

| ID | Story | Pts | Pri |
|----|-------|-----|-----|
| `FE-AAA-FINAL-CONFORMANCE-01` | Produce public AAA conformance statement (VPAT update, `docs/A11Y_FULL.md` §6 sign-off); verify 0 axe violations CI green | 8 | P0 |
| `FE-V60-GA-POLISH-01` | Cross-surface v6.0 polish pass: empty states, error copy, loading skeletons, reduced-motion checks across all arc surfaces | 8 | P0 |
| `FE-SUNSET-NOTICE-UI-01` | v5.x sunset notice banner (dismissible, `aria-live`, links to migration guide) | 5 | P1 |
| `FE-E2E-REGRESSION-V6-01` | Paired with QA (`QA-E2E-FULL-REGRESSION-V6-01`): FE-owned Playwright fixtures for native, marketplace, TOWNHALL, EMBED, DELIBERATE, CANVAS, CAPTIONS flows | 8 | P0 |

Total: **26 pts** (paired with `FE-AAA-FINAL-CONFORMANCE-01` and `QA-E2E-FULL-REGRESSION-V6-01` from master plan S90).

---

## Accessibility / WCAG AAA Plan (S81–S90)

This arc closes the **AAA GA gate** required for v6.0. The plan builds on the AA-complete baseline shipped at S80.

| Phase | Sprints | Work |
|-------|---------|------|
| **AA maintenance** | S81–S83 | CI axe gate continues; new surfaces (native, marketplace) must pass AA on merge |
| **AAA ramp** | S84–S85 | `FE-AAA-PATH-01` gap analysis; begin 7:1 contrast token layer; fix focus-order regressions on TOWNHALL/STAGE/RETRO surfaces |
| **AAA push** | S86–S87 | Apply AAA tokens across DELIBERATE + EMBED surfaces; audit caption/transcript coverage; enhanced focus indicators |
| **AAA sprint** | S88 | `FE-AAA-GA-01` — full AAA core-flow implementation: 7:1 contrast, CAPTIONS + transcripts, 44×44px all targets, motion, SC 1.4.8 reflow |
| **AAA certification** | S89 | `FE-AAA-AUDIT-FINAL-01` — 0-violation proof; fix Pentest #5 a11y findings |
| **AAA GA evidence** | S90 | `FE-AAA-FINAL-CONFORMANCE-01` — VPAT update, `docs/A11Y_FULL.md` §6 signed off |

### Per-surface AAA requirements

| Surface | Key AAA criteria |
|---------|-----------------|
| TOWNHALL big screen | 7:1 contrast on question text; `aria-live="polite"` upvote count; SC 2.1.3 keyboard (no exception) |
| CAPTIONS overlay | `aria-live="assertive"` for live stream; font-size 100–200% range; user control per SC 1.2.9; transcript download |
| CANVAS dataviz | Colour-blind-safe palette; `prefers-reduced-motion` static fallback; pattern fills for chart elements (SC 1.4.11) |
| DELIBERATE receipt | Non-technical summary mode (SC 3.1.5 reading level); explicit error identification SC 3.3.3/3.3.4 |
| EMBED playground | Keyboard operable widget preview; focus not obscured by overlay (SC 2.4.12) |
| Native shell | TalkBack/VoiceOver full navigation; no focus trap outside modals; SC 1.3.4 orientation unlocked |
| RETRO/IDEATE boards | Drag-and-drop has keyboard alternative (SC 2.1.3); all operations executable via keyboard + switch access |

### CI enforcement

- **S81+:** `npm run axe:ci` (AA) blocks merge on all new surfaces.
- **S85+:** `npm run axe:ci -- --level aaa` on streams C + D only (non-blocking warn → becomes blocking S88).
- **S88+:** AAA level blocks merge for all new surface commits.
- **S89:** Zero-violation report is a hard v6.0 RC gate (`WCAG AAA audit 0 violations on core flows`).

---

## WebSocket Patterns for New Surfaces

### TOWNHALL queue DO (ADR-0047)

```typescript
// FE-TOWNHALL-WS-01 — never poll; use WS only in LIVE/TOWNHALL state
const { state, send, status } = useWebSocket(sessionCode)

// Outbound moderator action
send({ type: 'moderator_action', questionId, action: 'approve' | 'reject' | 'pin' })

// Inbound — reduce into local queue state
case 'question_approved':   // add to approved list, announce via aria-live
case 'upvote_delta':        // update count in shadow state, debounced DOM write
case 'question_rejected':   // remove from pending list
```

Reconnect: standard `BACKOFF = [2000, 4000, 8000]` from shared hook; `aria-live="polite"` reconnect banner on disconnect.

### CAPTIONS stream (ADR-0051)

Captions arrive as a sub-channel of the session WebSocket (`caption_chunk` message type). The `FE-CAPTIONS-OVERLAY-01` component subscribes via `useWebSocket` state and does **not** open a second connection. `aria-live="assertive"` is scoped to the caption region only to avoid flooding screen readers with live vote counts simultaneously.

---

## State Management Notes

| Feature | State home | Rationale |
|---------|-----------|-----------|
| Offline vote queue | `IndexedDB` via wrapper hook `useOfflineQueue` | Survives app reload; synced on reconnect |
| RETRO/IDEATE board content | SWR (`/api/sessions/:id/workspace`) | Draft workspace = REST; live annotation = WS |
| TOWNHALL question queue | WS state (DO projection) | Do not REST-poll in LIVE; use `useWebSocket` |
| CAPTIONS buffer | Local component state (ring buffer, 30 lines) | No persistence required |
| Theme/canvas preferences | `localStorage` + React context | Survives reload; no server round-trip |
| Earnings / KYC status | SWR (`/api/marketplace/partner/earnings`) | REST-driven; no real-time requirement |
| DELIBERATE receipt | SWR (`/api/sessions/:id/deliberate/receipt`) | Immutable after tally close; cache forever |

---

## Deferred to S91+

- Full custom white-label theme builder (CANVAS only ships preset picker this arc)
- AR/VR session mode (out of scope per master plan)
- Offline RETRO boards (offline voter shell is S81; full offline workspace deferred)
- Marketplace buyer-side review/rating UI (payout side ships S83; review UX S91+)
- Native app in-session co-presenter mode

---

## FE Point Budget by Sprint

| Sprint | Stream A | Stream B | Stream C | Stream D | Total FE |
|--------|----------|----------|----------|----------|----------|
| S81 | 39 | — | — | — | **39** |
| S82 | 13 | 21 | — | — | **34** |
| S83 | — | 21 | — | 5 | **26** |
| S84 | — | 8* | 26 | — | **34** |
| S85 | — | — | 34 | 5 | **39** |
| S86 | — | — | 18 | 8 | **26** |
| S87 | — | 21 | 8 | 5 | **34** |
| S88 | — | — | — | 52 | **52** |
| S89 | — | — | — | 29 | **29** |
| S90 | — | — | — | 26 | **26** |
| **Total** | **52** | **71** | **86** | **130** | **~339** |

_*STAGE-FOUNDATION-01 attributed to Stream B handoff in S84._

**Stretch budget (~41 pts):** RETRO offline boards, marketplace review UI, CAPTIONS multi-speaker diarisation overlay, agent-run status panel depth. Pulled in if stream capacity allows within sprint.

**Arc total FE (committed + stretch): ~380 pts.**

---

## Cross-References

- Master plan: [`SPRINT81_90_PLAN.md`](./SPRINT81_90_PLAN.md)
- Prior arc: [`SPRINT71_80_FRONTEND_PROPOSAL.md`](./SPRINT71_80_FRONTEND_PROPOSAL.md)
- Infra plan: [`SPRINT81_90_INFRA_PLAN.md`](./SPRINT81_90_INFRA_PLAN.md)
- Marketing copy gates: [`MARKETING_SPRINTS_81_90.md`](../marketing/MARKETING_SPRINTS_81_90.md)
- i18n key plan: [`I18N_SPRINT_81_90_PLAN.md`](./I18N_SPRINT_81_90_PLAN.md)
- Accessibility record: [`docs/A11Y_FULL.md`](../../../docs/A11Y_FULL.md)
- Backlog: [`BACKLOG_MASTER.md`](../backlog/BACKLOG_MASTER.md)
