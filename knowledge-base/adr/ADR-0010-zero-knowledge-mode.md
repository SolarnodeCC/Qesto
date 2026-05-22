---
id: ADR-0010
title: Zero-Knowledge Anonymity Mode
domain: architecture
status: accepted
version: 1.0
created: 2026-05-22
updated: 2026-05-22
tags:
  - privacy
  - anonymity
  - gdpr
  - sessions
relates_to:
  - ANON-DEPTH-01
  - SPEC_REALTIME
---

# ADR-0010: Zero-Knowledge Anonymity Mode

**Backlog:** ADR-0010  
**Status:** Accepted — Sprint 31  
**Gate for:** ANON-DEPTH-01, ANON-DEPTH-02, AI-SENTIMENT-01 (disabled in ZK sessions)

## Context

Enterprise buyers compare Qesto to Vevox and Mentimeter on anonymous Q&A and HR pulse surveys. Qesto already supports `Anonymity` values including `zero_knowledge` in D1/KV session config and participant join UI.

## Decision

### Session configuration

- Host selects anonymity in Session Wizard step 4: `full` | `partial` | `none` | `zero_knowledge`.
- Default remains `partial` for new sessions.
- `zero_knowledge` is persisted on `sessions.anonymity` and forwarded to the Durable Object `Meta.anonymity`.

### Voter identity

- Voter deduplication uses opaque `voterId` (UUID per browser tab / reconnect attachment) — never email or name in ZK mode.
- DO storage keys votes by `voterId` + `optionId` only; audit events for votes use sanitized labels (no free-text answers in audit for poll kinds that could leak content — open/word_cloud still aggregate-only in analytics).

### Participant UX

- Join page shows a trust badge when `anonymity === 'zero_knowledge'` (i18n in all 5 locales).
- Copy: identity is not stored for attribution; technical KB proof deferred to ANON-DEPTH-02.

### AI and integrations

- **AI-SENTIMENT-01** and per-response AI features are **disabled** when session is `zero_knowledge`.
- Integration webhooks may emit aggregate session summaries only — no per-voter identifiers in payload (existing close handlers already aggregate).

### Protocol

- No new WebSocket message types; `init` snapshot includes `session.anonymity` for client rendering.

## Consequences

**Positive:** Sales can demo ZK mode today; GDPR narrative aligns with edge-first architecture.

**Negative:** ZK does not include Vevox-style moderated anonymous discussion threads — scoped to ANON-DEPTH-02 competitive proof doc.

## Acceptance

- [x] `Anonymity` type includes `zero_knowledge`
- [x] Session Wizard + Join badge shipped
- [ ] ANON-DEPTH-02 KB + sales comparison (Sprint 34)
