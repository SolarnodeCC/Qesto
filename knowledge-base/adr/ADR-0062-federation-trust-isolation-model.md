---
id: ADR-0062
status: accepted
created: 2026-08-28
accepted: 2026-08-28
deciders: architect, product-owner, security, dpo
relates_to: ADR-0058, ADR-0059, ADR-0050, ADR-0049, ADR-0010, SPRINT85_99_PLAN, SPRINT91_99_STORIES
supersedes_partial: FEDERATION-01 (template trust links — non-session scope)
---

# ADR-0062: CONNECT — Federation Trust Model & Cross-Tenant Isolation Proof

## Status

Accepted (S95). This is the **CONNECT-00** gating decision. It opens the E96 CONNECT epic
(cross-tenant federated anonymous events, S95→S97 / v7.0-rc) by deciding, **once and up front**,
the federation trust model, the invite envelope, the cross-tenant isolation guarantee, and the
scale-evidence obligation. CONNECT build stories (`CONNECT-JOIN-01`, `CONNECT-ZEROK-01`,
`CONNECT-ISOLATION-01`, `CONNECT-SOVEREIGN-01`, `CONNECT-AUDIT-01`, S96) and the v7.0-rc scale
claim (`QA-CONNECT-SCALE-01`, S97) all hang off the contract decided here.

## Context

Through S94 every Qesto session was single-tenant: one team owns a session, its participants
are its own, and isolation is the team boundary. The market signal (`MARKET_VALIDATION_S85_99`)
for multi-org events, associations, and partner ecosystems asks a harder question: **can N tenants
share one live session without any tenant seeing another tenant's participants or raw data?**

This is the highest-risk surface in the v7.0 arc because it inverts the default trust boundary —
session membership now spans tenants — while three existing guarantees must hold unchanged:

1. **Zero-knowledge anonymity (ADR-0010)** — a ZK session never exposes participant identity.
   Federation must not become a side channel that re-identifies a co-tenant's participants.
2. **Sovereign exclusion (ADR-0058 / ADR-0059)** — a sovereign tenant trades reach for an
   airtight boundary and must **never** join cross-tenant federation. This is already a pure
   guard (`assertFederationAllowed`) and a D1 fragment (`FEDERATION_ELIGIBLE_SQL_FRAGMENT`).
3. **Tenant isolation** — team A's queries must never return team B's rows, federated or not.

S95 (this ADR + `CONNECT-INVITE-01`) ships only the **trust handshake** — scoped, time-limited,
signed invites — plus the **isolation-proof harness** that the Pentest #6 cross-region/cross-tenant
run (S95→S97) asserts against. The actual multi-tenant join lands in S96 behind these gates.

## Decision

### 1. Federation is invite-gated, never open-join

A tenant cannot be added to another tenant's session implicitly. The host tenant mints a
**federation invite** — a scoped, time-limited, HMAC-signed envelope — and the invitee must
present it to join (S96). The envelope is the single source of who-may-join-what:

```
token = base64url(claimsJson) + '.' + hmacSign(CONNECT_INVITE_SECRET, base64url(claimsJson))
```

Claims (`lib/connect-invite.ts`, mirroring the embed-token discipline of ADR-0050 — compact MAC
envelope, not a JWT-with-secrets, not an API key):

| Claim | Meaning |
|-------|---------|
| `v` | Envelope version (`1`); a wrong version is rejected, never coerced. |
| `jti` | Unique invite id — the audit + (future) revocation handle. |
| `sid` | The federated session the invite admits to. |
| `host` | Inviting tenant (team id). |
| `invitee` | Targeted tenant id, or `null` for an open (link-shareable) invite. |
| `scope` | `participate` or `co_host` — the *most* a holder may do; never widened downstream. |
| `iat` / `exp` | Issued-at / expiry. Default TTL **7d**, hard max **30d** (clamped at mint). |

Verification re-signs the payload and compares timing-safe, then checks version, scope, and
expiry. A targeted invite only admits the named `invitee`; an open invite admits any
non-sovereign tenant. Origin/replay properties follow ADR-0050: the MAC binds the whole claim
set, so a tampered scope, session, or expiry fails the signature.

### 2. Sovereign exclusion is enforced at mint, at join, and at the query layer

Minting an invite is itself an egress-adjacent act, so `mintFederationInvite()` calls
`assertFederationAllowed(hostConfig)` **before signing** and returns a typed violation (never a
token) when the host is sovereign. The S96 join path re-checks the *invitee* with the same guard
and ANDs `FEDERATION_ELIGIBLE_SQL_FRAGMENT` into the join query (`CONNECT-SOVEREIGN-01`). Three
independent layers (mint guard, join guard, query fragment) mean an accidental sovereign
federation is impossible even if one layer is missed — defence in depth, as ADR-0059 requires.

### 3. Cross-tenant / cross-region isolation is *proven*, not asserted

ADR-0058 gave us `assertSameRegion()` for a single row. CONNECT's risk is a **batch** leak: a
federated query returning even one out-of-region or out-of-tenant row is a residency/isolation
incident. `lib/region-isolation.ts` composes the per-row guard into a batch **isolation proof**:
given the rows a query returned and the expected region, it partitions in-region vs leaked and
emits a structured, reproducible `IsolationProof` (counts + leaked sample + pass/fail). This is
the evidence artifact the Pentest #6 isolation run (`SEC-SOVEREIGN-ISOLATION-01`, S95;
`QA-CONNECT-SCALE-01`, S97) asserts `leakedCount === 0` against — isolation becomes a test
output, not a hope.

### 4. Federated anonymity (decided here, built S96)

A federated session exposes **aggregates only** across the tenant boundary: vote counts and theme
clusters are shared, per-tenant participant lists are not. Under ZK mode (ADR-0010) the federated
context window carries no display names. `CONNECT-ZEROK-01` (S96) implements this; the contract
is fixed now so the join is built against it.

### 5. Scale & isolation evidence is a v7.0-rc gate

The v7.0-rc scale claim requires evidence — 5 tenants × 50k participants × 100 queries with
**zero** cross-tenant rows returned (`QA-CONNECT-SCALE-01`, S97). The `IsolationProof` harness
from §3 is the measurement instrument; the RC cannot claim federation scale without a green proof.

## Consequences

**Positive**

- One trust envelope and one isolation-proof harness serve every CONNECT story → no per-feature
  re-litigation of the hardest surface in the arc.
- Sovereign exclusion holds at three layers; ZK and tenant isolation are preserved by contract.
- Isolation is a reproducible test artifact, directly consumable by Pentest #6.

**Negative / risks**

- Invite revocation is **not** in S95 (TTL-bound only). A `jti`-keyed revocation list is required
  before CONNECT GA (S97) — tracked as a CONNECT-AUDIT-01 follow-up.
- The S95 isolation proof runs over query *outputs*; it does not prove the query *plan* is
  region-safe. The D1 fragment (§2) plus Pentest #6 close that gap at GA.

## Alternatives considered

- **Open federation by session code (no invite).** Rejected: makes tenant membership implicit and
  un-auditable; incompatible with sovereign exclusion and ZK guarantees.
- **Reuse FEDERATION-01 template trust links for sessions.** Rejected: those are team↔team template
  shares with consent, not session-scoped, time-limited, signed admission. CONNECT needs a
  per-session, expiring, scoped envelope; the two coexist for different jobs.
- **JWT invites.** Rejected for the same reason ADR-0050 rejected them for embed: a compact HMAC
  envelope is smaller, has no algorithm-confusion surface, and reuses the single shared MAC
  primitive (`lib/shared/crypto.ts`).

## Compliance & security notes

- `CONNECT_INVITE_SECRET` is a deployment secret (`wrangler pages secret put`), never in
  `wrangler.toml`. Mint/verify **fail closed** (503 / typed failure) when it is absent.
- Every mint is audit-logged (`connect.invite.minted`) with `jti`, `sid`, `host`, `invitee`,
  `scope`, `exp` — a DPO can answer "who admitted whom, to what, until when".
- Pentest #6 scope (S95–S96, closed S97) explicitly includes the federation trust boundary and
  cross-tenant isolation.
</content>
