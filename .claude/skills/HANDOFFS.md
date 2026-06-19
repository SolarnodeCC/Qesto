# HANDOFFS — Qesto Agent & Skill Edge Ownership Map
# VERSION: v1.2.0
# OWNER: Architect

_Last reviewed_: 2026-06-04

> _"A company is a graph of algorithms. Bottlenecks happen where edges break and nobody owns them."_
> The nodes (agents) are well-defined. This file makes the **edges** (handoffs between
> roles) explicit and **owned**, so no contract falls between two agents.

Every cross-role handoff below names: the **producer**, the **artifact/contract** that
crosses the edge, the **consumer**, the **trigger**, and the **edge owner** (who is
accountable if the handoff stalls or breaks). If you are about to hand work to another
role, find the edge here first — if it is missing, add it in the same PR.

---

## 1) The node graph

```
                         ┌──────────────┐
                         │ product-owner│  (scope, priority, AC)
                         └──────┬───────┘
        market-research ──pulse─┤        ├─ stories ─► architect ──ADR/contract─► backend
                                │        │                                  │      frontend
        ai-strategy ──verdict───┤        │                                  │
                                │        └─ shipped ─► tester ─► review ─► devops (deploy)
        marketing ──MQL/positioning─► sales ──deal won─► (onboarding) ─► analytics (funnel)
                                │                          │
                                └─ release-notes ◄─ PO ────┘   security gates every release
```

## 2) Edge ownership matrix

| # | Producer | Artifact / contract that crosses the edge | Consumer | Trigger | Edge owner |
|---|---|---|---|---|---|
| E1 | market-research | Weekly Market Pulse + backlog research context (`knowledge-base/product/research/`) | product-owner | Weekly + on-demand query | Product Owner |
| E2 | ai-strategy | AI-first/AI-shaped verdict + competency scorecard | product-owner | New AI feature proposed | AI Strategy Lead |
| E3 | product-owner | Groomed story with AC (GIVEN/WHEN/THEN), WSJF, priority | architect / backend / frontend | Story promoted into a release train (row in `BACKLOG_ACTIVE.md`) | Product Owner |
| E4 | architect | ADR + API contract (`.claude/schemas/api-contract.json`) + data model + migration plan | backend / frontend / devops | Design decision approved | Architect |
| E5 | backend | Typed API contract + new env bindings + migration SQL | frontend (consume) / devops (deploy) | Route/schema shipped | Architect |
| E6 | backend ↔ frontend | Shared types in `functions/api/types.ts` (read-only for FE) | both | DTO added/changed | Architect |
| E7 | frontend | New strings to extract | i18n | UI copy added | Frontend Lead |
| E8 | any dev | Diff ready for merge | review (gate) → tester | PR opened | QA Lead |
| E9 | tester / review | Pass/fail gate + coverage report | devops | Pre-merge / pre-release | QA Lead |
| E10 | any change touching auth/routes/Stripe/DO | Code under audit | security (cso) | New route, auth change, webhook, pre-release | CSO |
| E11 | security | Findings (severity, file:line) → backlog P0/P4 | product-owner / backend | Audit complete | CSO |
| E12 | architect | New CF binding spec | devops (implements in `wrangler.toml`) | Binding designed | DevOps |
| E13 | backend | New AE event type proposal | analytics (validates) / architect (approves) | Instrumentation needed | Analytics Lead |
| E14 | analytics | Funnel report + anomaly flags → backlog actions | product-owner / marketing | Weekly + on-demand | Analytics Lead |
| E15 | market-research | ICP + competitor source-of-truth tables | marketing / sales (reference, never copy) | Positioning needed | Product Owner |
| E16 | marketing | Qualified lead (MQL→SQL) + positioning, battle cards, pricing context | sales | Lead reaches sales-ready bar | Growth Lead |
| E17 | sales | Lost-deal reasons + product gaps + feature asks | product-owner / market-research | Deal closes (win/loss) | Sales Lead |
| E18 | sales | Won deal + account context | analytics (activation) / (onboarding) | Deal won | Sales Lead |
| E19 | sales | Enterprise security questionnaire / SSO / DPA request | security / devops | Enterprise deal in flight | Sales Lead |
| E20 | product-owner | Shipped stories + breaking changes | release-notes | Release-train close | Product Owner |
| E21 | release-notes | Customer-facing changelog | marketing (announce) | Release published | Growth Lead |
| E22 | devops | Deploy result + health probe status | all | Post-deploy | DevOps |
| E23 | any agent | Reproducible DO/WebSocket bug | investigate (skill) → architect | Realtime defect | QA Lead |
| E24 | any role | "Docs to Update" landing (the doc-update edges) | knowledge (steward) | Doc written/changed | Knowledge Lead |
| E25 | product-owner | New/changed business requirement | knowledge | Requirement decided | Knowledge Lead |
| E26 | knowledge | `kb_search` tool + documentation map (research entry point) | all roles | Research needed | Knowledge Lead |
| E27 | ai-strategy | AI-first/AI-shaped verdict + priority competency | ai-engineer | Feature approved to build | AI Strategy Lead |
| E28 | ai-engineer | AI feature needs route/binding/DB plumbing (surrounding app) | backend | AI endpoint/storage needed | Architect |
| E29 | ai-engineer ↔ knowledge | RAG split — embedding/retrieval quality (ai-engineer) vs KB content + sync pipeline (knowledge) | each other | RAG/index change | AI Engineering Lead |
| E30 | ai-engineer | Participant-facing AI output / PII / prompt-injection surface | security (cso) | AI output reaches users | CSO |
| E31 | e2e-tester | WCAG violation found in E2E audit (file:line + axe rule) → backlog P1 | frontend / product-owner | A11y audit run on new page/flow | QA Lead |
| E32 | e2e-tester | k6 threshold breach in staging (p95 > SLA or error rate > 5%) | devops / architect | Load test run post-deploy | QA Lead |

## 3) Edge contract rules (so edges don't break)

1. **Single source of truth.** ICP, competitors, and pricing live in ONE place
   (market-research / `knowledge-base/product/research/` and the Stripe vars). Every
   other role **references**, never copies. Duplicated tables are a broken edge.
2. **Typed contracts cross dev edges.** Frontend and backend communicate only through
   `functions/api/types.ts`. No locally redeclared DTOs (E6).
3. **No silent handoffs.** When you finish work that another role consumes, state the
   handoff explicitly in your output (`Handoff → <role>: <artifact>`).
4. **Escalate up the owner column.** If an edge stalls, the edge owner is accountable
   for unblocking — not the producer or consumer in isolation.
5. **New edge = new row.** Introducing a cross-role dependency without adding it here is
   how "nobody owns it." Add the row in the same change.

## 4) Knowledge steward — the node that owns doc-updates and research (E24–E26)

Doc-updating used to be diffuse: 23 roles each had a "Docs to Update" table, but
nobody owned whether the knowledge base stayed coherent or whether business
requirements were actually captured. The **knowledge** node owns that:

- **Research entry point (E26)**: for conceptual questions ("requirements/
  decisions/constraints for X"), use the `kb_search` MCP tool (semantic search
  over the KB) and then Read the returned `file_path`. Grep/Glob stay best for
  exact symbols. `kb_search` needs `QESTO_API_BASE_URL` + `QESTO_KB_API_TOKEN`
  configured in `.mcp.json`; without them, fall back to the documentation map +
  Grep. Knowledge owns keeping it working (and the index healthy via `kb:health`).
- **Doc-update steward (E24)**: every role still writes its own domain docs;
  knowledge verifies placement, frontmatter (so docs embed), and that nothing
  contradicts existing docs.
- **Requirement capture (E25)**: PO decides requirements; knowledge documents them
  with a stable ID and confirms backlog/test traceability, flagging requirement debt.

## 5) Marketing → Sales boundary (the edge the audit flagged)

| Owns | Marketing (top of funnel) | Sales (deal cycle) |
|---|---|---|
| Demand | Inbound, content, SEO, brand, lifecycle email | Outbound prospecting, cold sequences |
| Asset | Positioning, competitor pages, pricing page, nurture | Discovery scripts, demo, objection handling, proposals, deal desk |
| Metric | MQLs, activation, conversion rate | SQL→won rate, cycle time, ACV, win rate |
| Handoff | **Produces** the MQL→SQL handoff (E16) | **Produces** loss reasons & gaps back to PO (E17) |

Both **reference** market-research for ICP/competitors (E15). Neither copies those tables.

## 6) AI lane — strategy → engineering → backend (E27–E30)

Three roles, three jobs, no overlap:
- **ai-strategy** decides *whether/what* (AI-first vs AI-shaped, priority) — advisory, no code.
- **ai-engineer** builds it *well* — prompts, embeddings, retrieval/RAG quality, output
  validation, evals, guardrails, latency/token/cost budgets (Workers AI only).
- **backend** builds the *surrounding app* — routes, auth, DB, bindings (E28).

Shared seam with **knowledge** (E29): knowledge owns KB *content* and the doc→index
*sync pipeline*; ai-engineer owns the *embedding model/dimension* and *retrieval quality*.
The 768→1024 incident lived on this seam — now owned. Participant-facing AI output and
PII/injection surfaces gate through **security** (E30).

## Change Log
- 2026-06-04: v1.2.0 — added the AI-engineer node and edges E27–E30 (strategy→engineering,
  engineering→backend plumbing, the ai-engineer↔knowledge RAG seam, and AI output safety).
- 2026-06-04: v1.1.0 — added the Knowledge steward node and edges E24–E26 (doc-update
  stewardship, requirement capture, and the `kb_search` research entry point).
- 2026-06-04: v1.0.0 — created the edge ownership map; added Sales node edges (E16–E19),
  single-source-of-truth rule, and marketing↔sales boundary per the agent/skill audit.
