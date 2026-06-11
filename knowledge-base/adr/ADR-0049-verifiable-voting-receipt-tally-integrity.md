---
id: ADR-0049
status: accepted
created: 2026-06-11
accepted: 2026-06-11
deciders: architect, product-owner, security
relates_to: SPRINT85_99_PLAN, SPRINT81_90_PLAN, BACKLOG_MASTER, ADR-0047-townhall-qa-scale
---

# ADR-0049: Verifiable Voting — Cryptographic Receipt + Merkle Tally Integrity (DELIBERATE mode)

## Acceptance (Sprint 86, 2026-06-11)

**Accepted.** The design below is landing this same sprint (DELIBERATE-RECEIPT-01,
21 pts) and is reconciled to shipped reality:

- **Schema** — `schema.sql` adds `'deliberate'` to the `sessions.session_mode` CHECK
  enum (canonical enum source, per the 0046 town-hall precedent that documents enum
  widenings in `schema.sql`), and the new append-only `deliberate_ballots` table (§2).
  Migration shipped as `migrations/0054_deliberate_ballots.sql` (new table + the
  `session_mode` widening; SQLite cannot `ALTER` a CHECK in place, so `schema.sql` is the
  fresh-DB source while the migration is additive for the new table).
- **Crypto lib** — `functions/api/lib/deliberate-crypto.ts` owns the pure, side-effect-free
  primitives: `sessionFingerprint()`, `ballotCommitment()`, `merkleRoot()`, and a
  `timingSafeEqualHex()` compare (§3). No route handler computes a hash inline — the
  commitment scheme is single-sourced (Shared-primitives gate).
- **Cast / verify / tally** — ballot cast writes one append-only commitment leaf; the
  verify endpoint re-derives and timing-safe-compares; the observer tally export serves
  the public commitment ledger + Merkle root for independent recomputation (§4 API).
- **Forensics** — a verification commitment mismatch reuses
  `functions/api/routes/forensics.ts` / `audit_events` to raise an alert (§5), not a new
  alerting path.

Evidence (DoD, this sprint): independent cryptography review; receipt renders on mobile
(PDF + JSON); verify endpoint ≥1000 concurrent; receipt reveals no other-voter info
(coercion-resistant); Pentest #5 forgery/replay clearance; full unit suite green +
`tsc --noEmit` clean. S87 carries DELIBERATE-RETALLY-01 (re-tally proof) and
DELIBERATE-GA-01 (general availability) — see Follow-ups.

## Context

Qesto's existing vote path is built for **engagement**, not **governance**: a vote is a
row keyed to an opaque `voter_id` (`sha256(ip‖fingerprint)`), tallied server-side, and the
host is implicitly trusted to report the count honestly. That trust model is sufficient for
polls and ranking energizers. It is **not** sufficient for the new verifiable-governance
tier (board consent votes, works-council ballots, association resolutions), where the
forces are different and partly in tension:

- **Verifiability** — a voter must be able to confirm, after the fact, that *their own*
  ballot was counted exactly as cast, and any third-party observer must be able to confirm
  that the published tally matches the published set of ballots, **without trusting the
  Qesto server or the host**.
- **Coercion-resistance** — a receipt that proves *how someone voted* to a third party is
  a coercion instrument. The receipt must let the voter verify their *own* ballot while
  revealing *nothing* about the choice to anyone who does not already hold the voter's
  secret (the ballot nonce). It must also reveal nothing about *other* voters' choices.
- **Workers-AI-only / no third-party egress** (hard rule #1) — and, by extension, **no
  external chain**. "Verifiable" must be achieved with WebCrypto primitives at the edge,
  not by anchoring to a blockchain or a third-party notary. Per the roadmap out-of-scope
  line: *verifiable ≠ blockchain*.
- **GDPR right-to-erasure vs. an immutable integrity ledger** — tally integrity wants an
  **append-only, never-mutated** ledger; Article 17 wants a voter to be able to delete
  their account and have their personal data erased. These appear to conflict.

The resolution to the last tension is the load-bearing design choice of this ADR: **the
integrity ledger holds no personal data**. A ledger row is `(ballot_nonce, commitment,
choice, voter_hash, leaf_index)` — the `voter_hash` is a *salted, anonymous* one-ballot
dedup token, **not a user id**, and there is no row that links a ledger entry back to a
`users.id`. Erasing a user account therefore removes nothing from the ledger because the
ledger never contained the user. The ledger is immutable *and* GDPR-clean because it is, by
construction, anonymous — verification keeps working after the voter deletes their account.

This is the SEC-VOTE-INTEGRITY-01 + **Pentest #5** surface: ballot forgery, ballot replay,
tally substitution, and de-anonymization are the threats this ADR must structurally close.

Non-negotiable constraints carried in: Workers AI / WebCrypto only (no external chain or
LLM API); no PII in any derived or integrity store (ADR-0009 discipline); `schema.sql` is
the canonical CHECK-enum source for fresh DBs (0046 precedent); secrets via
`wrangler pages secret put`.

## Decision

Adopt a **commitment-ledger + Merkle-tally** scheme over an **append-only, anonymous**
D1 table, with a self-verifying voter **receipt**. No new infrastructure, no external
dependency, no LLM call on the vote path.

### 1. New `session_mode = 'deliberate'`

A governance session runs in `session_mode = 'deliberate'`. The value is added to the
`sessions.session_mode` CHECK enum in `schema.sql` (canonical for fresh DBs) and accepted
at the API boundary, mirroring the 0046 town-hall enum widening. The deliberate mode reuses
the existing DRAFT → ENERGIZING → LIVE → CLOSED lifecycle unchanged; it only swaps the
**vote-write path** for the commitment path below and unlocks the receipt/verify/tally
surface. One-shot poll sessions (`session_mode != 'deliberate'`) are entirely unaffected
(regression baseline).

### 2. `deliberate_ballots` — an append-only commitment ledger

The integrity record is a dedicated, **append-only** D1 table — never updated, never
deleted on the cast path:

```
deliberate_ballots(
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL,
  ballot_nonce TEXT NOT NULL,   -- 128-bit random, unique per session (voter secret)
  commitment   TEXT NOT NULL,   -- hex SHA-256 (the public leaf)
  choice       TEXT NOT NULL,   -- the cast choice (public in the final ledger)
  voter_hash   TEXT NOT NULL,   -- salted SHA-256, anonymous one-ballot dedup — NOT a user id
  leaf_index   INTEGER NOT NULL,-- 0-based insertion ordinal, for Merkle leaf ordering
  created_at   INTEGER NOT NULL,
  UNIQUE(session_id, voter_hash),    -- one ballot per voter (dedup)
  UNIQUE(session_id, ballot_nonce)   -- nonce collisions structurally impossible
)
```

- `voter_hash` is a **salted** SHA-256 dedup token derived from the voter's session-scoped
  identity (`sha256(salt‖session_id‖voter_id)`); it enforces one-ballot-per-voter via the
  UNIQUE constraint **without storing or being reversible to a user id**. It is the only
  voter-linked column and it carries no PII and no `users.id`.
- `commitment` is the **public leaf**; `ballot_nonce` is the voter's **secret** (shipped
  only in their receipt). `choice` is recorded so the final ledger is publicly tallyable;
  because the commitment binds `(fingerprint, nonce, choice)`, an observer can confirm the
  ledger is internally consistent, and a voter can prove their own row, but no one can
  forge or substitute a row without the per-ballot nonce.
- **Append-only** is the integrity guarantee: there is no UPDATE/DELETE on this table in
  the cast or close path. Migration `migrations/0054_deliberate_ballots.sql`.

### 3. Commitment scheme (`functions/api/lib/deliberate-crypto.ts`)

All hashing is WebCrypto SHA-256 at the edge — no external service, no LLM, no chain:

```
sessionFingerprint = SHA-256( sessionId : code : createdAt )
commitment         = SHA-256( sessionFingerprint : ballotNonce : choice )
```

- The **session fingerprint** binds every ballot to one specific session instance, so a
  commitment from session A cannot be replayed into session B (cross-session replay
  resistance). It is derived from immutable session facts and is published in the receipt.
- The **commitment** is **coercion-resistant**: it reveals nothing about `choice` to anyone
  who does not hold `ballotNonce` (a 128-bit secret). The voter, holding their own nonce,
  can re-derive and recognise their own commitment; a coercer who is shown the receipt
  learns the voter's choice only because the *voter chose to reveal their own choice* — the
  receipt discloses **only the voter's own ballot**, never another voter's, and the public
  ledger discloses choices in aggregate without binding them to identities.
- The lib is **pure** (no DB, no `c.env`), so it is unit-testable in isolation and is the
  single source of the scheme — no route recomputes a hash inline (Thin-route + Shared-
  primitives gates).

### 4. Tally integrity via a Merkle tree over sorted leaves

On (and after) close, tally integrity is proven, not asserted:

- `merkleRoot(commitments[])` builds a binary SHA-256 Merkle tree over the
  **deterministically sorted** commitment leaves (sort by hex `commitment`, stable, with a
  documented odd-node duplication rule). Sorting (rather than `leaf_index` order) makes the
  root reproducible by any observer from the public set alone, independent of insertion
  timing.
- The **observer tally export** serves the public ledger (`commitment`, `choice`,
  `leaf_index` per row), the per-choice vote counts, the `sessionFingerprint`, and the
  computed `merkleRoot`. An observer **recomputes the Merkle root locally** from the
  published commitments and confirms it matches, and confirms `voteCount ==
  commitmentCount` — i.e. the tally counts exactly the ballots in the ledger, no more, no
  fewer. This is the "500 votes, recompute the root locally" acceptance criterion.
- No AI and no external call is on this path; it is pure hashing over a D1 read.

### 5. Receipt + verify + forensics

- **Receipt** (PDF + JSON, mobile-renderable): `ballotNonce`, `commitment` (hex SHA-256),
  `sessionFingerprint`, the voter's **own** `choice`, and a verify QR/URL. The PDF is
  generated edge-side; the JSON is the machine-checkable form. The receipt is the voter's
  secret-bearing artifact and is the only place the nonce is surfaced.
- **Verify endpoint** re-derives `commitment = SHA-256(storedFingerprint : providedNonce :
  providedChoice)` from the **stored** session fingerprint plus the nonce and choice the
  caller presents, and compares it against the stored ledger commitment with a
  **timing-safe** hex compare (`timingSafeEqualHex`), then confirms the ballot is present
  in the **final tally**. Because the ledger holds no user id, verification works
  **even after the voter deletes their account** — the anonymous ledger is self-sufficient.
- **Tamper → forensics**: a commitment mismatch returns `commitment mismatch` and raises a
  **forensics alert** via the existing `functions/api/routes/forensics.ts` / `audit_events`
  surface (reuse, not a new alerting channel) — covering the "tampered commitment" criterion
  and feeding the integrity-tamper detection that Pentest #5 exercises.

## Data model (TypeScript — `functions/api/types.ts`)

```ts
export type SessionMode = /* …existing… */ | 'deliberate'

export interface DeliberateBallot {
  id: string
  session_id: string
  ballot_nonce: string   // 128-bit random hex — the voter's secret (receipt only)
  commitment: string     // hex SHA-256 — the public leaf
  choice: string
  voter_hash: string     // salted SHA-256 dedup token — anonymous, NOT a user id
  leaf_index: number      // 0-based insertion ordinal
  created_at: number
}

export interface DeliberateReceipt {
  ballot_nonce: string
  commitment: string
  session_fingerprint: string
  choice: string          // the voter's OWN choice only
  verify_url: string      // encodes the QR
}

export interface DeliberateTallyExport {
  session_fingerprint: string
  merkle_root: string
  vote_count: number
  commitment_count: number       // MUST equal vote_count
  counts_by_choice: Record<string, number>
  ledger: { commitment: string; choice: string; leaf_index: number }[]
}

export interface DeliberateVerifyResult {
  verified: boolean
  in_final_tally: boolean
  reason?: 'commitment_mismatch' | 'not_in_tally' | 'unknown_nonce'
}
```

## D1 migration (sketch — `migrations/0054_deliberate_ballots.sql`)

```sql
-- Migration 0054: verifiable governance ballots (ADR-0049, Sprint 86).
-- Apply: wrangler d1 migrations apply qesto_3_db --local
-- Append-only commitment ledger; the session_mode 'deliberate' enum widening is
-- canonical in schema.sql (SQLite cannot ALTER a CHECK in place — 0046 precedent).
CREATE TABLE IF NOT EXISTS deliberate_ballots (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL,
  ballot_nonce TEXT NOT NULL,
  commitment   TEXT NOT NULL,
  choice       TEXT NOT NULL,
  voter_hash   TEXT NOT NULL,
  leaf_index   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE(session_id, voter_hash),
  UNIQUE(session_id, ballot_nonce)
);
CREATE INDEX IF NOT EXISTS idx_deliberate_ballots_session
  ON deliberate_ballots(session_id, leaf_index);
```

> `schema.sql` is the canonical CHECK-enum source for fresh DBs (per the 0046 note); the
> `'deliberate'` `session_mode` value and the `deliberate_ballots` definition are mirrored
> there.

## API surface (new `routes/deliberate.ts`)

| Method + path | Purpose | Gate |
|---|---|---|
| `POST /api/sessions/:id/deliberate/ballots` | cast one ballot: derive nonce + commitment, append leaf, return receipt | participant; session `LIVE` + `session_mode='deliberate'`; UNIQUE dedup |
| `GET /api/sessions/:id/deliberate/receipt` | re-issue the caller's own receipt (PDF/JSON) | the ballot's own voter; coercion-safe (own choice only) |
| `POST /api/sessions/:id/deliberate/verify` | re-derive from (stored fingerprint + nonce + choice), timing-safe compare, confirm in final tally | public (nonce-bearing); ≥1000 concurrent |
| `GET /api/sessions/:id/deliberate/tally` | public commitment ledger + Merkle root + counts for independent recomputation | public after `CLOSED` |

## Security properties (SEC-VOTE-INTEGRITY-01 / Pentest #5)

- **Forgery resistance** — a valid commitment requires the secret `ballotNonce` (128-bit)
  bound with the session fingerprint and choice; without the nonce an attacker cannot
  produce a commitment that the verify endpoint accepts. Injecting a fabricated ledger row
  changes the Merkle root, which observers recompute and reject.
- **Replay resistance** — `UNIQUE(session_id, voter_hash)` blocks a second ballot from the
  same voter; `UNIQUE(session_id, ballot_nonce)` blocks nonce reuse; the session fingerprint
  binds a commitment to one session, blocking cross-session replay.
- **Tally-substitution resistance** — the tally is *recomputed* from the published ledger by
  any observer (Merkle root + `voteCount == commitmentCount`); the server cannot report a
  count that differs from the ledger without detection.
- **Coercion-resistance** — the receipt reveals only the voter's own choice; the public
  ledger reveals choices without identities; commitments reveal nothing about a choice
  without the per-ballot nonce.
- **De-anonymization resistance / GDPR** — the ledger stores no `users.id`; `voter_hash` is
  a salted one-way dedup token. Account deletion erases the user without touching the
  anonymous ledger, and verification still works.
- **Timing-safe compare** — verification uses a constant-time hex compare to avoid leaking
  commitment bytes via response timing.
- **Tamper alerting** — a mismatch raises a forensics alert through existing
  `forensics.ts` / `audit_events`.

## Alternatives considered

- **Blockchain / external-chain anchoring of the tally** — rejected. Violates hard rule #1
  (no third-party egress) and the roadmap out-of-scope line *verifiable ≠ blockchain*. A
  Merkle root recomputable from a public D1 ledger gives the same public-verifiability
  property with zero external dependency, zero gas, and full edge latency.
- **Homomorphic / threshold-encrypted tally (e.g. Paillier, ElGamal mix-net)** — rejected
  for this tier. It buys ballot secrecy on the server, but it is heavy crypto with key-
  ceremony and trustee-management burden that exceeds Workers' 30s CPU / 128MB envelope and
  the v5.2 GA scope. The commitment + anonymous-ledger scheme meets the actual requirements
  (own-ballot verifiability, public tally integrity, coercion-resistance) at far lower
  complexity; homomorphic tallying is a possible future tier, not a v5.2 GA need.
- **Sign each ballot with a server key (HMAC/asymmetric signature)** — rejected as the
  integrity primitive. A server signature proves *the server* attested a ballot; it does
  **not** let an observer detect a dishonest server that omits or substitutes ballots. A
  recomputable Merkle root over the public ledger removes the server from the trust base.
- **Store the receipt server-side keyed to the user** — rejected. Re-introduces a user↔vote
  link, breaking both coercion-resistance and the GDPR erasure story. The nonce-bearing
  receipt held by the voter is the only place the secret lives.
- **Mutable tally table updated on close** — rejected. An updatable tally is exactly the
  trust-the-server failure this ADR closes; the append-only ledger + recomputed root is the
  integrity record.
- **Overload the existing `votes` table** — rejected. Governance ballots have different
  integrity, dedup, and erasure semantics (append-only, nonce-bound, anonymous-by-
  construction); a dedicated `deliberate_ballots` table keeps the engagement vote path and
  its mutation semantics unchanged.

## Consequences

- A new verifiable-governance tier ships with **no new infrastructure and no external
  dependency** — WebCrypto SHA-256 over an append-only D1 table, reusing the session
  lifecycle, `forensics.ts` / `audit_events`, and `planMiddleware` gating.
- The GDPR ⇄ immutable-ledger tension is **structurally** resolved: the ledger is anonymous
  by construction, so it is both append-only *and* erasure-clean; verification survives
  account deletion. This is the design's defensible core for Pentest #5 and any DPA.
- The vote-write path forks by `session_mode`; the engagement vote path and one-shot poll
  sessions are untouched (regression baseline).
- The voter holds a secret (the nonce in their receipt). Losing the receipt means losing the
  ability to *self-verify* a specific ballot — but it does **not** affect the public tally
  integrity, which is independent of any individual receipt. This is an accepted, documented
  property of coercion-resistant receipt schemes, surfaced in receipt UX copy.
- The commitment scheme is single-sourced in `deliberate-crypto.ts`; any future change to
  the hash construction is an AI-eval-style breaking change requiring re-issued receipts and
  is gated behind a new ADR (the scheme is part of the public verification contract).
- Tally and verify are pure D1-read + hashing — cheap, cacheable for the public tally, and
  trivially scalable to the ≥1000-concurrent verify DoD.

## Follow-ups (Sprint 87)

- **DELIBERATE-RETALLY-01 (S87)** — independent re-tally proof: a standalone verifier
  (published spec + reference recompute) that ingests the public tally export and reproduces
  the Merkle root and per-choice counts, closing the "observer can verify without Qesto"
  loop end-to-end. Evidence required against a sealed 500-ballot fixture.
- **DELIBERATE-GA-01 (S87)** — general availability of the deliberate tier: plan-gating
  finalised, receipt UX localised (EN/NL/ES/DE/FR), and the cryptography-review findings
  from this sprint folded in before GA.

## References

- `knowledge-base/product/backlog/BACKLOG_MASTER.md` — DELIBERATE-RECEIPT-01 (S86, 21 pts,
  acceptance criteria + DoD ~line 1783); DELIBERATE-RETALLY-01 / DELIBERATE-GA-01 (S87)
- `knowledge-base/product/planning/SPRINT85_99_PLAN.md`,
  `knowledge-base/product/planning/SPRINT81_90_PLAN.md` (deliberate-governance epic)
- `knowledge-base/adr/ADR-0047-townhall-qa-scale.md` (anonymous author_hash / audit-only
  identity precedent — the anonymity-by-construction lineage this ADR extends to a ledger)
- `knowledge-base/adr/ADR-0046-live-facilitator-copilot.md` (canonical `schema.sql` CHECK-
  enum widening note)
- `schema.sql` (`sessions.session_mode` enum, `deliberate_ballots`),
  `migrations/0054_deliberate_ballots.sql`
- `functions/api/lib/deliberate-crypto.ts` (sessionFingerprint / ballotCommitment /
  merkleRoot / timingSafeEqualHex), `functions/api/routes/deliberate.ts`
- `functions/api/routes/forensics.ts`, `audit_events` (tamper alerting)
- `functions/api/lib/pii-sanitization` discipline (ADR-0009 — no PII in derived/integrity
  stores), hard rule #1 (Workers AI / WebCrypto only — no external chain or LLM API)
