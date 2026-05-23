---
id: ANON-DEPTH-02
type: evidence
status: active
created: 2026-05-22
---

# Zero-Knowledge Mode — Technical Proof

## Claim

When `session.anonymity = 'zero_knowledge'`, Qesto does **not** store participant identity (email, name, stable user id) for voters.

## Mechanism

1. **Join path:** Participants connect via join code without account. `deriveVoterIdentity()` hashes `ipHash + browser fingerprint` into a per-session `voterId` — no email.
2. **D1 votes:** `votes` rows store `voter_id` as opaque hash only; no PII columns on voter records.
3. **WebSocket:** SessionRoom attachments hold `voterId` + `ipHash` in DO memory for deduplication; not written to audit tables with email.
4. **AI:** Sentiment inference and per-response AI features are **disabled** (ADR-0011, `session-context.ts` gates).
5. **Integrations:** Slack/Teams payloads use aggregate counts only; zero-knowledge sessions still allow close notifications without voter lists.

## Limits (honest)

- Network operator (Cloudflare) sees TLS metadata; not Qesto-stored identity.
- Host may run identified sessions in the same team; ZK applies per-session config.
- Open-text responses in non-ZK modes may contain self-identification; hosts should warn participants.

## UI

Participants see trust copy on join when ZK is enabled (`JoinPage`, i18n `join.zero_knowledge_banner`).

See ADR-0010 and sales comparison [`../product/sales/VEVOX_COMPARISON.md`](../product/sales/VEVOX_COMPARISON.md).
