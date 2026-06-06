# jankurai Repo Score

- Standard: `jankurai`
- Auditor: `1.5.1`
- Schema: `1`
- Paper edition: `2026-05-12`
- Target stack ID: `cloudflare-workers-typescript-react`
- Target stack: `Rust core + TypeScript/React/Vite + PostgreSQL + generated contracts + exception-only Python AI/data service`
- Repo: `.`
- Run ID: `1780766091`
- Started at: `1780766091`
- Elapsed: `3611` ms
- Scope: `full`
- Raw score: `92`
- Final score: `92`
- Decision: `pass`
- Minimum score: `85`
- Caps applied: `none`

## Hard Rule Caps

| Rule | Max Score | Applied |
| --- | ---: | --- |
| `no-root-agent-instructions` | 75 | no |
| `no-one-command-setup-or-validation` | 70 | no |
| `no-deterministic-fast-lane` | 65 | no |
| `no-security-lane-on-high-risk-repo` | 60 | no |
| `generated-contracts-or-public-api-drift-untested` | 80 | no |
| `python-direct-product-truth-or-db-ownership` | 72 | no |
| `no-secret-or-dependency-scanning-in-ci` | 78 | no |
| `no-jankurai-audit-lane-in-ci` | 82 | no |
| `jankurai-required-tool-ci-evidence-gap` | 88 | no |
| `non-optimal-product-language-found` | 74 | no |
| `too-much-python-in-product-surface` | 72 | no |
| `boundary-reclassification-evidence-gap` | 72 | no |
| `vibe-placeholders-in-product-code` | 68 | no |
| `fallback-soup-in-product-code` | 70 | no |
| `future-hostile-dead-language-in-product-code` | 64 | no |
| `severe-duplication-in-product-code` | 70 | no |
| `generated-zone-mutation-risk` | 76 | no |
| `direct-db-access-from-wrong-layer` | 66 | no |
| `missing-web-e2e-lane` | 82 | no |
| `missing-rendered-ux-qa-lane` | 84 | no |
| `prompt-injection-risk` | 78 | no |
| `overbroad-agent-agency` | 65 | no |
| `secret-like-content-detected` | 60 | no |
| `false-green-test-risk` | 76 | no |
| `destructive-migration-risk` | 70 | no |
| `authz-or-data-isolation-gap` | 78 | no |
| `input-boundary-gap` | 78 | no |
| `agent-tool-supply-chain-gap` | 78 | no |
| `release-readiness-gap` | 80 | no |
| `missing-rust-property-or-integration-tests` | 82 | no |
| `no-agent-friendly-exception-pattern` | 76 | no |
| `missing-agent-readable-docs` | 80 | no |
| `streaming-runtime-drift` | 78 | no |
| `rust-bad-behavior` | 72 | no |
| `sql-bad-behavior` | 72 | no |
| `typescript-bad-behavior` | 72 | no |
| `docker-bad-behavior` | 72 | no |
| `python-bad-behavior` | 72 | no |
| `ci-bad-behavior` | 70 | no |
| `git-bad-behavior` | 70 | no |
| `gittools-bad-behavior` | 70 | no |
| `release-bad-behavior` | 70 | no |
| `web-security-bad-behavior` | 68 | no |
| `repo-rot-bad-behavior` | 88 | no |
| `comment-hygiene-dangerous-residue` | 72 | no |
| `ci-local-parity` | 70 | no |

## Copy-Code Redundancy

- Status: `review` hard=`0` warning=`18` files=`375`
- Policy: min-lines=`10` min-tokens=`100` max-findings=`50` include-tests=`false` strict=`false`
- Duplicate volume: lines=`39` tokens=`140` bytes=`1163`

- Notes:
  - hard classes are limited to exact active-source file matches and substantial exact same-name units
  - warning classes include same-body different-name units and token/block duplication
  - tests, fixtures, stories, config, Docker, and migrations are omitted unless --include-tests is set

| Kind | Severity | Language | Lines | Tokens | Instances | Reason |
| --- | --- | --- | ---: | ---: | --- | --- |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 1 | 3 | `functions/api/lib/audit.ts:196-197, functions/api/middleware/kv-cache.ts:90-91, functions/api/middleware/kv-cache.ts:111-112, functions/api/middleware/kv-cache.ts:153-154, functions/api/middleware/kv-cache.ts:175-176, functions/api/middleware/kv-cache.ts:197-198, functions/api/routes/billing/webhook.ts:176-177, functions/api/routes/billing/webhook.ts:212-213, functions/api/routes/billing/webhook.ts:245-246, functions/api/routes/billing/webhook.ts:274-275, functions/api/routes/billing/webhook.ts:300-301` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 11 | `functions/api/lib/session-room-energizer-handler.ts:55-57, functions/api/lib/session-room-ideate-handler.ts:38-40, functions/api/lib/session-room-retro-handler.ts:28-30, functions/api/lib/session-room-townhall-handler.ts:52-54` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 6 | 32 | `functions/api/lib/voter.ts:9-15, functions/api/middleware/rate-limit.ts:26-32` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 2 | 6 | `functions/api/lib/session-room-ideate-handler.ts:42-44, functions/api/lib/session-room-messages.ts:3-5, functions/api/lib/session-room-retro-handler.ts:32-34, functions/api/lib/session-room-townhall-handler.ts:56-58` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 5 | `functions/api/lib/help-vectorize.ts:20-22, functions/api/lib/insights-vectorize.ts:20-22, functions/api/lib/session-room-ideate-handler.ts:46-48, functions/api/lib/team-insights-recurring.ts:89-91` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 2 | 2 | `functions/api/lib/cmk.ts:22-24, functions/api/lib/copilot-live-context.ts:54-56, functions/api/lib/entitlements.ts:18-20, functions/api/lib/event-presenter.ts:8-10` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 6 | `functions/api/lib/session-room-ideate-handler.ts:42-44, functions/api/lib/session-room-retro-handler.ts:32-34, functions/api/lib/session-room-townhall-handler.ts:56-58` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 4 | 11 | `functions/api/lib/session-room-presenter-init.ts:150-154, functions/api/lib/session-room-presenter-init.ts:186-190` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 1 | 6 | `functions/api/routes/marketplace-connect.ts:46-47, functions/api/routes/marketplace-listings.ts:60-61, functions/api/routes/sessions/exports.ts:25-26, functions/api/routes/sessions/exports.ts:79-80` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 3 | 15 | `scripts/kb-sync-cli.ts:49-52, scripts/sync-help-docs.ts:58-61` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 3 | 10 | `functions/api/lib/ai-wizard.ts:220-223, functions/api/lib/ai-wizard.ts:271-274` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 5 | `functions/api/lib/event-presenter.ts:48-50, functions/api/lib/event-suite.ts:57-59` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 5 | `functions/api/routes/partner-apps.ts:37-39, functions/api/routes/partner-marketplace.ts:46-48` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 2 | 3 | `functions/api/lib/native-push.ts:30-32, functions/api/lib/shared/uuid.ts:4-6` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 2 | 3 | `functions/api/lib/session-room-ideate.ts:48-50, functions/api/lib/session-room-retro.ts:30-32` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 1 | 6 | `functions/api/lib/workflows/session-pipeline.ts:159-160, functions/api/lib/workflows/session-pipeline.ts:192-193` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 1 | 6 | `functions/api/routes/marketplace-connect.ts:46-47, functions/api/routes/marketplace-listings.ts:60-61` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 1 | 5 | `functions/api/lib/join-captcha.ts:8-9, functions/api/lib/join-captcha.ts:15-16` | `same body appears under different names across files` |

## Dimensions

| Dimension | Weight | Score | Weighted | Evidence |
| --- | ---: | ---: | ---: | --- |
| Ownership and navigation surface | 13 | 100 | 13.00 | root `AGENTS.md` present; owner map present |
| Contract and boundary integrity | 13 | 100 | 13.00 | contract surface found; generated contract artifacts found |
| Proof lanes and test routing | 12 | 100 | 12.00 | one-command setup/validation lane found; deterministic fast lane found |
| Security and supply-chain posture | 12 | 94 | 11.28 | lockfile present; secret or dependency scan tooling found |
| Code shape and semantic surface | 12 | 80 | 9.60 | largest authored code file: worker/TemplateGenerationWorkflow.ts (499 LOC); most code files stay under 300 LOC |
| Data truth and workflow safety | 8 | 85 | 6.80 | database surface present; migration directory present |
| Observability and repair evidence | 8 | 88 | 7.04 | observability libraries or patterns found; ops/observability directory present |
| Context economy and agent instructions | 7 | 100 | 7.00 | root `AGENTS.md` present; root `AGENTS.md` stays short |
| Jankurai tool adoption and CI replacement | 7 | 78 | 5.46 | control-plane files present; applicable=16 |
| Python containment and polyglot hygiene | 4 | 100 | 4.00 | no Python files in scope |
| Build speed signals | 4 | 70 | 2.80 | build acceleration markers found; targeted test/build commands found |

## Reference Profile Structure

- Applicable cells: `6` canonical=`6` noncanonical=`0` guidance missing=`0`

| Cell | Status | Canonical | Detected | Aliases | Guidance | Owner | Proof lane | Agent fix |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `web` | `canonical` | `apps/web/` | `apps/web` | `frontend/, ui/, packages/web/, packages/ui/` | `present` | `apps/web` | `rendered UX / Playwright` | `keep `apps/web/AGENTS.md` aligned with owns / forbidden / proof lane guidance` |
| `api` | `not_applicable` | `apps/api/` | `-` | `api/, server/, backend/` | `not_required` | `apps/api` | `edge handler / contract tests` | `no action` |
| `domain` | `not_applicable` | `crates/domain/` | `-` | `domain/, core/` | `not_required` | `crates/domain` | `unit / property tests` | `no action` |
| `application` | `not_applicable` | `crates/application/` | `-` | `application/, usecases/, use-cases/` | `not_required` | `crates/application` | `use-case / authz tests` | `no action` |
| `adapters` | `not_applicable` | `crates/adapters/` | `-` | `adapters/, infra/, integrations/` | `not_required` | `crates/adapters` | `adapter integration tests` | `no action` |
| `workers` | `canonical` | `crates/workers/` | `crates/workers, workers` | `workers/, jobs/, scheduler/, queue/` | `present` | `crates/workers` | `workflow / replay tests` | `keep `crates/workers/AGENTS.md` aligned with owns / forbidden / proof lane guidance` |
| `contracts` | `canonical` | `contracts/` | `contracts` | `openapi/, protobuf/, json-schema/, generated/` | `present` | `contracts` | `generation / drift checks` | `keep `contracts/AGENTS.md` aligned with owns / forbidden / proof lane guidance` |
| `db` | `canonical` | `db/` | `db, migrations` | `migrations/, constraints/, sql/` | `present` | `db` | `migration / constraint tests` | `keep `db/AGENTS.md` aligned with owns / forbidden / proof lane guidance` |
| `python-ai` | `canonical` | `python/ai-service/` | `python, python/ai-service` | `python/, ai-service/, evals/, embeddings/, model/` | `present` | `python/ai-service` | `eval / contract tests` | `keep `python/ai-service/AGENTS.md` aligned with owns / forbidden / proof lane guidance` |
| `ops` | `canonical` | `ops/` | `.github, .github/workflows, ops` | `.github/, .github/workflows/, ci/, release/, observability/, security/` | `present` | `ops` | `security lane / workflow lint` | `keep `ops/AGENTS.md` aligned with owns / forbidden / proof lane guidance` |

## Rendered UX QA

- Web surface: `true`
- Layered UX lane: `true`
- Missing: `none`

## Tool Adoption

- Control plane present: `true`
- Applicable tools: `16`
- Configured: `16`
- CI evidence: `11`
- Artifact verified: `11`
- Replaced count: `11`
- Missing CI evidence: `copy-code, security, ci-bad-behavior, git-bad-behavior, release-bad-behavior`

| Tool | Category | Mode | Status | Replaced | Artifacts |
| --- | --- | --- | --- | --- | --- |
| `audit-ci` | `audit` | `auto` | `artifact_verified` | `manual repo scoring, ad hoc score gates` | `agent/repo-score.json, agent/repo-score.md` |
| `proof-routing` | `proof` | `auto` | `artifact_verified` | `ad hoc proof lane selection, manual proof receipts` | `agent/repo-score.json, agent/repo-score.md, target/jankurai/repair-queue.jsonl` |
| `proofbind` | `proof` | `auto` | `artifact_verified` | `manual changed-surface routing, ad hoc proof obligation lists` | `target/jankurai/proofbind/surface-witness.json, target/jankurai/proofbind/obligations.json` |
| `proofmark-rust` | `proof` | `auto` | `not_applicable` | `line-only coverage review, manual in-diff mutation review` | `target/jankurai/proofmark/proofmark-receipt.json, target/jankurai/proofmark/proof-receipt.json` |
| `copy-code` | `audit` | `auto` | `configured` | `ad hoc copy-code review, manual duplication triage` | `target/jankurai/copy-code.json, target/jankurai/copy-code.md` |
| `security` | `security` | `auto` | `configured` | `gitleaks, dependency review, SBOM/provenance` | `target/jankurai/security/evidence.json` |
| `ci-bad-behavior` | `security` | `advisory` | `configured` | `mutable workflow refs, secret echo/debug workflow checks, non-blocking security scans` | `target/jankurai/language-bad-behavior.log` |
| `git-bad-behavior` | `audit` | `advisory` | `configured` | `destructive git automation, force-push release scripts, hidden stash-based state` | `target/jankurai/language-bad-behavior.log` |
| `release-bad-behavior` | `release` | `advisory` | `configured` | `manual release checklist, ad hoc tag and artifact review, manual provenance review` | `target/jankurai/language-bad-behavior.log` |
| `ux-qa` | `ux` | `auto` | `artifact_verified` | `playwright, axe-core, visual baselines` | `target/jankurai/ux-qa.json` |
| `db-migration-analyze` | `db` | `auto` | `artifact_verified` | `manual migration review` | `target/jankurai/migration-report.json` |
| `contract-drift` | `contract` | `auto` | `artifact_verified` | `handwritten contract drift checks, openapi diff` | `agent/repo-score.json, agent/repo-score.md` |
| `rust-witness` | `rust` | `auto` | `not_applicable` | `manual witness graphing` | `target/jankurai/rust/witness-graph.json` |
| `vibe-coverage` | `audit` | `auto` | `not_applicable` | `manual vibe-coding coverage spreadsheet` | `target/jankurai/vibe-coverage.json, target/jankurai/vibe-coverage.md` |
| `coverage-evidence` | `proof` | `auto` | `not_applicable` | `manual coverage report review, ad hoc mutation survivor review` | `target/jankurai/coverage/coverage-audit.json, target/jankurai/coverage/coverage-audit.md` |
| `authz-matrix` | `security` | `advisory` | `artifact_verified` | `manual authz matrix review` | `agent/repo-score.json, agent/repo-score.md` |
| `input-boundary` | `security` | `auto` | `artifact_verified` | `manual unsafe sink review` | `agent/repo-score.json, agent/repo-score.md` |
| `agent-tool-supply` | `security` | `auto` | `artifact_verified` | `manual MCP/tool trust review` | `agent/repo-score.json, agent/repo-score.md` |
| `release-readiness` | `release` | `auto` | `artifact_verified` | `manual launch checklist` | `agent/repo-score.json, agent/repo-score.md` |
| `cost-budget` | `release` | `auto` | `artifact_verified` | `manual spend review` | `agent/repo-score.json, agent/repo-score.md` |

## Boundary manifest (ingested)

- Path: `agent/boundaries.toml`
- Stack: `cloudflare-workers-typescript-react` · version: `0.1.0`
- Queue path counts — adapter: `0`, event_contract: `1`, generated_type: `1`, client_marker: `0`, streaming_exception: `0`
- Content fingerprint: `sha256:50aef7fd09053cc62bf87844c3d558f2fd3529af36fe490104d141868ca686c3`

## Boundary Reclassifications

No audited runtime boundary reclassifications declared.

## Findings

1. `medium` `shape` `.`
   Rule: `HLT-001-DEAD-MARKER`
   Check: `HLT-001-DEAD-MARKER:shape` `soft` confidence `0.76`
   Route: TLR `Entropy`, lane `fast`, owner `tools`
   Docs: `docs/audit-rubric.md#future-hostile-language-rule`
   Reason: `Code shape and semantic surface` scored 80 below the standard floor of 85
   Fix: split large or ambiguous authored code into smaller semantic modules with focused tests
   Rerun: `just fast`
   Fingerprint: `sha256:75de56842ca5f28ba3e026d4acc6d84b700ee23226b612736e36965cb2dd4b4a`
   Evidence: largest authored code file: worker/TemplateGenerationWorkflow.ts (499 LOC), most code files stay under 300 LOC, copy-code advisory classes found: 18 (advisory only, no score impact), sql bad-behavior advisory signals: 95
2. `medium` `proof` `.claude/skills/marketing.md:65`
   Rule: `HLT-027-HUMAN-REVIEW-EVIDENCE-GAP`
   Check: `HLT-027-HUMAN-REVIEW-EVIDENCE-GAP:proof` `soft` confidence `0.88`
   Route: TLR `Repair`, lane `audit`, owner `agent`
   Docs: `docs/testing.md`
   Matched term: `review evidence`
   Reason: proof and review claims need receipts
   Fix: attach raw CI logs, review receipts, and replayable commands instead of accepting claims or summaries
   Rerun: `just score`
   Fingerprint: `sha256:7a10d463950682928cac9b16baa5efc080ecc90063bf61ee6517b9aa8f075153`
   Evidence: | Competitor comparison SEO pages | Pull edges from market-research battle cards; no fabricated claims | `/vs/[competitor]` route copy |
3. `medium` `proof` `Justfile`
   Rule: `HLT-018-PERF-CONCURRENCY-DRIFT`
   Check: `HLT-018-PERF-CONCURRENCY-DRIFT:proof` `soft` confidence `0.76`
   Route: TLR `Verification`, lane `fast`, owner `workspace`
   Docs: `docs/testing.md`
   Reason: `Build speed signals` scored 70 below the standard floor of 85
   Fix: add fast deterministic build/test targets, caches, and narrow proof lanes for agent iteration
   Rerun: `just fast`
   Fingerprint: `sha256:a256a7390d4b91a5b0a95d6f092e524c8f4080f27fe2b62e28cf0801343d0fef`
   Evidence: build acceleration markers found, targeted test/build commands found, locked dependency graph present, CI cache hint found
4. `medium` `release` `docs/testing.md`
   Rule: `HLT-026-COST-BUDGET-GAP`
   Check: `HLT-026-COST-BUDGET-GAP:release` `soft` confidence `0.88`
   Route: TLR `Verification`, lane `release`, owner `standard`
   Docs: `docs/testing.md`
   Matched term: `budget`
   Reason: unbounded paid work needs budgets and stop conditions
   Fix: add explicit budgets, quotas, stop conditions, and kill-switch evidence for paid or unbounded operations
   Rerun: `just check`
   Fingerprint: `sha256:edd248b7afc24b644107205fa5b84a88103ac4b622009ff9f19b779de8798f59`
   Evidence: cost surface found without budget/stop-condition policy

## Policy

- Policy file: `./agent/audit-policy.toml`
- Minimum score: `85`
- Fail on: `critical, high`

## Agent Fix Queue

1. `medium` `HLT-018-PERF-CONCURRENCY-DRIFT` `Justfile` - add fast deterministic build/test targets, caches, and narrow proof lanes for agent iteration
   Route: `Verification`/`fast`
2. `medium` `HLT-026-COST-BUDGET-GAP` `docs/testing.md` - add explicit budgets, quotas, stop conditions, and kill-switch evidence for paid or unbounded operations
   Route: `Verification`/`release`
3. `medium` `HLT-027-HUMAN-REVIEW-EVIDENCE-GAP` `.claude/skills/marketing.md` - attach raw CI logs, review receipts, and replayable commands instead of accepting claims or summaries
   Route: `Repair`/`audit`
4. `medium` `HLT-001-DEAD-MARKER` `.` - split large or ambiguous authored code into smaller semantic modules with focused tests
   Route: `Entropy`/`fast`
