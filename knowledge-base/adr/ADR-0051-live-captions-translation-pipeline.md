---
id: ADR-0051
status: accepted
created: 2026-06-13
accepted: 2026-06-13
deciders: architect, product-owner, ai-engineer, backend, frontend, security
relates_to: SPRINT81_90_AI_PLAN, SPRINT81_90_PLAN, BACKLOG_MASTER, ADR-0001-do-per-session, ADR-0005-do-protocol-versioning, ADR-0007-circuit-breaker, ADR-0009-pii-sanitization, ADR-0010-zero-knowledge-mode, ADR-0011-live-sentiment-inference, ADR-0046-live-facilitator-copilot
---

# ADR-0051: Live Captions & Translation Pipeline (Workers AI)

## Context

The CAPTIONS epic (E88, S88–S89) ships `CAPTIONS-PIPELINE-01`: a presenter speaks, and every
participant sees a **live caption overlay in their own language**. Per the AI plan, CAPTIONS is
one of Qesto's **two genuinely AI-first bets** (alongside agentic facilitation): the captioning
and translation *are* model inference — no model, no feature
(`SPRINT81_90_AI_PLAN.md:40`, `:44`). This is not an AI-shaped accelerator over a workflow that
already works; it is a pure inference surface.

This ADR exists before a line of code because the load-bearing decisions are architectural, not
implementational, and three constraints make them non-obvious:

- **The privacy moat is the product.** Qesto's defensible position vs. Mentimeter/Slido/Zoom
  captioning is that **no audio and no transcript ever leaves the Cloudflare edge** — Workers AI
  only, `c.env.AI.run(...)`, never OpenAI/Anthropic/Google or any third-party ASR/MT service
  (hard rule #1; `SPRINT81_90_AI_PLAN.md:28`, `:109`). Every competitor streaming presenter audio
  to a hyperscaler ASR endpoint breaks exactly the guarantee Qesto sells. A single fetch to an
  external transcription API would void this ADR's entire reason to exist. Audio is therefore
  **transient-only**: it lives in a request buffer for the length of one inference call and is
  never persisted, logged, or forwarded.

- **The single-threaded DO must not host inference.** `SessionRoom` is the LIVE realtime
  authority and runs one event loop per session (ADR-0001). A Whisper or translation call on that
  hot path would block voting and broadcast for the call's full duration and couple inference cost
  to connection count — the exact failure mode ADR-0046 rejected for the copilot. ASR/MT inference
  must run **off the DO**, in the stateless Pages Function, with the DO doing only what it is good
  at: fan-out of small messages to connected sockets.

- **Captions are AI outputs, so they are eval-gated (REV-10).** ASR transcripts and MT
  translations are model outputs subject to the AI-eval gate: a change to the ASR/MT prompt,
  model, or output schema requires `npm run test:eval` green with golden fixtures
  (`CLAUDE.md` hard rule #6). The CAPTIONS GA claim at S89 is itself gated on a **Word-Error-Rate
  bar** for EN + the top 4 locales (`SPRINT81_90_AI_PLAN.md:102`). S88 *sets* the bar and ships
  the pipeline behind it; S89 (`CAPTIONS-GA-01`) signs it off.

Constraints carried in: Workers AI only / no third-party egress (hard rule #1); secrets via
`wrangler pages secret put`, never `wrangler.toml` (hard rule #2) — though CAPTIONS introduces no
new secret; edge-first (Pages Functions + DO, no new infrastructure); the `{ ok, data, trace_id }`
envelope; the additive-message discipline of ADR-0005 (new realtime variants on protocol v3 with
**no version bump**, the energizers/townhall/copilot precedent); the circuit-breaker posture for
Workers AI calls (ADR-0007); aggregate-/content-privacy boundaries (ADR-0009/0010/0011); and the
5-locale matrix (`en/nl/es/de/fr`, `src/i18n/index.ts:15`).

## Decision

Ship a **stateless edge ingest → Workers AI ASR → fan-out translate → DO broadcast** pipeline.
Presenter audio is chunked and POSTed to an authenticated API route; the route runs Whisper-family
ASR on Workers AI, translates the resulting segment **once per active target locale** via a
Workers AI MT model, and pushes the finished segments into the `SessionRoom` DO, which broadcasts
them as a new additive `caption_segment` `ServerMessage`. No audio or transcript is persisted. The
feature is gated on a new `liveCaptions` entitlement (Team tier+) and on a per-locale WER quality
bar. No new infrastructure, no new protocol version, no third-party call.

### 1. Pipeline stages

```
(a) capture      Present.tsx: presenter mic → MediaRecorder, ~1–2s Opus/webm chunks
       │           (capture only when presenter has toggled captions ON)
       ▼ HTTPS POST (audio chunk, presenter-authed)
(b) ASR          POST /api/sessions/:id/captions/ingest  (Pages Function, OFF the DO)
       │           c.env.AI.run('@cf/openai/whisper', { audio: [...bytes] })
       │           → { text, (word-level segments) }  ; source locale fixed by presenter
       ▼ (transient buffer discarded here — audio never persisted)
(c) MT           for each ACTIVE target locale L ≠ source (de-duplicated set, §2):
       │           c.env.AI.run('@cf/meta/m2m100-1.2b',
       │             { text, source_lang: src, target_lang: L })
       │           → translated text for L     (skipped entirely if no remote target locales)
       ▼ DO fetch (internal): push { source + per-locale variants }
(d) delivery     SessionRoom broadcasts caption_segment ServerMessage to each socket,
                   selecting the variant matching that socket's chosen captionLocale.
```

- **(a) Capture** is presenter-only and opt-in: the FE starts `MediaRecorder` only after the
  presenter toggles captions on (a `captions_start` `ClientMessage`, §2). Chunk cadence is ~1–2s
  to keep the partial-update cadence inside the latency budget. The mic stream is never sent over
  the WebSocket; it is POSTed to the ingest route (audio belongs on HTTP, not the DO hot path).

- **(b) ASR** runs in the stateless ingest route via Workers AI Whisper-family
  (`@cf/openai/whisper`, or the current Whisper model in the Workers AI catalog at implementation
  time — routed behind `ai.ts` so the model ID can be swapped without touching the route,
  `SPRINT81_90_AI_PLAN.md:91`). The audio bytes exist only as a request-scoped buffer; once
  `AI.run` returns, the buffer is dropped. **No audio is persisted** — not to KV, D1, R2, or AE.

- **(c) MT** is conditional and **fan-out-once-per-locale** (§2): the source-language segment is
  emitted as-is, and the route translates it once for each *distinct remote target locale* among
  connected participants, via the Workers AI MT model (`@cf/meta/m2m100-1.2b` family). If every
  participant reads the source language, the MT stage is skipped entirely (zero translation cost).

- **(d) Delivery** rides the existing realtime path: the route pushes the assembled segment
  (source text + per-locale variants) into the DO over the internal fetch the DO already exposes
  for server-originated events; the DO broadcasts a `caption_segment` to each socket, selecting the
  variant for that socket's `captionLocale`. No per-participant inference happens at broadcast time.

### 2. Delivery transport — additive `caption_segment` ServerMessage, locale fan-out at ingest

Captions ride the **existing SessionRoom WebSocket**, consistent with how DELIBERATE/RETRO/townhall
live state flows. This is an **additive `ServerMessage` family on protocol v3** — ADR-0005 permits
additive message types without a version bump (the energizers/townhall/copilot precedent;
`realtime.ts:25` `LiveProtocolVersion = 1 | 2 | 3`). **No new DO protocol version.**

**Server → client segment shape:**

```ts
| {
    v?: LiveProtocolVersion
    type: 'caption_segment'
    data: {
      id: string          // stable segment id; a partial and its finalization share the same id
      ts: number          // segment start time (unix ms) for ordering / overlay timing
      lang: string        // the locale of `text` in THIS message (matches the socket's captionLocale)
      text: string        // caption text already in the recipient's locale (source or translated)
      isFinal: boolean     // false = partial (in-flight ASR), true = finalized segment
    }
    timestamp: number
  }
```

- **Partial vs finalized.** ASR emits an in-flight `isFinal:false` partial as a chunk is
  transcribed, then a corrected `isFinal:true` segment sharing the **same `id`**. The overlay
  replaces the partial with the final in place (no flicker, no duplicate line). Only finalized
  segments are translated when the cost/quality tradeoff favours it; partials may be source-only to
  keep latency low (an implementation-tunable, not a contract change).

- **Fan-out once per active target locale, never per participant.** The DO tracks the set of
  *distinct* `captionLocale` values across connected sockets (a small `Set<locale>`, maintained on
  `captions_set_locale` and on disconnect). The ingest route translates each finalized segment
  **once per distinct remote locale in that set** and the DO addresses each variant to the sockets
  that chose it. Ten thousand participants reading three languages cost **three** MT calls per
  segment, not ten thousand. A participant whose locale is the source language receives the source
  variant with zero MT cost.

- **Latency budget.** Target **< ~2s end-to-end** (mic chunk → overlay) for the source-language
  partial; translated finals arrive shortly after. The ~1–2s chunk cadence plus a single ASR call
  (2–8s class, but on short chunks far lower) plus one MT call per locale must stay inside this
  envelope; partials update the overlay continuously so perceived latency tracks the partial, not
  the final. The Workers AI calls are **circuit-broken** (ADR-0007): on OPEN, the pipeline degrades
  to "captions paused" rather than erroring the session.

### 3. Where ASR runs — stateless ingest route, NOT the DO

**Recommended (edge-correct): presenter audio is POSTed to a Pages Function ingest route that
runs Workers AI off the DO hot path, then pushes results into the DO for broadcast.**

```
POST /api/sessions/:id/captions/ingest   (presenter-authed; the ONLY audio entry point)
  body: audio chunk (binary)  +  segment metadata (source locale, chunk seq)
  → c.env.AI.run('@cf/openai/whisper', …)        // ASR, transient buffer
  → c.env.AI.run('@cf/meta/m2m100-1.2b', …) × active locales  // MT, conditional
  → DO.fetch(internal: broadcast caption_segment)  // hand finished segments to the DO
  → 202 { ok, data: { id, isFinal }, trace_id }
```

This mirrors the ADR-0046 decision (inference in the stateless function, the DO holds only
aggregate/broadcast state) for the same reasons:

- **Latency/cost decoupled from connections.** ASR/MT cost is a function of *speech*, not of how
  many participants are connected. Running it in the DO would serialize every inference behind the
  DO's single event loop and block vote/broadcast handling for seconds at a time.
- **Audio stays off the realtime plane.** The DO never receives audio bytes — only small text
  segments to fan out. The audio buffer's entire lifetime is one HTTP request in a stateless
  isolate; nothing about it is durable.
- **Cost note.** Per-chunk ASR + per-locale MT is the dominant cost; it is metered per active
  caption-on minute, not per participant (the fan-out-once discipline of §2 is what keeps it
  bounded). The ingest route should debounce/coalesce very short chunks to avoid paying ASR
  fixed-cost on sub-second fragments.

Rejected alternative: **DO ingests audio directly over the WebSocket** (§Alternatives) — blocks
the single-threaded room and puts audio on the realtime plane.

### 4. Locale gating & WER bar — quality-gated 5-locale matrix

CAPTIONS is tied to Qesto's five locales (`en/nl/es/de/fr`). A target locale is **enabled only
when its translation quality clears the Word-Error-Rate bar** that S88 sets and S89 signs off
(`SPRINT81_90_AI_PLAN.md:102`). The matrix is source × target:

| Source \ Target | en | nl | es | de | fr |
|---|---|---|---|---|---|
| **en** | source | gated | gated | gated | gated |
| **nl** | gated | source | gated | gated | gated |
| **es** | gated | gated | source | gated | gated |
| **de** | gated | gated | gated | source | gated |
| **fr** | gated | gated | gated | gated | source |

- **EN ↔ {nl,es,de,fr}** is the S88 priority pair set (the "EN + top 4 locales" the WER bar names);
  non-English source→target pairs are enabled as their WER clears the bar (likely S89+).
- **A pair below the WER bar is not offered as a participant caption locale** — the FE locale picker
  shows only pairs enabled for the session's source language. A disabled pair degrades gracefully to
  the source-language caption (the participant still sees captions, just not translated), never to
  an error or a low-quality translation shipped as if it were good.
- **Enablement is config, not code.** The enabled source→target matrix lives as a server-side
  config map (defaulting EN-source pairs ON at the S88 bar) so a locale can be enabled/disabled by
  quality **without a deploy** — the same "WER-bar gating" lever the AI plan calls for. The WER
  measurement itself is an eval artifact (§6), not a runtime check on the hot path.

### 5. Plan gating — `liveCaptions` FeatureKey, Team tier+

A new `liveCaptions: boolean` in `PlanQuotas.featuresUnlocked` (`functions/api/types.ts:313`),
gated by `planMiddleware` at the **ingest route** and at caption-start: `free=false,
starter=false, team=true`. Team-tier+ matches the `townhallQA` / `crossSessionInsights` /
`verifiableVoting` / `embedWidgets` Team-only precedent — live multilingual captioning is an
enterprise/event-tier capability and its per-minute inference cost suits the highest tier. Lower
tiers get an upsell affordance on the caption toggle; no inference runs and no segment broadcasts.

The gate is enforced on the **presenter-side ingest + start**. The DO broadcast path does not
re-check the plan (the presenter already cleared it to turn captions on); participant
`captions_set_locale` is a free read-side preference, not a gated action.

### 6. Privacy & compliance — transient-only, no egress, eval-gated

- **No audio/transcript egress (the moat).** Audio exists only as a request-scoped buffer inside
  one `AI.run` call and is discarded immediately after. Transcripts/translations are broadcast to
  connected sockets and **not persisted** (default; §8). No CAPTIONS data path touches any
  third-party endpoint — Workers AI only. This is asserted structurally: the ingest route has no
  external `fetch`, and no KV/D1/R2/AE write of audio or transcript content exists.
- **GDPR.** Because nothing is stored, there is no caption data subject to access/erasure beyond
  the live broadcast — the cleanest possible posture. Presenter consent to be transcribed is a
  presenter-side UI affordance (the presenter opts in by toggling captions). If transcript export
  is ever added (§8), it becomes an **explicit opt-in** with its own consent-log entry.
- **PII / sensitive-content boundary (ADR-0009).** Caption text is the presenter's own spoken
  words, broadcast to a session the presenter controls — it is not per-participant data and does
  not cross the ZK boundary (ADR-0010): captions are about the *presenter's* speech, orthogonal to
  participant anonymity. `safeLogContext()` covers the ingest route; **no transcript text is
  written to AE** (trace ids and timing only).
- **AI-eval gate (REV-10 / hard rule #6).** ASR and MT outputs are AI outputs. Shipping or changing
  the CAPTIONS pipeline requires `npm run test:eval` green against **golden fixtures**:
  `tests/eval/fixtures/captions-asr-golden.json` (reference audio → expected transcript, asserting
  WER ≤ bar for EN + top 4 locales) and `tests/eval/fixtures/captions-mt-golden.json` (source
  segment → expected translation per enabled pair, asserting translation quality ≥ bar). A pair
  whose fixtures do not clear the bar is **not enabled** in the §4 matrix. The WER bar is the GA
  gate (`CAPTIONS-GA-01`, S89).

### 7. Accessibility — WCAG AAA live-captions enabler

Live captions are the enabler for **WCAG 2.1 AAA SC 1.2.4 (Captions, Live)**. The FE overlay
(`Present.tsx` / a participant overlay component) must itself be AAA-compliant:

- **Contrast** — caption text meets AAA contrast (≥ 7:1) against its backing, including a
  semi-opaque scrim so captions remain legible over any slide/visual.
- **Positioning** — captions are positioned not to obscure live results/options and are
  reflowable; they must not trap focus or overlay interactive vote controls.
- **User control** — captions are **user-resizable** (text size control) and dismissible; the
  participant chooses their `captionLocale` (or "off"). Reduced-motion: partial→final replacement
  must not animate distractingly.

This is a frontend acceptance criterion for `CAPTIONS-PIPELINE-01` and an axe/a11y test target.

### 8. Data model hint — default NO persistence; export deferred to S89

**Default: no migration, no table.** Captions are transient broadcast; nothing is stored. This is
the recommended posture for `CAPTIONS-PIPELINE-01` and the strongest privacy story.

Two *optional* future needs, both **deferred to S89 / out of S88 scope** unless PO pulls them in:

- **Locale-enablement config** — the §4 enabled-matrix can live as a small server-side config map
  / KV value rather than a table; no migration required for S88.
- **Transcript export opt-in** — if a later story adds "download the session transcript," it
  requires explicit presenter opt-in and a store. Proposed shape, for the backend to implement
  **only when that story lands** (next free migration index — `0056_caption_transcripts`, since
  `0055` is taken by `embed_widgets`):

```
caption_transcripts(            -- ONLY if transcript-export opt-in is in scope (defer to S89)
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL,
  source_lang  TEXT NOT NULL,
  segment_ts   INTEGER NOT NULL,
  text         TEXT NOT NULL,    -- source-language finalized segment text
  created_at   INTEGER NOT NULL
)
-- idx_caption_transcripts_session ON (session_id)
-- written ONLY when session.captionsExportOptIn = true; absent otherwise
```

**Recommendation: defer export to S89.** Ship `CAPTIONS-PIPELINE-01` with zero persistence so the
"nothing is stored" guarantee holds without caveat; revisit export as a separately-consented S89
story if customers ask for it.

## Alternatives considered

- **Any third-party ASR/MT (hyperscaler speech API, external MT)** — rejected, non-negotiable. It
  voids the privacy moat that is the entire point of CAPTIONS and breaks hard rule #1. Workers AI
  Whisper + M2M100 is the only compliant path; it is also what makes the feature defensible vs.
  competitors who ship audio off-platform.
- **Run ASR/MT inside the SessionRoom DO** — rejected. A multi-second inference call on the
  single-threaded room (ADR-0001) blocks voting/broadcast and couples cost to connection count, and
  it puts audio bytes on the realtime plane. Stateless ingest route + DO broadcast decouples them
  (the ADR-0046 lineage).
- **Translate per participant rather than per active locale** — rejected as cost-quadratic. At
  5k participants reading 3 languages it is 5k MT calls/segment instead of 3. Fan-out once per
  distinct active locale and address variants to sockets.
- **Broadcast captions over a new dedicated transport / new protocol version** — rejected. Captions
  are small typed messages that belong on the existing WebSocket; an additive `caption_segment`
  variant on protocol v3 (ADR-0005, no bump) is the established pattern (energizers/townhall/
  copilot). A new transport adds an abuse surface and a version migration for no benefit.
- **Persist transcripts by default for export/insights** — rejected for S88. Default persistence
  weakens the "nothing leaves the edge / nothing is stored" guarantee and adds a GDPR data subject.
  Keep transient-only; make any export an explicit, separately-consented S89 opt-in (§8).
- **Ship all 5×5 locale pairs at GA regardless of quality** — rejected. A translation below the WER
  bar shipped as if authoritative is worse than no translation; gate each pair on its fixture WER
  and degrade unenabled pairs to source-language captions (§4).
- **Caption the participant audio / two-way captions** — out of scope. CAPTIONS-PIPELINE-01 is
  presenter-speech → participant-overlay only; participant-side capture reopens consent/anonymity
  questions and is not in the epic.

## Consequences

- A flagship **AI-first** surface ships with **no new infrastructure**: one ingest route, two
  Workers AI model bindings routed behind `ai.ts`, one additive `ServerMessage` + two additive
  `ClientMessage` controls on protocol **v3 (no bump)**, reusing the DO broadcast plane,
  `planMiddleware`, the circuit-breaker, and the `{ ok, data, trace_id }` envelope.
- The **privacy moat holds by construction**: audio is transient (one `AI.run` buffer), nothing is
  persisted, and there is no external fetch on the captions path — the defensible core for any DPA
  review and the competitive differentiator vs. external-ASR competitors.
- **Cost is bounded and metered per caption-on minute**, scaling with *distinct active locales*,
  not participant count — the fan-out-once discipline keeps a 5k-participant trilingual session at
  three MT calls per segment.
- The DO is **untouched except for a small broadcast variant and an active-locale `Set`** — no
  inference, no audio, no protocol version change; the 5k-participant envelope is unchanged.
- A new `liveCaptions` entitlement must be added to **every** tier in `PLAN_QUOTAS`
  (`free/starter=false, team=true`).
- **GA is eval-gated.** `CAPTIONS-PIPELINE-01` ships behind the WER bar in S88 with golden ASR/MT
  fixtures; `CAPTIONS-GA-01` (S89) is the WER sign-off. A pipeline change with no eval evidence does
  not ship (REV-10).
- **Accessibility is a first-class AC**: the overlay is the AAA SC 1.2.4 enabler and must itself
  clear AAA contrast/resize/positioning — captions that fail a11y defeat their own purpose.

## Contract summary for implementers

**Workers AI model bindings (routed behind `ai.ts`; final IDs confirmed against the Workers AI
catalog at build time):**
- ASR — `c.env.AI.run('@cf/openai/whisper', { audio: [...bytes] })` (Whisper-family).
- MT  — `c.env.AI.run('@cf/meta/m2m100-1.2b', { text, source_lang, target_lang })` (M2M100 family),
  **once per distinct active target locale**, skipped when no remote locale is active.
- Both calls **circuit-broken** (ADR-0007); OPEN → captions degrade to "paused", session unaffected.

**API route (presenter-authed, the only audio entry point; off the DO):**
- `POST /api/sessions/:id/captions/ingest` — body: audio chunk + `{ sourceLocale, seq }`; runs ASR
  → conditional MT → pushes `caption_segment` into the DO; returns `202 { ok, data:{ id, isFinal },
  trace_id }`. Gated by `authMiddleware` (presenter) + `planMiddleware('liveCaptions')`. **No audio
  or transcript persisted.**

**`caption_segment` ServerMessage (additive on protocol v3, NO version bump — `realtime.ts`):**
```ts
{ v?, type: 'caption_segment',
  data: { id: string; ts: number; lang: string; text: string; isFinal: boolean },
  timestamp: number }
```
`id` shared by a partial (`isFinal:false`) and its finalization (`isFinal:true`); `lang`/`text`
are already in the recipient socket's chosen locale (source or translated).

**ClientMessage controls (additive on protocol v3):**
- presenter: `{ type: 'captions_start', data: { sourceLocale } }` / `{ type: 'captions_stop', data: {} }`
- participant: `{ type: 'captions_set_locale', data: { locale: 'en'|'nl'|'es'|'de'|'fr'|'off' } }`
  (drives the DO's distinct-active-locale `Set` that bounds MT fan-out).

**FeatureKey:** `liveCaptions: boolean` in `PlanQuotas.featuresUnlocked` — `free=false,
starter=false, team=true`. Enforced at ingest + caption-start; broadcast/locale-select not re-gated.

**Locale matrix (source × target, `en/nl/es/de/fr`):** per-pair enablement gated on the S88 WER
bar; EN-source pairs are the S88 priority set; unenabled pairs degrade to source-language captions,
never to a low-quality translation or an error. Enablement is server-side config (no deploy to
toggle).

**Eval-fixture requirement (REV-10, GA gate):** `tests/eval/fixtures/captions-asr-golden.json`
(audio → transcript, WER ≤ bar) and `tests/eval/fixtures/captions-mt-golden.json` (segment →
translation per enabled pair). `npm run test:eval` must be green; a pair failing its fixtures is
not enabled. WER sign-off is `CAPTIONS-GA-01` (S89).

**Persistence:** **none by default** (transient broadcast only). Transcript export is deferred to
S89; if pulled in, it is an explicit opt-in writing to `0056_caption_transcripts` (proposed shape
in §8) — not part of `CAPTIONS-PIPELINE-01`.

## Docs updated

- This ADR created: `knowledge-base/adr/ADR-0051-live-captions-translation-pipeline.md`.
- Implementers building `CAPTIONS-PIPELINE-01` must update: `SPEC_BACKEND` (ingest route + ASR/MT
  orchestration + circuit-breaker), `SPEC_REALTIME` (`caption_segment` ServerMessage +
  `captions_start`/`captions_stop`/`captions_set_locale` ClientMessages, additive on v3, DO
  active-locale `Set` + broadcast), `SPEC_FRONTEND` (presenter mic capture + AAA caption overlay +
  participant locale picker), `SPEC_INTEGRATIONS` (Workers AI model routing in `ai.ts`),
  `SPEC_DATAMODEL` (only if export opt-in lands: `caption_transcripts`). Canonical code sources to
  mirror this contract into: `functions/api/realtime.ts` (message types), `functions/api/types.ts`
  (`liveCaptions` key in `PlanQuotas.featuresUnlocked` + `PLAN_QUOTAS`), `functions/api/lib/ai.ts`
  (model routing), and `tests/eval/fixtures/` (golden fixtures).

## References

- `knowledge-base/product/planning/SPRINT81_90_AI_PLAN.md` (CAPTIONS AI-first verdict :40/:44;
  model table :88/:89/:91; WER GA gate :102; Workers-AI-only hard rule :28/:109;
  `CAPTIONS-PIPELINE-01` S88 / `CAPTIONS-GA-01` S89 :73/:74) and `SPRINT81_90_PLAN.md` (E88)
- `knowledge-base/product/backlog/BACKLOG_MASTER.md` — CAPTIONS epic (E88) stories
- `functions/api/realtime.ts` (`ClientMessage`/`ServerMessage` unions :180/:256; additive-variant
  precedent: energizers/townhall/retro/ideate/deliberate; `LiveProtocolVersion = 1|2|3` :25)
- `functions/api/types.ts` (`PlanQuotas.featuresUnlocked` :313, `PLAN_QUOTAS` Team-only precedent
  :336 — `townhallQA`/`verifiableVoting`/`embedWidgets`)
- `functions/api/lib/ai.ts` (Workers AI model routing — single swap point for ASR/MT model IDs)
- `src/i18n/index.ts:15` (`SUPPORTED_LANGUAGES = ['en','nl','es','de','fr']` — the locale matrix)
- `src/pages/Present.tsx` (presenter run screen — mic capture + overlay host)
- `tests/eval/fixtures/` (golden-fixture convention — `golden-outputs.json`, `pii-outputs.json`)
- ADR-0046 (inference in the stateless function, not the DO; debounced-pull cost discipline;
  plan-gating precedent), ADR-0001 (DO single-threaded — why ASR/MT runs off the room),
  ADR-0005 (additive realtime messages without a protocol bump), ADR-0007 (circuit-breaker for
  Workers AI), ADR-0009 (PII sanitization / `safeLogContext`), ADR-0010 (zero-knowledge boundary),
  ADR-0011 (live aggregate-signal broadcast precedent)
- Hard rules #1 (Workers AI only / no third-party egress — the captions moat), #2 (secrets via
  `wrangler pages secret put` — CAPTIONS adds none), #6 (AI-eval gate / REV-10 — captions are AI
  outputs)
