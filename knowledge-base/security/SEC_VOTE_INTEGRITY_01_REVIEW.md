# SEC-VOTE-INTEGRITY-01 — DELIBERATE Verifiable-Voting Security Review

**Story:** SEC-VOTE-INTEGRITY-01 (Sprint 86, 13 pts) · **ADR:** ADR-0049 · **Reviewer:** security
**Date:** 2026-06-11 · **Surface:** Pentest #5 pre-clearance (forgery / replay / coercion / de-anonymization / tally substitution)
**Methodology:** OWASP Top 10 + STRIDE, governance-vote threat model, code-verified (file:line cited).

Severity legend: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low · ✅ Good practice.

---

## Verdict

**CLEAR for Pentest #5 pre-clearance — conditional, with one fix applied in this review.**

The commitment-ledger + Merkle-tally design (ADR-0049) is structurally sound. The
cryptographic spine resists ballot forgery, cross-session replay, double-voting, and
de-anonymization, and the anonymous-by-construction ledger genuinely survives GDPR
account deletion. **One real tamper-evidence gap (H-1) was found and fixed in this
review** (the forensics alert did not fire on a mutated ledger row). With H-1 fixed, the
remaining findings are Medium/Low hardening items that do **not** block the Pentest #5
pre-clearance surface, but two of them (M-1 secret-salt, M-2 verify rate-limit) should be
folded into DELIBERATE-GA-01 (S87) before general availability.

No release-blocking finding remains open after the H-1 fix. The pre-existing frontend
TypeScript error (L-3) is a CI build-gate blocker that is out of this review's scope but
must be resolved before deploy.

---

## Files audited

| File | Lines reviewed |
|---|---|
| `functions/api/lib/deliberate-crypto.ts` | 1–122 (full) |
| `functions/api/routes/deliberate-sessions.ts` | 1–307 (full) |
| `migrations/0054_deliberate_ballots.sql` | 1–32 (full) |
| `schema.sql` | 195–215 (`deliberate_ballots` block) |
| `knowledge-base/adr/ADR-0049-...md` | 1–358 (full) |
| Supporting: `functions/api/routes/sessions/shared.ts` (`fetchSession`), `functions/api/lib/entitlements.ts`, `functions/api/lib/audit.ts`, auth user-id generation (`auth/helpers.ts`, `magic-link.ts`, `password.ts`, `saml.ts`) | targeted |

---

## Threat-model findings (the 6 required axes)

### 1. Forgery — ✅ structurally closed
A valid commitment requires the secret 128-bit `ballotNonce` bound to the session
fingerprint and choice (`computeCommitment`, crypto:55-61). The session fingerprint
(`sessionFingerprint`, crypto:42-48) binds every commitment to one session instance, so a
commitment minted in session A cannot verify against session B. The verify endpoint
re-derives from the **stored** fingerprint (route:223), not a caller-supplied one, so an
attacker cannot supply a foreign fingerprint. Injecting a fabricated ledger row changes
the Merkle root, which any observer recomputes (`merkleRoot`, crypto:87-100). Regression
coverage added: cross-session replay + never-cast fabrication
(`tests/unit/deliberate-security.test.ts`).

### 2. Replay — ✅ closed
`UNIQUE(session_id, voter_hash)` blocks a second ballot per voter; `UNIQUE(session_id,
ballot_nonce)` blocks nonce reuse (migration:21-22, schema:212-213). A re-cast surfaces as
a `409 already_voted` (route:176-179) — never a silent overwrite, preserving
coercion-resistance (no vote-changing). Nonce is 128-bit CSPRNG (`generateBallotNonce`,
crypto:31-35). Regression coverage added (double-vote → single ledger row).

### 3. Coercion-resistance — ✅ holds (with M-1 caveat)
The receipt discloses only the voter's own choice (route:188-204). The public tally ledger
(route:288) exposes `leafIndex`, `ballotNonce`, `commitment`, `choice` — **never**
`voter_hash` and never a user id. The commitment leaks nothing about `choice` without the
nonce (128-bit blinding). A verify call returns only the caller's `leafIndex` + root, not
other voters' choices. Regression coverage added (no-other-voter-leak, no voter_hash in
tally). **Caveat → M-1:** the `voter_hash` "salt" is the *public* session fingerprint, so
anonymity rests on `user.sub` unguessability rather than a secret.

### 4. Tamper-evidence — 🟠 GAP FOUND (H-1), now FIXED
A mutated ledger row did **not** raise the forensics alert (details in H-1 below). Fixed in
this review. A tampered commitment still shifts the Merkle root (so the public re-tally
detects it), but the server-side forensics signal was missing — now restored.

### 5. De-anonymization / GDPR — ✅ structurally sound
The ledger holds no `users.id` (schema:203-214). `voter_hash` is a one-way SHA-256
truncated to 32 hex (`voterBallotHash`, crypto:69-74) and is the only voter-linked column;
it is never returned in any response. `ON DELETE CASCADE` is on `session_id`, not on any
user FK, so account deletion never touches the ledger and verification keeps working
(route comment:207, ADR §Consequences). Confirmed `user.sub` is a high-entropy ULID
(`auth/helpers.ts:43`), not an email-derived value, which materially lowers M-1's
practical de-anon risk.

### 6. Tally integrity — ✅ deterministic and re-tallyable
`voteCount === commitmentCount === ledger.length` by construction (route:283-284). The
Merkle root is order-independent (sorted leaves, crypto:89) so any observer reproduces it
from the public set. Empty-set root is a documented sentinel (64 zeros, crypto:88). Covered
by `deliberate-crypto.test.ts`.

---

## 🟠 High

### H-1 — Forensics alert misses a mutated ledger row (tamper-evidence gap) — FIXED in this review
- **Where:** `functions/api/routes/deliberate-sessions.ts:239` (original).
- **Issue:** The forensics alert fired only on `inLedger && !commitmentValid`. Consider the
  core Pentest #5 case: an honest voter presents their **original, valid** receipt
  (`commitment`, `ballotNonce`, `choice` all correct) but the stored ledger row's
  `commitment` column was mutated after casting (dishonest server / DB tamper). Then:
  - `commitmentValid` = `true` (the receipt still re-derives), so `!commitmentValid` = `false`;
  - `ledgerCommitmentMatch` = `false` (stored row no longer matches);
  - `verified` = `false` (correctly reported to the voter), **but the alert did not fire.**
  The mutation also silently shifts the published Merkle root with **no server-side
  forensic signal** — exactly the integrity-tamper detection Pentest #5 exercises and the
  ADR §5 "tampered commitment → forensics alert" claim. The ADR claim was therefore
  **unmet** for the most important tamper shape (ledger-row mutation), only met for the
  receipt-forgery / choice-substitution shape.
- **STRIDE:** Tampering + Repudiation (a dishonest operator could mutate the ledger
  undetected by the alert pipeline).
- **Fix applied:** alert now also fires when `inLedger && commitmentValid &&
  !ledgerCommitmentMatch`, tagged `reason: 'ledger_row_tampered'` (vs.
  `commitment_mismatch` for the forgery shape). Minimal-scope change, no business logic
  touched.
- **Verification:** `tests/unit/deliberate-security.test.ts` — the "raises a forensics
  alert when the stored ledger commitment is mutated" test **fails on the original code**
  (alert count 0) and **passes after the fix** (alert count 1). Confirmed by reverting the
  fix in a scratch run.

---

## 🟡 Medium (fold into DELIBERATE-GA-01, S87 — not Pentest-blocking)

### M-1 — `voter_hash` uses the PUBLIC session fingerprint as its "salt" (no server secret)
- **Where:** `functions/api/lib/deliberate-crypto.ts:69-74`
  (`sha256("ballot:" + fingerprint + voterIdentity)`).
- **Issue:** ADR-0049 §2 specifies `voter_hash = sha256(salt ‖ session_id ‖ voter_id)` with
  a *salt*. The implementation's only "salt" is `sessionFingerprint`, which is **published**
  in every receipt and in the tally export. There is no server-held secret in the dedup
  token. Consequently, anonymity of the dedup key rests entirely on `user.sub` being
  unguessable. This is acceptable **today** because `user.sub` is a 128-bit ULID
  (verified — not email-derived), so a dictionary/known-voter attack is infeasible in
  practice. But it is a **design-vs-implementation divergence** from the ADR and removes a
  defence-in-depth layer: if a future change ever made `voter_hash` inputs lower-entropy or
  exposed `user.sub`, an attacker holding the public fingerprint could confirm whether a
  *specific known user* voted (membership de-anonymization) by recomputing the hash.
- **STRIDE:** Information Disclosure (membership inference), defence-in-depth.
- **Severity rationale:** Medium not High — exploit requires already knowing the target's
  ULID, which is itself a secret; no actual leak path found.
- **Recommended fix (GA):** introduce a server-secret salt via
  `wrangler pages secret put DELIBERATE_VOTER_SALT` and hash
  `sha256(secretSalt ‖ fingerprint ‖ voterIdentity)`, matching the ADR. This is a
  `deliberate-crypto.ts` change to the voter-hash construction only (does NOT affect the
  public commitment scheme / receipts — `voter_hash` is never published or re-derived by an
  observer, so changing it does not break any issued receipt). **I did NOT apply this** — it
  is a crypto-construction change better gated to GA with a deliberate secret-provisioning
  step, and it is not Pentest-blocking given the ULID entropy.

### M-2 — `verify` and `cast` endpoints have no rate limit
- **Where:** `functions/api/routes/deliberate-sessions.ts` (no `rateLimit` middleware on the
  mounted sub-app; `app.ts:326`).
- **Issue:** `POST /deliberate/verify` is authenticated but loads the **entire ledger** and
  **recomputes the full Merkle root on every call** (route:229-233). At the ADR's ≥1000-
  concurrent DoD this is an O(n log n) hash recompute per request over an unbounded ledger —
  an authenticated voter can hammer verify and burn Worker CPU (resource-exhaustion / DoS).
  `cast` is similarly unthrottled (one successful ballot per voter via UNIQUE, but failed
  attempts and JSON parsing still consume CPU). No nonce/choice brute-force risk exists
  (128-bit nonce), so this is availability, not confidentiality.
- **STRIDE:** Denial of Service.
- **Recommended fix (GA):** add the existing `rateLimit` middleware (per-IP + per-user) to
  the verify/cast routes; consider caching the per-session Merkle root (it only changes on a
  new cast) rather than recomputing per verify. Aligns with the §H-1/M-6 rate-limit posture
  in `SECURITY_REVIEW_2026-06`.

### M-3 — `tally` endpoint is owner-gated, not "public after CLOSED" as the ADR specifies
- **Where:** `functions/api/routes/deliberate-sessions.ts:264-292` uses
  `fetchSession(..., user.sub)` which constrains `owner_id = user.sub` (`shared.ts:180`).
- **Issue:** ADR-0049 §4 / API table specify the tally export is **public** (observer-
  downloadable for independent re-tally) — that is the entire point of verifiability
  ("any third-party observer must be able to confirm... without trusting the Qesto server").
  As implemented, **only the session owner** can fetch the tally + ledger + root. This does
  not create a vulnerability (it is *more* restrictive, fail-safe), but it **does not
  deliver the verifiability property the feature is sold on**, and it blocks the
  DELIBERATE-RETALLY-01 (S87) "observer can verify without Qesto" acceptance loop.
- **STRIDE:** n/a (functional/spec gap, fail-closed direction).
- **Severity rationale:** Medium — security-safe but a correctness gap against the ADR's
  public-verifiability contract; flagged for product/architect decision (likely:
  unauthenticated read of tally only after `status='closed'`, ledger has no PII so it is
  publishable). **I did NOT change this** — widening an auth gate to public is a deliberate
  product/architecture decision, not a security hardening fix; it needs PO/architect
  sign-off and is out of a security-review's minimal-scope mandate.

---

## ⚪ Low

- **L-1 — `verify` reveals `merkleRoot` to any authenticated caller before close.**
  `verify` (route:233,256) returns the live Merkle root regardless of session status. Minor
  information exposure (interim tally fingerprint) before voting closes; low impact since
  the root reveals no individual choice. Consider gating root exposure to `closed`.
- **L-2 — `leaf_index` assigned via count-then-insert (non-atomic).**
  `cast` reads `COUNT(*)` then inserts with `leaf_index = count` (route:164-174) outside a
  transaction. Two concurrent casts could compute the same `leaf_index`. Impact is cosmetic
  only: the Merkle root sorts by `commitment`, not `leaf_index` (crypto:89), and dedup is by
  `voter_hash`, so a duplicate index does not corrupt the tally or root — but it could
  produce two rows with the same display ordinal. Low. Consider deriving `leaf_index` from a
  monotonic source or accepting it as display-only (document).
- **L-3 — Pre-existing TypeScript build error blocks the CI gate (out of scope).**
  `src/pages/DeliberateJoin.tsx:91` — `tsc --noEmit` fails (TS2352) on the **clean tree**,
  confirmed independent of this review's changes. Hard rule #4 (`tsc --noEmit` must pass)
  means this **blocks deploy**. It is a frontend file outside the SEC-VOTE-INTEGRITY-01
  audit scope; flagged for `qesto-frontend` to fix before release. Not a security finding.
- **L-4 — `config` UPDATE not wrapped with the lifecycle/`changes` check.**
  `deliberate/config` (route:91-93) issues `UPDATE ... WHERE id = ?1 AND owner_id = ?2` but
  does not assert `changes === 1`; an ownership mismatch silently no-ops then returns `200`.
  Ownership is already enforced upstream by `fetchSession(..., user.sub)` (route:82), so this
  is belt-and-suspenders only. Low.

---

## ✅ Good practices observed (keep these)

- **Single-sourced commitment scheme** — all hashing in pure `deliberate-crypto.ts`; no
  route recomputes a hash inline (ADR Shared-primitives gate honoured).
- **Timing-safe compares** on every commitment comparison (`timingSafeEqualHex`,
  crypto:116-121; route:227,232).
- **Parameterized D1** throughout (`.prepare().bind()`); no string-concatenated SQL.
- **Anonymous audit events** — the ballot-cast audit records only `leaf_index`, explicitly
  not choice or voter (route:185), preserving anonymity in the audit trail too.
- **Robust input validation** — Zod `safeParse` with bounded `choice` (≤200) and fixed
  64-hex commitment; malformed JSON returns `400`, never a `500` (route:140-143, 212-215).
- **Entitlement-by-mode** — `cast` correctly does not re-gate the participant's plan; the
  Team-tier `/config` gate is the entitlement, so participants vote without a subscription
  (route:137-139) — sound multi-tenant reasoning.
- **GDPR-clean by construction** — ledger holds no user id; `voter_hash` is one-way and
  never returned; verification survives erasure. This is the design's defensible core.

---

## Changes made in this review

| File | Change | Type |
|---|---|---|
| `functions/api/routes/deliberate-sessions.ts` | H-1 fix: forensics alert now also fires on a mutated ledger row (`inLedger && commitmentValid && !ledgerCommitmentMatch`, `reason: 'ledger_row_tampered'`) | Security hardening (route, minimal-scope) |
| `tests/unit/deliberate-security.test.ts` | New regression suite: tamper-evidence (H-1, both shapes), cross-session forgery, never-cast fabrication, double-vote, coercion/de-anon, voter_hash construction guard | New tests |

**No crypto primitive (`deliberate-crypto.ts`) was changed** — the public commitment /
receipt / Merkle scheme is untouched, so no issued receipt is invalidated. M-1, M-2, M-3
are deliberately **not** applied here (see each finding's rationale) and are recommended
for DELIBERATE-GA-01 (S87).

**Verification:** `npx tsc --noEmit` → 0 errors from changed files (only the pre-existing
L-3 frontend error remains). `npx vitest run tests/unit/deliberate` → 28/28 pass. H-1
regression test confirmed to fail on the un-patched code and pass after the fix.

---

## Pentest #5 scope notes (for the external testers)

- **In scope / structurally closed:** ballot forgery (nonce-bound commitment + session
  fingerprint), cross-session replay (fingerprint binding), double-vote (UNIQUE
  voter_hash/nonce), tally substitution (observer-recomputable Merkle root,
  voteCount==commitmentCount), de-anonymization (no user id in ledger; one-way voter_hash;
  erasure-durable verification), ledger-row tamper detection (H-1 fix — now alerts).
- **Test the H-1 fix directly:** mutate a `deliberate_ballots.commitment` row in the DB,
  then call `/verify` with the original receipt → expect `verified:false`,
  `ledgerCommitmentMatch:false`, and a `deliberate.verify.mismatch` audit event with
  `reason:'ledger_row_tampered'`.
- **Probe these (open hardening, expected behaviour, not exploits):** M-2 verify/cast
  rate-limit (CPU exhaustion at concurrency), M-1 membership inference (only feasible if you
  can obtain a target's `user.sub` ULID — confirm you cannot), M-3 tally currently
  owner-only (confirm no PII would leak if made public).
- **Key invariant to attack:** the Merkle root must equal an independent recompute over the
  published `commitment` set, and `voteCount` must equal the ledger length, for any session
  you can read.
