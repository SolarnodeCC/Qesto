---
id: ADR-0064
status: proposed
created: 2026-06-16
accepted: null
deciders: architect, product-owner, ai-strategy, market-research
relates_to: BACKLOG_MASTER, ROADMAP_FULL, SPRINT85_99_ARCH_NOTES, HANDOFFS, ADR-0054, ADR-0045, ADR-0010
---

# ADR-0064: Demand-Evidence & Adversarial Validation Gates for AI-Native Roadmap Governance

## Status

Proposed (2026-06-16). Foundational governance ADR. Grounds **EPIC-VALID** in
[`BACKLOG_MASTER.md`](../product/backlog/BACKLOG_MASTER.md). No code or schema change;
defines lightweight **planning gates** that sit alongside the existing ADR / eval / pentest
gate ladder. Requires PO + architect acceptance before any EPIC-VALID story is committed to a
sprint.

## Context

Qesto's AI-native engineering discipline is mature: persistent L1–L4 context (CLAUDE.md +
skills + agents), 58 ADRs, the REV-10 AI eval gate, pentest cadence, and SOC 2 / FedRAMP
evidence. A review against Anthropic's *Founder's Playbook: Building an AI-Native Startup*
(2026) found the gaps are **not** on the supply side (can we build it, safely) but on the
**demand side** (should we build it, and have users shown they need it) — exactly the
asymmetry the playbook predicts for AI-native teams, where build capability outruns validation
discipline.

Specific findings the playbook flags and where Qesto currently relies on implicit practice:

- **Premature scaling / building ahead of demand.** The roadmap commits concrete sprints out
  to v7.0/S99 (XR, federation, studio). `MARKET_VALIDATION_*` docs defend epics on
  market/competitive grounds, but a long *scheduled* (not *conditional*) horizon reads as a
  build queue rather than bets-pending-evidence.
- **No demand-side exit criteria.** Release exit criteria capture shipped + tested + CAC/LTV,
  but no equivalent of the **Sean Ellis 40% test** or **effort test** (does retention pull, or
  require heroic intervention?).
- **Adversarial validation is undocumented.** The agents exist (architect, security,
  market-research) but no planning step requires an agent to argue *against* an epic or *for* a
  competitor before promotion — leaving confirmation bias, which AI amplifies, uncountered.
- **Scope boundaries are implicit.** The story schema has an `out_of_scope` field, but epics
  carry no explicit **non-goals + evidence-to-expand** contract, so feature decisions stay at
  "should we build this?" rather than "have users shown we can't deliver value without it?".
- **The moat is real but unnarrated.** Privacy/Workers-AI moat, embed SDK, and the AI-insights
  flywheel exist structurally, but there is no single **data-flywheel narrative artifact** to
  drive product strategy and GTM.
- **Bottleneck risk is tracked only at agent-edge level** (HANDOFFS.md), not as a periodic
  single-point-of-knowledge audit the playbook's Launch/Scale chapters call for.

Constraints: gates must be **lightweight** (no new tooling, no heavyweight process), reuse
existing artifacts (`MARKET_VALIDATION_*`, agents, HANDOFFS, story schema), and must not block
hardening / regression / compliance work — they apply to **net-new epics and new-buyer
expansions**, not to in-flight regression contracts.

## Decision

Adopt six planning gates. Each is a checklist item on epic promotion or release cut, owned by
an existing role, evidenced in an existing doc. None introduce code.

### 1. Demand-side exit criteria (Gate D)

Every epic that ships a **new user-facing capability or targets a new buyer** carries
demand-side exit criteria *in addition to* the existing supply-side ones:

- **Sean Ellis signal:** ≥ 40% of active users would be "very disappointed" without it (or a
  documented product-appropriate proxy for B2B/low-N segments).
- **Effort test:** retention is pull, not push — sustained without per-customer heroics.
- A **false-positive definition** (e.g. signups without activation, revenue without retention)
  recorded *before* launch, with an adversarial read of early traction (Gate A) after.

Owner: product-owner. Evidence: epic row in `BACKLOG_MASTER.md` + `MARKET_VALIDATION_*`.

### 2. Adversarial validation gate (Gate A)

Before an epic moves from ideated → committed, an agent (`qesto-market-research` or
`qesto-architect`) produces a **strongest-case-against** memo: the best argument a competitor
succeeds where we do not, the assumptions most likely to be wrong, and the disconfirming
evidence a supportive synthesis would deprioritize. Promotion requires the memo to be answered,
not absent. Reuses the playbook's "AI as structured devil's advocate" as a standing ritual.

Owner: product-owner (commissions); market-research/architect (produces).

### 3. Committed-vs-Conditional horizon (Gate H)

The roadmap distinguishes two horizons explicitly:

- **Committed:** next 1–2 releases — scheduled, sized, sprint-mapped.
- **Conditional:** everything beyond — tagged with the **trigger/checkpoint** that promotes it
  (as `COMPETITIVE_EPICS.md` and the existing S91–99 "Checkpoints" already do for some items).

This generalizes the existing kill-criteria pattern (e.g. XR `<1` design partner by S98) to the
whole far horizon, directly countering premature scaling.

Owner: product-owner + architect. Evidence: `ROADMAP_FULL.md` horizon labels.

### 4. Non-goals + evidence-to-expand contract (Gate S)

Each net-new epic states **what it deliberately does not do** and **what specific user
evidence would justify expanding it**. Operationalizes the existing `out_of_scope` story field
at epic altitude and moves scope decisions from enthusiasm to evidence.

Owner: product-owner. Evidence: epic header in `BACKLOG_MASTER.md`.

### 5. Moat / data-flywheel narrative (Gate M)

Maintain a one-page **moat narrative**: how the data flywheel works (which behavioral signals
compound into product improvement), how long it has been spinning, and why a well-resourced
competitor starting today could not replicate it inside ~2 years. Refreshed per major release;
feeds product strategy and GTM. Builds on the Week-4 "flywheel signal" already in the AI plan.

Owner: ai-strategy + market-research. Evidence: `product/strategy/` artifact.

### 6. Bottleneck map (Gate B)

Per release arc, produce a **single-point-of-knowledge / bottleneck map**: which workflows,
decisions, or approvals stall when a key human (or a specific agent edge) is unavailable for a
week. Extends HANDOFFS.md from "who owns the edge" to "what breaks if the edge is down."

Owner: knowledge + product-owner. Evidence: extends `HANDOFFS.md`.

## Consequences

### Positive

- Adds a **demand-side counterweight** to a supply-side-strong gate ladder; reduces the risk of
  shipping well-built, well-tested capability nobody retained.
- Reuses existing roles, docs, and agents — **zero new tooling**, low process tax.
- Makes the roadmap legible as bets-with-triggers, improving investor/board and GTM narratives.
- Adversarial-review and non-goals gates institutionalize the anti-confirmation-bias and
  anti-scope-creep practices that AI makes both easier to skip and easier to perform.

### Negative

- Adds promotion-time overhead for net-new epics (mitigated: gates are checklist-light and
  agent-assisted).
- Sean Ellis / effort signals are weaker at low N for enterprise segments — requires documented
  proxies rather than a hard 40% threshold.
- Conditional-horizon tagging may read as reduced commitment to stakeholders expecting a fixed
  long roadmap (mitigated by clear trigger definitions).

### Risks

- Gates become box-ticking if not enforced at promotion — mitigate by making Gate A's memo and
  Gate D's criteria **required fields** on the epic row, absence = not-committable.
- Overreach: applying gates to regression/hardening/compliance work would slow correct work —
  scope is explicitly **net-new epics and new-buyer expansions only**.

## Alternatives considered

- **Do nothing / keep implicit practice.** Rejected: the review found the demand-side gaps are
  real and the playbook's central warning (build outruns validation) maps directly onto Qesto.
- **Heavyweight stage-gate process (Idea/MVP/Launch/Scale as literal phases).** Rejected:
  Qesto is past idea/MVP for the core platform; release/sprint cadence is the right altitude.
  Borrow the playbook's *disciplines*, not its lifecycle structure.
- **Fold into existing `MARKET_VALIDATION_*` docs only.** Rejected: those cover market/
  competitive evidence well but not user-conversation demand, adversarial review, exit criteria,
  or bottleneck mapping — and have no promotion-blocking force.

## References

- Anthropic, *The Founder's Playbook: Building an AI-Native Startup* (2026) — source of the
  reviewed disciplines (devil's advocate, PMF litmus tests, scope definition, premature-scaling
  warning, data-flywheel moat).
- `knowledge-base/product/backlog/BACKLOG_MASTER.md` — EPIC-VALID story registry.
- `knowledge-base/product/research/MARKET_VALIDATION_S85_99.md` — existing market validation.
- `.claude/skills/HANDOFFS.md` — agent-edge ownership (Gate B base).
- ADR-0054 (cadence governance), ADR-0045 (cross-session insights flywheel), ADR-0010
  (zero-knowledge anonymity boundary for any discovery/analytics evidence).
