---
id: ADR-0060
status: accepted
created: 2026-06-18
accepted: 2026-06-18
deciders: ai-engineer, architect, product-owner, security, dpo
relates_to: ADR-0058, ADR-0059, ADR-0062, SPRINT85_99_PLAN, SPRINT91_99_STORIES
---

# ADR-0060: Analytics Insight Intelligence — Privacy-Native AI Session Authoring Co-pilot

## Status

Accepted (S96). Governs the STUDIO authoring track (E97) — the first surface where AI
*generates session content* (questions/drafts) for a facilitator, rather than summarising
existing responses. STUDIO sits behind the same egress governance ADR-0059 opened for the
v7.0 arc: authoring is **inference-only with no third-party egress**, so it stays inside the
platform boundary that CONNECT (ADR-0062) and LEARN (ADR-0058) widened.

## Context

Until S96 every AI surface in Qesto was *backward-looking*: `ai-insights` extracts themes
from open responses, the help assistant answers from the KB. STUDIO is the first
*forward-looking* AI surface — a facilitator types a topic and the co-pilot drafts ready-to-run
questions, optionally pre-styled in the team's CANVAS theme so the preview matches what
participants will see.

Three properties frame the decision:

1. **Privacy-native by construction.** The authoring topic is operator-supplied free text. It
   must be treated as untrusted (prompt-injection surface) and must never leave the platform
   boundary. STUDIO uses Workers AI only — no Anthropic/OpenAI/external API, no egress
   (CLAUDE.md hard rule 1, ADR-0059 §1).
2. **Output is never trusted raw.** A generative model can echo injection, drift schema, or
   emit unsafe content. Every draft is Zod-validated against the existing wizard question
   schema and rejected (typed 400) on mismatch — never passed through.
3. **The eval gate is non-negotiable (REV-10).** A generative prompt/model/schema change with
   no before/after eval evidence does not ship; STUDIO ships with golden fixtures from day one.

## Decision

### 1. Authoring co-pilot model — Workers AI Llama, inference-only, no egress

STUDIO calls `c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', …)` only. The
`c.env.AI.run(...)` call is kept thin in the route (`routes/studio.ts`); all prompt
construction and output handling is pure and unit-testable in `lib/studio-authoring.ts`. There
is no outbound network call, so ADR-0059's egress guards are satisfied trivially (nothing
leaves the boundary) — STUDIO authoring is explicitly *not* an egress surface.

The operator `topic` is sanitised through `lib/ai/prompt-sanitize.ts` (control/zero-width
strip + length bound) before it is ever placed in a prompt, hardening the injection surface.
`count` is clamped to 1..10; an over-large or zero request can never reach the model.

### 2. Authoring output schema — reuse the wizard question schema

STUDIO does not invent a new question shape. `parseAuthoringResult(raw)` reuses
`AIQuestionsOutputSchema` / `AIQuestionSchema` from `lib/domain-schemas.ts` and the wizard's
JSON-extraction, repair, normalisation, and heuristic confidence approach
(`lib/ai-wizard.ts`). One question contract across wizard + authoring means one place to
evolve kinds (poll/ranking/consent/open/multi_select/likert/upvote/word_cloud/slider) and one
validator to trust. Typed errors mirror the wizard: `StudioValidationError` (bad output → 400)
and `StudioAIError` (invocation failure → 502).

### 3. Theme embedding — drafts inherit CANVAS theme tokens (STUDIO-THEME)

`lib/studio-theme.ts` exposes a pure `applyThemeToDrafts(drafts, theme)` that attaches the
selected CANVAS theme tokens (colours / font / tone) to each generated draft so the authoring
preview inherits brand styling before the session is created. The `StudioTheme` token type is
aligned to the CANVAS token contract (`src/styles/canvas-themes.css` —
`--canvas-bg/-surface/-border/-text/-accent/-bar-*`, font stacks, line-height). The function is
side-effect free: it returns new draft objects and does not mutate input or touch storage.
Theme application is reported via the existing `studio.theme_applied` AE event.

### 4. Eval-gate obligation — golden fixtures required (REV-10)

`tests/eval/fixtures/studio-authoring-golden.json` is the authoring corpus: valid model
outputs that MUST pass schema validation, and malformed/unsafe outputs (wrong shape, empty
batch, prompt-injection echoes) that MUST be rejected with `StudioValidationError`.
`tests/eval/studio-authoring.eval.test.ts` asserts 100% accept of the good corpus, 100% reject
of the bad corpus, and that `buildAuthoringPrompt` strips injection attempts from `topic`. The
eval runs under `npm run test:eval`; any future change to the STUDIO prompt, model, or schema
must keep it green with updated fixtures.

## Consequences

- **Positive:** one question contract across wizard + authoring; no new egress surface (privacy
  by construction); every draft validated before it reaches the operator; preview matches the
  presentation theme; eval evidence enforced from the first commit.
- **Cost:** the route must thread topic sanitisation + count clamp + Zod validation + audit +
  AE on every call; theme tokens must stay aligned to `canvas-themes.css` as it evolves
  (single source of truth: the CANVAS token contract).
- **Follow-up:** if a future authoring surface needs a *new* persisted route/binding/DB around
  the co-pilot, that is a `qesto-backend` handoff (E28); product scope/priority for STUDIO is a
  `qesto-ai-strategy` decision (E27).

## Compliance / security notes

- Workers AI only — no `ANTHROPIC_API_KEY`, no external LLM SDK/REST, no egress.
- Operator `topic` is sanitised (prompt-injection hardening) before inference; `count` clamped.
- AI output is Zod-validated; invalid output is a typed 400, never raw pass-through.
- AI failure is a typed 502 with graceful degradation (the route never throws raw model errors).
- Authoring drafts are generated content, not participant PII; STUDIO carries no participant
  identity. AE events (`studio.copilot_used`, `studio.theme_applied`) carry counts/timing only.
- `studio.questions.generated` audit action records each generation with a non-PII snapshot
  (count + confidence + theme applied), not the topic text or draft content.
