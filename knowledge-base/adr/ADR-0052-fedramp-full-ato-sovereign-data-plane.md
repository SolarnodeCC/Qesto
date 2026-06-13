---
id: ADR-0052
status: accepted
created: 2026-06-13
accepted: 2026-06-13
deciders: architect, security, devops, product-owner
relates_to: ADR-0043, ADR-0036, ADR-0027, ADR-0007, ADR-0009, SPRINT85_99_PLAN, BACKLOG_MASTER, SOC2_EVIDENCE, EU_DATA_RESIDENCY, FEDRAMP_ATO_FULL_PATH
---

# ADR-0052: FedRAMP Full-ATO Boundary & Sovereign Data Plane

## Context

E89 ("Gov Cloud & Full ATO", S89, release **v6.0-rc**) commits two related stories:
`FEDRAMP-ATO-FULL-01` (FedRAMP Moderate **full ATO path**) and `SOVEREIGN-TIER-01` (a
sovereign data-plane tenant tier). This ADR is the architectural decision behind both. It exists
before implementation because the load-bearing choices are about a **boundary** — what is inside
the authorization scope, what controls Qesto inherits vs. owns, and how a sovereign tenant is
physically and logically isolated — not about route-level code.

**The honesty constraint is mandatory and non-negotiable.** This ADR documents the *path to* a
FedRAMP Moderate Authorization-To-Operate: the authorization boundary, the control set, the
inheritance model, and the gaps Qesto must close to pursue one. **Qesto does not hold a FedRAMP
authorization, is not listed on the FedRAMP Marketplace, and makes no claim of one.** ATO is granted
by a federal Authorizing Official (AO) after a Third-Party Assessment Organization (3PAO)
assessment; nothing in this document or in any product surface may assert achieved authorization.
This continues the posture of ADR-0043, which scoped S79 to **control mapping / path only**, and
extends it to a full boundary and control-readiness design. Compliance claims in product copy are
CI-gated (`npm run check:compliance-claims`); this ADR adopts the same discipline for itself — every
forward-looking statement here is labelled **target / path**, never **achieved**.

Constraints carried in:

- **ADR-0043** established the FedRAMP Moderate control *mapping* surfaced at
  `GET /api/platform/fedramp-path` (`tier: 'moderate'`, `status: 'documentation_only'`). This ADR
  is the architecture that justifies advancing `atoTarget` past "S81+" — but the route's
  `status` MUST remain a documentation/path status, never `authorized`, until an AO actually
  grants an ATO (which is out of Qesto's unilateral control).
- **ADR-0036 / ADR-0027** established tenant region pinning: `home_region` in KV
  (`residency:pin:{teamId}`, `homeRegion ∈ {eu,us,apac}`, enforced by
  `assertResidencyAllowsMutation()` in `lib/residency-enforce.ts`), and the hard physical fact that
  **a D1 database's region is chosen at creation time and cannot be migrated afterward**
  (`EU_DATA_RESIDENCY.md`). The sovereign tier is built **on this irreversibility**, not around it.
- **SOC 2** (`SOC2_EVIDENCE.md`) is the existing control evidence base. FedRAMP Moderate and SOC 2
  overlap heavily (access control, encryption, monitoring, change management); the decision reuses
  SOC 2 evidence as inherited/shared control evidence rather than re-deriving it.
- Hard rules carry in unchanged: **Workers AI only / no third-party egress** (hard rule #1) is itself
  a FedRAMP boundary asset — it sharply bounds the data-flow diagram and the external-connection
  inventory; secrets via `wrangler pages secret put` (hard rule #2); the `{ ok, data, trace_id }`
  envelope; `safeLogContext()` PII sanitization (ADR-0009); circuit-breaker resilience (ADR-0007).

## Decision

Define a **FedRAMP Moderate authorization boundary** for Qesto-on-Cloudflare that **inherits the
infrastructure control baseline from Cloudflare's FedRAMP-authorized edge** and enumerates the
**Qesto-owned application controls** on top of it; and introduce a **sovereign tenant tier**
(`is_sovereign` data plane) that is a *distinct, region-pinned data plane* — irreversible region
pin (ADR-0036), no cross-region replication, no federation joins, and explicit egress exclusion.
The boundary, control set, gap list (POA&M-style), and 3PAO prerequisites are documented in the
companion practical doc `FEDRAMP_ATO_FULL_PATH.md`. **No granted ATO is claimed.** No new
infrastructure is required for the boundary itself; the sovereign tier requires one dedicated
region-pinned D1 instance per sovereign region and a small set of hard tenant-flag enforcement
points.

### 1. Authorization boundary (text diagram)

The FedRAMP authorization boundary is everything Qesto operates that stores, processes, or transmits
federal information. Because Qesto is edge-native and Workers-AI-only, the boundary is unusually
small and has **no third-party AI / ASR / MT egress**.

```
                 ┌──────────────── FedRAMP AUTHORIZATION BOUNDARY (target) ────────────────┐
                 │                                                                          │
  Federal user ──┼─HTTPS/WSS─► Cloudflare edge (FedRAMP-authorized IaaS/PaaS — INHERITED)   │
                 │              │                                                            │
                 │              ├─► Pages static assets            (inherited transport)     │
                 │              ├─► Pages Functions  (Hono API)    ◄── QESTO-OWNED app layer  │
                 │              │     authMiddleware / rbacMiddleware / planMiddleware        │
                 │              ├─► SessionRoom Durable Object     ◄── QESTO-OWNED realtime    │
                 │              ├─► D1 (DB / DB_EU / DB_GOV*)       ◄── QESTO-OWNED schema+data │
                 │              ├─► KV (USERS/SESSIONS/TEAMS/…)    ◄── QESTO-OWNED data        │
                 │              ├─► R2 / Analytics Engine          ◄── QESTO-OWNED data        │
                 │              └─► Workers AI (@cf/* ONLY)        ◄── inherited compute,       │
                 │                    (no audio/transcript/PII egress; ADR-0051/0009)  Qesto-  │
                 │                                                          owned prompts/evals │
                 │                                                                          │
                 │   Authn evidence: JWT magic-link + SAML SSO (auth.ts)                     │
                 │   Audit evidence: audit_log (D1) + AE (PII-sanitized, ADR-0009)           │
                 └──────────────────────────────────────────────────────────────────────────┘
   OUTSIDE boundary (interconnections, documented in the SSP interconnection table):
     • Resend (email)  • Stripe (billing)  — both data-minimized, DPA in SOC2 registry
     • NO third-party AI / ASR / MT / analytics processor (hard rule #1) — a deliberate
       boundary-shrinking decision, not an omission.
   * DB_GOV is the sovereign/gov region-pinned D1 instance (§3); provisioned per gov region.
```

The boundary's defensibility comes from **what is *not* in it**: no hyperscaler AI endpoint, no
third-party transcription, no external analytics. The data-flow diagram a 3PAO must trace is short.

### 2. Control inheritance vs. Qesto-owned controls

FedRAMP Moderate (NIST SP 800-53 Moderate baseline, ~325 controls — the count ADR-0043 mapped) is
split across three responsibility classes. The companion doc carries the full family-by-family table;
the decision here is the **split model**:

- **Inherited from Cloudflare's FedRAMP-authorized edge** — physical/environmental (PE), most of
  media protection (MP), the IaaS/PaaS layers of system & communications protection (SC: network,
  DDoS, TLS termination, datacenter), and infrastructure availability. Qesto **does not re-implement
  or re-assess** these; it references Cloudflare's authorization package as the inheritance source.
  *Target/path note:* inheritance is only assertable to the extent Cloudflare's relevant services
  are in-scope of their FedRAMP authorization for the regions used; confirming that scope per service
  is a gap (POA&M, §5).
- **Shared / hybrid** — configuration management (CM), contingency planning (CP), incident response
  (IR): Cloudflare owns the platform half; Qesto owns the application half (its own change
  management, its DR drill, its incident runbooks). Evidence is **reused from SOC 2** wherever the
  control overlaps.
- **Qesto-owned (application)** — access control (AC: `authMiddleware`/`rbacMiddleware`/
  `BUILTIN_ROLE_PERMISSIONS`), identification & authentication (IA: magic-link JWT + SAML SSO),
  audit & accountability (AU: `audit_log` + AE with `safeLogContext()`), system & information
  integrity (SI: input validation, circuit breakers ADR-0007, PII sanitization ADR-0009), and the
  application slice of SC (the `is_sovereign` data-plane isolation, §3). These are the controls Qesto
  must produce direct evidence for and that a 3PAO assesses against Qesto, not Cloudflare.

### 3. Sovereign tenant tier — `is_sovereign` data plane

The sovereign tier is the architectural heart of this ADR: a tenant flag that promotes a team from
"region-pinned" (ADR-0036, a *write-routing* policy) to "**physically isolated data plane**" (a
hard partition). It is a **distinct data plane**, not a stricter setting on the shared one.

**Tenant model.** A new tenant attribute `is_sovereign: boolean` (default `false`) plus a
`sovereign_region` (e.g. `gov-us`). When `is_sovereign = true`:

1. **Irreversible region pin (builds on ADR-0036).** The tenant's data lives in a dedicated
   region-pinned D1 instance (`DB_GOV`/the sovereign-region binding) whose **D1 location is chosen
   at creation and cannot be migrated** (`EU_DATA_RESIDENCY.md`). Sovereignty therefore *inherits
   the irreversibility as a feature*: there is no "move my sovereign data" operation, by design. The
   existing `residency:pin:{teamId}` mechanism extends with a `homeRegion` of the sovereign region
   and a `sovereign: true` marker; promotion to sovereign is **one-way** (no demotion path that
   would imply a region migration).
2. **No cross-region replication.** Sovereign-tenant rows are never copied to another region. The
   multi-region write path (ADR-0027/0036) MUST refuse to replicate or fan-out a sovereign tenant's
   writes; `assertResidencyAllowsMutation()` is extended so a sovereign tenant's mutation is
   **hard-blocked** outside its sovereign region (not merely flagged), emitting a
   `db.sovereign_violation` AE event.
3. **No federation joins (forward-referenced hard D1 constraint).** Sovereign tenants are
   **excluded from any current or future cross-tenant federation**. The roadmap CONNECT epic
   (S94+, `CONNECT-SOVEREIGN-01`) carries this as a **hard D1 constraint**: federation queries MUST
   exclude `is_sovereign = true` tenants at the data layer (a `WHERE is_sovereign = 0` invariant /
   a check that prevents a sovereign tenant id from entering a federation join), not merely at the
   application layer. This ADR records the constraint now so the federation schema is designed
   around it from day one; the enforcing migration lands with CONNECT (out of S89 scope, owned by
   ADR-0057).
4. **Egress exclusion.** Sovereign tenants are excluded from every optional egress path: no Slack/
   Teams notification connectors, no embed public-read plane (ADR-0050), no marketplace data-out, no
   cross-session insight aggregation that would leave the sovereign data plane. Workers AI remains
   the only compute and stays in-region (no third-party AI egress already holds globally, hard
   rule #1) — but even aggregate insight *outputs* for a sovereign tenant stay inside its plane.

**Why a distinct plane, not a flag on the shared D1:** FedRAMP/gov buyers require demonstrable data
isolation, not a row-level policy on a shared multi-tenant database. A dedicated region-pinned D1
instance makes the isolation **physical and auditable** (a 3PAO can point at a separate database in
a separate region), and the irreversible-location property turns ADR-0036's limitation into the
exact guarantee sovereign buyers want.

### 4. POA&M-style gap list (owners)

A Plan of Action & Milestones (POA&M) is the standard FedRAMP artifact for tracking residual gaps.
The full table lives in `FEDRAMP_ATO_FULL_PATH.md`; the **architecturally material** gaps this ADR
opens are:

| Gap | Family | Owner | Path note (target, not done) |
|---|---|---|---|
| Confirm Cloudflare FedRAMP scope per service/region used | SC/PE | devops | inheritance is only as strong as Cloudflare's in-scope authorization |
| Integration token encryption-at-rest (SOC2 CC6.7 gap) | SC | backend | `EncryptedTokenStore` plaintext gap carried from SOC2_EVIDENCE.md |
| Dedicated sovereign-region D1 (`DB_GOV`) provisioning | SC/CM | devops | one-way provisioning; no migration path by design |
| Hard sovereign write-block + `db.sovereign_violation` AE | AC/SC | backend | extends `assertResidencyAllowsMutation()` |
| Federation-exclusion hard D1 constraint | AC/SC | architect | deferred to CONNECT / ADR-0057 (S94+) |
| FIPS 140-validated crypto attestation for gov | SC | devops | inherited from Cloudflare; confirm validation boundary |
| Annual DR drill evidence (gov RTO/RPO) | CP | devops | see `DR_DRILL_V6_2026.md` (S89 DR drill) |
| 3PAO engagement + SSP authorship | CA | security | prerequisite for any real ATO; see companion doc §3PAO |

Every row is a **path item**; none is a claim of completion.

### 5. Relationship to SOC 2 (reuse evidence)

SOC 2 Type II evidence (`SOC2_EVIDENCE.md`, `SOC2_TYPE_II_EVIDENCE/`) is the **primary evidence reuse
source**. FedRAMP Moderate AC/IA/AU/SC/CM/CP/IR families map substantially onto SOC 2 CC6/CC7/CC8
controls already evidenced. The decision: **do not re-derive** overlapping controls — cite the SOC 2
control and its existing evidence in the FedRAMP control table, and only author *net-new* evidence
for FedRAMP-specific requirements (e.g. FIPS validation attestation, the sovereign data-plane
isolation, gov-specific contingency RTO/RPO). This keeps the ATO-path effort bounded and avoids two
divergent evidence bases. Known SOC 2 gaps (e.g. the CC6.7 integration-token encryption gap) carry
forward into the POA&M unchanged — honesty over both frameworks.

## Alternatives considered

- **Claim/assert a FedRAMP authorization or "FedRAMP Moderate certified" status** — rejected,
  non-negotiable. ATO is granted by a federal AO after 3PAO assessment; Qesto cannot self-assert it.
  Any such claim would be false and would (rightly) fail the spirit of `check:compliance-claims`.
  We document the *path* only.
- **Sovereign isolation as a row-level flag on the shared multi-tenant D1** — rejected. It does not
  give gov buyers demonstrable physical isolation and is far harder for a 3PAO to assess than a
  dedicated region-pinned database. Use a distinct data plane.
- **Allow sovereign demotion / data migration on request** — rejected. D1 location is irreversible
  (ADR-0036); offering "move my sovereign data" would either be a lie or require a cross-region copy
  that violates the no-replication guarantee. Promotion is one-way; disclose upfront (the
  `EU_DATA_RESIDENCY.md` "no migration post-provisioning" posture, extended).
- **Enforce federation exclusion only at the application layer** — rejected as insufficient for a
  hard sovereignty guarantee. A future federation feature could regress the check. Record it now as a
  **hard D1 constraint** so the federation schema (ADR-0057, S94+) is built to exclude
  `is_sovereign = true` at the data layer.
- **Pursue FedRAMP High instead of Moderate** — rejected for v6.0-rc scope. The committed target
  (E89, ADR-0043 lineage) is **Moderate**; High is a materially larger control delta with no
  committed buyer. Keep the path to Moderate; revisit High only against a concrete High requirement.
- **Build a separate gov cloud product** — rejected. The sovereign tier is a *tenant tier on the same
  codebase* with a distinct data plane; a forked product doubles maintenance and diverges security
  posture. The edge-native, Workers-AI-only architecture already shrinks the boundary enough that a
  tenant-tier approach is viable.

## Consequences

- Qesto has a **documented, honest FedRAMP Moderate ATO path** (boundary + control split +
  POA&M + 3PAO prerequisites) without claiming an authorization it does not hold — usable for gov
  GTM conversations and for scoping a real 3PAO engagement, and consistent with the CI-gated
  compliance-claims discipline.
- The **authorization boundary is small by construction**: Workers-AI-only and no third-party AI
  egress mean the data-flow diagram and external-connection inventory are short — a structural FedRAMP
  asset, not just a feature.
- The **sovereign tier turns ADR-0036's irreversible-region limitation into a guarantee**: a distinct,
  region-pinned, non-replicated, federation-excluded, egress-excluded data plane that is physically
  auditable. It requires a dedicated per-region D1 instance and hard enforcement points (extended
  `assertResidencyAllowsMutation()`, a `db.sovereign_violation` AE event), but **no new third-party
  infrastructure**.
- **Sovereign tenants are permanently excluded from cross-tenant federation** — recorded now as a
  hard D1 constraint so the future CONNECT federation schema (ADR-0057, S94+) is designed around it.
  This is a deliberate ceiling on sovereign tenants' feature surface, accepted as the cost of the
  isolation guarantee.
- **SOC 2 evidence is reused**, bounding the net-new evidence effort to FedRAMP-specific items;
  known SOC 2 gaps (CC6.7 token encryption) carry into the POA&M rather than being hidden.
- `GET /api/platform/fedramp-path` may advance its documented `atoTarget` and reference this ADR, but
  its `status` MUST stay a documentation/path status — **never `authorized`** — until a real AO grants
  one. (Documentation-only ADR; no code change is mandated by this ADR.)

## Docs updated

- This ADR created: `knowledge-base/adr/ADR-0052-fedramp-full-ato-sovereign-data-plane.md`.
- Companion practical doc created: `knowledge-base/security/FEDRAMP_ATO_FULL_PATH.md`
  (`FEDRAMP-ATO-FULL-01`) — the family-by-family control-readiness table, POA&M, and 3PAO
  prerequisites.
- Implementers of `SOVEREIGN-TIER-01` must update: `SPEC_DATAMODEL` (`is_sovereign` /
  `sovereign_region` tenant attributes; the dedicated `DB_GOV` binding), `SPEC_BACKEND` (extended
  `assertResidencyAllowsMutation()` hard-block + `db.sovereign_violation` AE; egress-connector
  exclusion for sovereign tenants), `SPEC_DEPLOYMENT` (sovereign-region D1 provisioning, one-way).
  The federation-exclusion hard D1 constraint is owned by **ADR-0057 (CONNECT, S94+)** and is out of
  S89 implementation scope.

## References

- `knowledge-base/adr/ADR-0043-fedramp-moderate-path.md` (FedRAMP Moderate control mapping, path-only,
  S79); `functions/api/routes/platform.ts:130` (`GET /api/platform/fedramp-path` — `tier: moderate`,
  `status: documentation_only`, ~325 controls mapped).
- `knowledge-base/adr/ADR-0036-eu-mr-write-ga.md` and `ADR-0027-multi-region-writes.md` (tenant region
  pinning; `resolveWriteBinding()`; `region_lock` / `db.residency_violation`).
- `functions/api/lib/residency-enforce.ts` (`residency:pin:{teamId}`, `homeRegion`,
  `assertResidencyAllowsMutation()` — the primitive the sovereign tier extends).
- `knowledge-base/security/EU_DATA_RESIDENCY.md` (D1 region chosen at creation, **cannot be migrated**
  — the irreversibility the sovereign tier builds on).
- `knowledge-base/security/SOC2_EVIDENCE.md` (sub-processor registry; CC6/CC7/CC8 control inventory;
  CC6.7 token-encryption gap reused as a POA&M item).
- `knowledge-base/security/FEDRAMP_ATO_FULL_PATH.md` (companion: control-family readiness, POA&M, 3PAO
  prerequisites).
- `knowledge-base/operations/DR_DRILL_V6_2026.md` (S89 annual DR drill — CP-family evidence).
- ADR-0007 (circuit-breaker — SI/CP resilience), ADR-0009 (PII sanitization / `safeLogContext` — AU),
  ADR-0050 (embed public-read plane — excluded for sovereign tenants), ADR-0057 (CONNECT federation —
  owns the sovereign federation-exclusion hard D1 constraint, S94+).
- `knowledge-base/product/planning/SPRINT85_99_PLAN.md` (E89 :134; ADR-0052 :166; sovereign
  federation/egress exclusion :210/:344; S89 row :229) and
  `knowledge-base/product/backlog/BACKLOG_MASTER.md` (`FEDRAMP-ATO-FULL-01` :1743,
  `SOVEREIGN-TIER-01` :1744; sovereign-exclusion checkpoint :1781).
- Hard rules #1 (Workers AI only / no third-party egress — the boundary-shrinking asset), #2 (secrets
  via `wrangler pages secret put`).
