# jankurai Repo Score

- Standard: `jankurai`
- Auditor: `1.5.1`
- Schema: `1`
- Paper edition: `2026-05-12`
- Target stack ID: `cloudflare-workers-typescript-react`
- Target stack: `Rust core + TypeScript/React/Vite + PostgreSQL + generated contracts + exception-only Python AI/data service`
- Repo: `.`
- Run ID: `1783078489`
- Started at: `1783078489`
- Elapsed: `23293` ms
- Scope: `full`
- Raw score: `72`
- Final score: `60`
- Decision: `advisory`
- Minimum score: `85`
- Caps applied: `non-optimal-product-language-found, vibe-placeholders-in-product-code, fallback-soup-in-product-code, future-hostile-dead-language-in-product-code, direct-db-access-from-wrong-layer, secret-like-content-detected, destructive-migration-risk, input-boundary-gap, agent-tool-supply-chain-gap, sql-bad-behavior, typescript-bad-behavior, docker-bad-behavior, ci-bad-behavior, git-bad-behavior, repo-rot-bad-behavior, ci-local-parity`

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
| `non-optimal-product-language-found` | 74 | yes |
| `too-much-python-in-product-surface` | 72 | no |
| `boundary-reclassification-evidence-gap` | 72 | no |
| `vibe-placeholders-in-product-code` | 68 | yes |
| `fallback-soup-in-product-code` | 70 | yes |
| `future-hostile-dead-language-in-product-code` | 64 | yes |
| `severe-duplication-in-product-code` | 70 | no |
| `generated-zone-mutation-risk` | 76 | no |
| `direct-db-access-from-wrong-layer` | 66 | yes |
| `missing-web-e2e-lane` | 82 | no |
| `missing-rendered-ux-qa-lane` | 84 | no |
| `prompt-injection-risk` | 78 | no |
| `overbroad-agent-agency` | 65 | no |
| `secret-like-content-detected` | 60 | yes |
| `false-green-test-risk` | 76 | no |
| `destructive-migration-risk` | 70 | yes |
| `authz-or-data-isolation-gap` | 78 | no |
| `input-boundary-gap` | 78 | yes |
| `agent-tool-supply-chain-gap` | 78 | yes |
| `release-readiness-gap` | 80 | no |
| `missing-rust-property-or-integration-tests` | 82 | no |
| `no-agent-friendly-exception-pattern` | 76 | no |
| `missing-agent-readable-docs` | 80 | no |
| `streaming-runtime-drift` | 78 | no |
| `rust-bad-behavior` | 72 | no |
| `sql-bad-behavior` | 72 | yes |
| `typescript-bad-behavior` | 72 | yes |
| `docker-bad-behavior` | 72 | yes |
| `python-bad-behavior` | 72 | no |
| `ci-bad-behavior` | 70 | yes |
| `git-bad-behavior` | 70 | yes |
| `gittools-bad-behavior` | 70 | no |
| `release-bad-behavior` | 70 | no |
| `web-security-bad-behavior` | 68 | no |
| `repo-rot-bad-behavior` | 88 | yes |
| `comment-hygiene-dangerous-residue` | 72 | no |
| `ci-local-parity` | 70 | yes |

## Copy-Code Redundancy

- Status: `review` hard=`0` warning=`42` files=`689`
- Policy: min-lines=`10` min-tokens=`100` max-findings=`50` include-tests=`false` strict=`false`
- Duplicate volume: lines=`182` tokens=`992` bytes=`5951`

- Notes:
  - hard classes are limited to exact active-source file matches and substantial exact same-name units
  - warning classes include same-body different-name units and token/block duplication
  - tests, fixtures, stories, config, Docker, and migrations are omitted unless --include-tests is set

| Kind | Severity | Language | Lines | Tokens | Instances | Reason |
| --- | --- | --- | ---: | ---: | --- | --- |
| `ExactUnitSameName` | `Warning` | `typescript` | 9 | 16 | `src/components/CaptionsOverlay.tsx:51-60, src/components/ReactionsOverlay.tsx:15-24, src/xr/XrSessionOverlay.tsx:29-38` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 15 | 69 | `functions/api/lib/session-title.ts:20-35, src/lib/session-title.ts:16-31` | `same-name semantic unit copied across multiple files` |
| `TokenBlock` | `Warning` | `typescript` | 14 | 108 | `functions/reddit-auth.ts:24-37, functions/youtube-auth.ts:25-38` | `strict token/block duplication exceeded the configured threshold` |
| `TokenBlock` | `Warning` | `typescript` | 14 | 108 | `functions/reddit-auth.ts:23-36, functions/youtube-auth.ts:24-37` | `strict token/block duplication exceeded the configured threshold` |
| `TokenBlock` | `Warning` | `typescript` | 12 | 106 | `functions/reddit-auth.ts:22-33, functions/youtube-auth.ts:23-34` | `strict token/block duplication exceeded the configured threshold` |
| `TokenBlock` | `Warning` | `typescript` | 12 | 104 | `functions/reddit-auth.ts:20-31, functions/youtube-auth.ts:21-32` | `strict token/block duplication exceeded the configured threshold` |
| `TokenBlock` | `Warning` | `typescript` | 12 | 104 | `functions/reddit-auth.ts:21-32, functions/youtube-auth.ts:22-33` | `strict token/block duplication exceeded the configured threshold` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 5 | 28 | `functions/api/lib/deliberate-crypto.ts:131-136, functions/api/lib/lti.ts:95-100, functions/api/lib/shared/crypto.ts:30-35` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 11 | `functions/api/routes/federation.ts:60-62, functions/api/routes/pulse.ts:24-26, functions/api/routes/sovereign.ts:31-33, functions/api/routes/studio-library.ts:50-52, functions/api/routes/studio.ts:72-74, functions/api/routes/team-insights.ts:45-47` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 8 | `functions/api/lib/marketing/content-engine.ts:38-40, functions/api/lib/marketing/mention-monitor.ts:28-30, functions/api/lib/marketing/publisher.ts:41-43, functions/api/lib/marketing/token-status.ts:29-31, functions/api/lib/marketing/video-gen.ts:41-43, workers/linkedin-scheduler/index.ts:45-47` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 1 | 3 | `functions/api/lib/audit.ts:303-304, functions/api/middleware/kv-cache.ts:89-90, functions/api/middleware/kv-cache.ts:110-111, functions/api/middleware/kv-cache.ts:152-153, functions/api/middleware/kv-cache.ts:174-175, functions/api/middleware/kv-cache.ts:196-197, functions/api/routes/billing.ts:527-528, functions/api/routes/billing.ts:563-564, functions/api/routes/billing.ts:603-604, functions/api/routes/billing.ts:624-625, functions/api/routes/billing.ts:643-644` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 9 | 33 | `functions/api/lib/og-image-generator.ts:156-165, src/utils/og-image-generator.ts:14-23` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 11 | `functions/api/lib/session-room-deliberate-handler.ts:44-46, functions/api/lib/session-room-energizer-handler.ts:55-57, functions/api/lib/session-room-ideate-handler.ts:39-41, functions/api/lib/session-room-retro-handler.ts:28-30, functions/api/lib/session-room-townhall-handler.ts:52-54` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 2 | 6 | `functions/api/lib/session-room-deliberate-handler.ts:48-50, functions/api/lib/session-room-ideate-handler.ts:43-45, functions/api/lib/session-room-messages.ts:3-5, functions/api/lib/session-room-retro-handler.ts:32-34, functions/api/lib/session-room-townhall-handler.ts:56-58` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 3 | 19 | `functions/linkedin-auth.ts:45-48, functions/reddit-auth.ts:31-34, functions/youtube-auth.ts:32-35` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 6 | 32 | `functions/api/lib/voter.ts:9-15, functions/api/middleware/rate-limit.ts:33-39` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 3 | 11 | `functions/api/lib/ai-wizard.ts:224-227, functions/api/lib/ai-wizard.ts:275-278, functions/api/lib/ai-wizard.ts:298-301` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 5 | 28 | `functions/api/lib/lti.ts:95-100, functions/api/lib/shared/crypto.ts:30-35` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 5 | 9 | `functions/api/lib/ai-insights.ts:86-91, functions/api/lib/copilot-suggest.ts:65-70` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 1 | 7 | `functions/api/routes/admin/analytics-advanced.ts:35-36, functions/api/routes/admin/observability.ts:234-235, functions/api/routes/admin/ops-control.ts:38-39, functions/api/routes/admin/platform-overview.ts:247-248, functions/api/routes/admin/user-support.ts:39-40` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 11 | `functions/linkedin-auth.ts:118-120, functions/reddit-auth.ts:89-91, functions/youtube-auth.ts:94-96` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 4 | 16 | `functions/api/lib/deliberate-crypto.ts:24-28, functions/api/lib/session-token.ts:10-14` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 6 | `functions/api/lib/session-room-captions-handler.ts:55-57, functions/api/lib/session-room-reactions-handler.ts:47-49, functions/api/lib/session-room-xr-handler.ts:51-53` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 6 | `functions/api/lib/session-room-ideate-handler.ts:43-45, functions/api/lib/session-room-retro-handler.ts:32-34, functions/api/lib/session-room-townhall-handler.ts:56-58` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 2 | 6 | `src/components/admin/OpsControlPanel.tsx:8-10, src/components/admin/UserDetailDrawer.tsx:18-20, src/components/marketing/TokenHealthTab.tsx:19-21` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 4 | 11 | `functions/api/lib/session-room-presenter-init.ts:168-172, functions/api/lib/session-room-presenter-init.ts:204-208` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 3 | 18 | `functions/api/lib/ai-wizard.ts:143-146, functions/api/lib/studio-authoring.ts:271-274` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 3 | 11 | `functions/api/lib/session-title.ts:6-9, src/lib/session-title.ts:6-9` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 3 | 11 | `functions/api/lib/session-title.ts:11-14, src/lib/session-title.ts:11-14` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 3 | 7 | `functions/api/lib/connect-invite.ts:127-130, functions/api/lib/embed-token.ts:100-103` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 2 | 7 | `functions/api/middleware/plan.ts:18-20, functions/api/routes/billing.ts:56-58` | `same body appears under different names across files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 6 | `src/components/admin/OpsControlPanel.tsx:8-10, src/components/admin/UserDetailDrawer.tsx:18-20` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 6 | `functions/api/routes/teams.ts:94-96, functions/api/routes/webhooks.ts:87-89` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 5 | `functions/api/lib/event-presenter.ts:43-45, functions/api/lib/event-suite.ts:57-59` | `same-name semantic unit copied across multiple files` |
| `ExactUnitSameName` | `Warning` | `typescript` | 2 | 5 | `functions/api/routes/partner-apps.ts:38-40, functions/api/routes/partner-marketplace.ts:46-48` | `same-name semantic unit copied across multiple files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 2 | 3 | `functions/api/lib/native-push.ts:30-32, functions/api/lib/shared/uuid.ts:4-6` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 2 | 3 | `functions/api/lib/session-room-ideate.ts:48-50, functions/api/lib/session-room-retro.ts:30-32` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 2 | 2 | `src/i18n/index.ts:226-228, src/i18n/index.ts:230-232` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 1 | 14 | `functions/api/lib/agent-audit.ts:108-109, functions/api/lib/audit.ts:189-190` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 1 | 6 | `functions/api/lib/workflows/session-pipeline.ts:171-172, functions/api/lib/workflows/session-pipeline.ts:204-205` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 1 | 6 | `functions/api/routes/sessions/exports.ts:26-27, functions/api/routes/sessions/exports.ts:80-81` | `same body appears under different names across files` |
| `ExactUnitDifferentName` | `Warning` | `typescript` | 1 | 5 | `functions/api/lib/join-captcha.ts:8-9, functions/api/lib/join-captcha.ts:15-16` | `same body appears under different names across files` |

## Dimensions

| Dimension | Weight | Score | Weighted | Evidence |
| --- | ---: | ---: | ---: | --- |
| Ownership and navigation surface | 13 | 87 | 11.31 | root `AGENTS.md` present; owner map present |
| Contract and boundary integrity | 13 | 60 | 7.80 | contract surface found; generated contract artifacts found |
| Proof lanes and test routing | 12 | 100 | 12.00 | one-command setup/validation lane found; deterministic fast lane found |
| Security and supply-chain posture | 12 | 94 | 11.28 | lockfile present; secret or dependency scan tooling found |
| Code shape and semantic surface | 12 | 0 | 0.00 | largest authored code file: functions/api/routes/integrations.ts (1029 LOC); code file exceeds 500 LOC |
| Data truth and workflow safety | 8 | 65 | 5.20 | database surface present; migration directory present |
| Observability and repair evidence | 8 | 98 | 7.84 | observability libraries or patterns found; diagnostic shaping hints found |
| Context economy and agent instructions | 7 | 100 | 7.00 | root `AGENTS.md` present; root `AGENTS.md` stays short |
| Jankurai tool adoption and CI replacement | 7 | 43 | 3.01 | control-plane files present; applicable=16 |
| Python containment and polyglot hygiene | 4 | 90 | 3.60 | no Python files in scope; non-optimal product language marker |
| Build speed signals | 4 | 70 | 2.80 | build acceleration markers found; targeted test/build commands found |

## Reference Profile Structure

- Applicable cells: `5` canonical=`5` noncanonical=`0` guidance missing=`0`

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
| `python-ai` | `not_applicable` | `python/ai-service/` | `-` | `python/, ai-service/, evals/, embeddings/, model/` | `not_required` | `python/ai-service` | `eval / contract tests` | `no action` |
| `ops` | `canonical` | `ops/` | `.github, .github/workflows, ops` | `.github/, .github/workflows/, ci/, release/, observability/, security/` | `present` | `ops` | `security lane / workflow lint` | `keep `ops/AGENTS.md` aligned with owns / forbidden / proof lane guidance` |

## Rendered UX QA

- Web surface: `true`
- Layered UX lane: `true`
- Missing: `none`

## Tool Adoption

- Control plane present: `true`
- Applicable tools: `16`
- Configured: `16`
- CI evidence: `3`
- Artifact verified: `3`
- Replaced count: `3`
- Missing CI evidence: `audit-ci, proof-routing, copy-code, security, ci-bad-behavior, git-bad-behavior, release-bad-behavior, contract-drift, authz-matrix, input-boundary, agent-tool-supply, release-readiness, cost-budget`

| Tool | Category | Mode | Status | Replaced | Artifacts |
| --- | --- | --- | --- | --- | --- |
| `audit-ci` | `audit` | `auto` | `configured` | `manual repo scoring, ad hoc score gates` | `.jankurai/repo-score.json, .jankurai/repo-score.md` |
| `proof-routing` | `proof` | `auto` | `configured` | `ad hoc proof lane selection, manual proof receipts` | `.jankurai/repo-score.json, .jankurai/repo-score.md, target/jankurai/repair-queue.jsonl` |
| `proofbind` | `proof` | `auto` | `artifact_verified` | `manual changed-surface routing, ad hoc proof obligation lists` | `target/jankurai/proofbind/surface-witness.json, target/jankurai/proofbind/obligations.json` |
| `proofmark-rust` | `proof` | `auto` | `not_applicable` | `line-only coverage review, manual in-diff mutation review` | `target/jankurai/proofmark/proofmark-receipt.json, target/jankurai/proofmark/proof-receipt.json` |
| `copy-code` | `audit` | `auto` | `configured` | `ad hoc copy-code review, manual duplication triage` | `target/jankurai/copy-code.json, target/jankurai/copy-code.md` |
| `security` | `security` | `auto` | `configured` | `gitleaks, dependency review, SBOM/provenance` | `target/jankurai/security/evidence.json` |
| `ci-bad-behavior` | `security` | `advisory` | `configured` | `mutable workflow refs, secret echo/debug workflow checks, non-blocking security scans` | `target/jankurai/language-bad-behavior.log` |
| `git-bad-behavior` | `audit` | `advisory` | `configured` | `destructive git automation, force-push release scripts, hidden stash-based state` | `target/jankurai/language-bad-behavior.log` |
| `release-bad-behavior` | `release` | `advisory` | `configured` | `manual release checklist, ad hoc tag and artifact review, manual provenance review` | `target/jankurai/language-bad-behavior.log` |
| `ux-qa` | `ux` | `auto` | `artifact_verified` | `playwright, axe-core, visual baselines` | `target/jankurai/ux-qa.json` |
| `db-migration-analyze` | `db` | `auto` | `artifact_verified` | `manual migration review` | `target/jankurai/migration-report.json` |
| `contract-drift` | `contract` | `auto` | `configured` | `handwritten contract drift checks, openapi diff` | `.jankurai/repo-score.json, .jankurai/repo-score.md` |
| `rust-witness` | `rust` | `auto` | `not_applicable` | `manual witness graphing` | `target/jankurai/rust/witness-graph.json` |
| `vibe-coverage` | `audit` | `auto` | `not_applicable` | `manual vibe-coding coverage spreadsheet` | `target/jankurai/vibe-coverage.json, target/jankurai/vibe-coverage.md` |
| `coverage-evidence` | `proof` | `auto` | `not_applicable` | `manual coverage report review, ad hoc mutation survivor review` | `target/jankurai/coverage/coverage-audit.json, target/jankurai/coverage/coverage-audit.md` |
| `authz-matrix` | `security` | `advisory` | `configured` | `manual authz matrix review` | `.jankurai/repo-score.json, .jankurai/repo-score.md` |
| `input-boundary` | `security` | `auto` | `configured` | `manual unsafe sink review` | `.jankurai/repo-score.json, .jankurai/repo-score.md` |
| `agent-tool-supply` | `security` | `auto` | `configured` | `manual MCP/tool trust review` | `.jankurai/repo-score.json, .jankurai/repo-score.md` |
| `release-readiness` | `release` | `auto` | `configured` | `manual launch checklist` | `.jankurai/repo-score.json, .jankurai/repo-score.md` |
| `cost-budget` | `release` | `auto` | `configured` | `manual spend review` | `.jankurai/repo-score.json, .jankurai/repo-score.md` |

## Security evidence (ingested)

- Source: `target/jankurai/security/evidence.json`
- Envelope exit code: `0` · elapsed: `676` ms · strict: `false`
- Commands — ran: `1`, skipped: `4`, failed: `0`
- Generated at: `1783012635`
- Git HEAD (envelope): `e3c654eed2520dd7b9cf601e94a280fa871b7796`

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
   Reason: `Code shape and semantic surface` scored 0 below the standard floor of 85
   Fix: split large or ambiguous authored code into smaller semantic modules with focused tests
   Rerun: `just fast`
   Fingerprint: `sha256:ea2a89bff5712b85ac584da81344d0d9329f24697ccbdbad8bbed196ea9e6f07`
   Evidence: largest authored code file: functions/api/routes/integrations.ts (1029 LOC), code file exceeds 500 LOC, code file exceeds 1000 LOC, most code files stay under 300 LOC
2. `medium` `proof` `.claude/agents/seo-reviewer-agent.md:32`
   Rule: `HLT-027-HUMAN-REVIEW-EVIDENCE-GAP`
   Check: `HLT-027-HUMAN-REVIEW-EVIDENCE-GAP:proof` `soft` confidence `0.88`
   Route: TLR `Repair`, lane `audit`, owner `agent`
   Docs: `docs/testing.md`
   Matched term: `review evidence`
   Reason: proof and review claims need receipts
   Fix: attach raw CI logs, review receipts, and replayable commands instead of accepting claims or summaries
   Rerun: `just score`
   Fingerprint: `sha256:ae890216f42d1cf989cd5edf4a4c689d3623e3df95fc7b72e4ef1a45ff3e32fc`
   Evidence: | `/vs/[competitor]` comparison page added/edited | On-page SEO + content↔intent + no fabricated claims + canonical |
3. `high` `agent` `.claude/hooks/pre-bash.sh:42`
   Rule: `HLT-035-GIT-BAD-BEHAVIOR`
   Check: `HLT-035-GIT-BAD-BEHAVIOR:agent` `hard` confidence `0.95`
   Route: TLR `Context/setup`, lane `audit`, owner `agent`
   Docs: `docs/testing.md`
   Matched term: `git.stage.unbounded`
   Reason: automation commits broad untracked state or bypasses verification
   Fix: enumerate the exact paths and keep verification on
   Rerun: `just score`
   Fingerprint: `sha256:7b4daa142d7fb837463a1167fbfc4002f0927679ee92807342aa4358c01d379f`
   Evidence: detector=git.stage.unbounded, path=.claude/hooks/pre-bash.sh, line=42, proof_window=None, snippet=if echo "$CMD" | grep -qE "git\s+(commit|rebase|push).*--no-verify"; then
4. `high` `agent` `.claude/hooks/pre-bash.sh:43`
   Rule: `HLT-035-GIT-BAD-BEHAVIOR`
   Check: `HLT-035-GIT-BAD-BEHAVIOR:agent` `hard` confidence `0.95`
   Route: TLR `Context/setup`, lane `audit`, owner `agent`
   Docs: `docs/testing.md`
   Matched term: `git.stage.unbounded`
   Reason: automation commits broad untracked state or bypasses verification
   Fix: enumerate the exact paths and keep verification on
   Rerun: `just score`
   Fingerprint: `sha256:1b7dd0572fbd7f066beb992ef5fc179f83f9d3a8d69f8c0199ef8b4e4389f769`
   Evidence: detector=git.stage.unbounded, path=.claude/hooks/pre-bash.sh, line=43, proof_window=None, snippet=echo "BLOCKED: Do not skip git hooks (--no-verify). Fix the underlying issue instead." >&2
5. `high` `agent` `.claude/hooks/pre-bash.sh:48`
   Rule: `HLT-035-GIT-BAD-BEHAVIOR`
   Check: `HLT-035-GIT-BAD-BEHAVIOR:agent` `hard` confidence `0.95`
   Route: TLR `Context/setup`, lane `audit`, owner `agent`
   Docs: `docs/testing.md`
   Matched term: `git.destructive.reset-hard`
   Reason: script mutates the working tree destructively
   Fix: replace the destructive reset with a targeted checkout or explicit path list
   Rerun: `just score`
   Fingerprint: `sha256:d9d437e054cc2b70a57f7168fea47e6e6bed2681fc100770eb408adfcbc18f77`
   Evidence: detector=git.destructive.reset-hard, path=.claude/hooks/pre-bash.sh, line=48, proof_window=None, snippet=if echo "$CMD" | grep -qE "git reset --hard"; then
6. `high` `security` `.claude/skills/cso.md:81`
   Rule: `HLT-024-AGENT-TOOL-SUPPLY-GAP`
   Check: `HLT-024-AGENT-TOOL-SUPPLY-GAP:security` `hard` confidence `0.88`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `agent`
   Docs: `docs/audit-rubric.md#top-level-risk-mapping`
   Matched term: `agent tool supply`
   Reason: agent tool supply-chain changes alter execution authority
   Fix: pin and review agent tools, MCP servers, hooks, and rule files; keep untrusted tool output separate from trusted policy
   Rerun: `just security`
   Fingerprint: `sha256:4eb9b5b7d800b644a88e29c152446805c0a41f0ce06296e016b7911be909ad1d`
   Evidence: □ Stripe SDK: not used in this repo today (Stripe calls are REST); if introduced, pin to latest stable and verify via `npm ls stripe @stripe/stripe-js`
7. `high` `ci` `.github/workflows/copilot-setup-steps.yml:14`
   Rule: `HLT-042-CI-LOCAL-PARITY`
   Check: `HLT-042-CI-LOCAL-PARITY:ci` `hard` confidence `0.95`
   Route: TLR `Verification`, lane `fast`, owner `ops`
   Docs: `docs/ci-local.md`
   Matched term: `ci.local-parity.workflow-not-thin`
   Reason: without a single source of truth, local runs drift from CI and breakage is only visible after push
   Fix: extract the workflow steps into ops/ci/<lane>.sh and call them with `bash ops/ci/<lane>.sh`
   Rerun: `just fast`
   Fingerprint: `sha256:3942142976e6f293193941ae704b8478a50e132b7a2f90dc64a8869a1b437f8f`
   Evidence: detector=ci.local-parity.workflow-not-thin, path=.github/workflows/copilot-setup-steps.yml, line=14, proof_window=None, snippet=jobs:
8. `high` `ci` `.github/workflows/daily-repo-status.lock.yml:74`
   Rule: `HLT-042-CI-LOCAL-PARITY`
   Check: `HLT-042-CI-LOCAL-PARITY:ci` `hard` confidence `0.95`
   Route: TLR `Verification`, lane `fast`, owner `ops`
   Docs: `docs/ci-local.md`
   Matched term: `ci.local-parity.workflow-not-thin`
   Reason: without a single source of truth, local runs drift from CI and breakage is only visible after push
   Fix: extract the workflow steps into ops/ci/<lane>.sh and call them with `bash ops/ci/<lane>.sh`
   Rerun: `just fast`
   Fingerprint: `sha256:74a7602f32ce4f41ee12acedead5bc82a40656ac0c80901b9244155567c19c0f`
   Evidence: detector=ci.local-parity.workflow-not-thin, path=.github/workflows/daily-repo-status.lock.yml, line=74, proof_window=None, snippet=jobs:
9. `high` `security` `.github/workflows/daily-repo-status.lock.yml:304`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:f8a4d022b4506220c0d3594544f21246ccc933a826292609b7ab40165c8c7cdf`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=304, proof_window=None, snippet=file: process.env.GH_AW_PROMPT,
10. `high` `security` `.github/workflows/daily-repo-status.lock.yml:306`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:f2ba0edb15a2279747a571c78c567e25dc30bb704612b8e2745d259e93d8bcf8`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=306, proof_window=None, snippet=GH_AW_EXPR_1A3A194A: process.env.GH_AW_EXPR_1A3A194A,
11. `high` `security` `.github/workflows/daily-repo-status.lock.yml:307`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:acdbdf9da34870643f7ce98b5f5661567c81f508d9531a539ba8ef9069f49965`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=307, proof_window=None, snippet=GH_AW_EXPR_463A214A: process.env.GH_AW_EXPR_463A214A,
12. `high` `security` `.github/workflows/daily-repo-status.lock.yml:308`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:0ce74db6345351adbfcd3594c546e087d81bf32de2463c3aab1247f1427dfea8`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=308, proof_window=None, snippet=GH_AW_EXPR_802A9F6A: process.env.GH_AW_EXPR_802A9F6A,
13. `high` `security` `.github/workflows/daily-repo-status.lock.yml:309`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:3623d3fa2cd1117e100d6d9560dc3092f308073eff8213c487fc2ab09119d913`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=309, proof_window=None, snippet=GH_AW_EXPR_FF1D34CE: process.env.GH_AW_EXPR_FF1D34CE,
14. `high` `security` `.github/workflows/daily-repo-status.lock.yml:310`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:18118c53f3c63f805f9d11794bd0ae4e161705328d8a62a6205911ef1fd1a5e2`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=310, proof_window=None, snippet=GH_AW_GITHUB_ACTOR: process.env.GH_AW_GITHUB_ACTOR,
15. `high` `security` `.github/workflows/daily-repo-status.lock.yml:311`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:e58577f4f4d93671d4187318638a5c0eb33b54d164647e2b48224c6f394ac4b6`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=311, proof_window=None, snippet=GH_AW_GITHUB_REPOSITORY: process.env.GH_AW_GITHUB_REPOSITORY,
16. `high` `security` `.github/workflows/daily-repo-status.lock.yml:312`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:1c802438a86d02d0da48eadc45cc54b86aabbaa15707c57ec80b6d89e553e680`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=312, proof_window=None, snippet=GH_AW_GITHUB_RUN_ID: process.env.GH_AW_GITHUB_RUN_ID,
17. `high` `security` `.github/workflows/daily-repo-status.lock.yml:313`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:4d710e8a6388f0a5ee698dbad6009371ec906384e501d1199af3631ff0b654d0`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=313, proof_window=None, snippet=GH_AW_GITHUB_WORKSPACE: process.env.GH_AW_GITHUB_WORKSPACE,
18. `high` `security` `.github/workflows/daily-repo-status.lock.yml:314`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:bdfc4811cab9077af4bafa1256bc893723f34b5ebd3e99bae659a16023f74ce7`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=314, proof_window=None, snippet=GH_AW_MCP_CLI_SERVERS_LIST: process.env.GH_AW_MCP_CLI_SERVERS_LIST
19. `high` `agent` `.github/workflows/daily-repo-status.lock.yml:427`
   Rule: `HLT-035-GIT-BAD-BEHAVIOR`
   Check: `HLT-035-GIT-BAD-BEHAVIOR:agent` `hard` confidence `0.95`
   Route: TLR `Context/setup`, lane `audit`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `git.remote.credential-url`
   Reason: remote credential is present in a command or config line
   Fix: move credentials out of the URL and use a token helper or credential store
   Rerun: `just score`
   Fingerprint: `sha256:8bcd41349ef58a6e62c4f7e896a8e2e290e3d7e914b99becb7aa50cd27ec0fee`
   Evidence: detector=git.remote.credential-url, path=.github/workflows/daily-repo-status.lock.yml, line=427, proof_window=None, snippet=git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@${SERVER_URL_STRIPPED}/${REPO_NAME}.git"
20. `high` `security` `.github/workflows/daily-repo-status.lock.yml:672`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:76852b4909118d5c56a45de1bfa403ca13ff23bf812eaad389776e306b6712db`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=672, proof_window=None, snippet=export MCP_GATEWAY_DOMAIN="host.docker.internal"
21. `high` `security` `.github/workflows/daily-repo-status.lock.yml:688`
   Rule: `HLT-032-DOCKER-BAD-BEHAVIOR`
   Check: `HLT-032-DOCKER-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `docker.compose.socket-mount`
   Reason: the container can reach the host Docker daemon
   Fix: remove the socket mount or isolate the job behind a dedicated daemon boundary
   Rerun: `just security`
   Fingerprint: `sha256:0721526c742013a0ea026c2cf447ba81ca28e29eec1c26b5cc777addb310c097`
   Evidence: detector=docker.compose.socket-mount, path=.github/workflows/daily-repo-status.lock.yml, line=688, proof_window=None, snippet=* ) DOCKER_SOCK_PATH=/var/run/docker.sock ;;
22. `high` `security` `.github/workflows/daily-repo-status.lock.yml:691`
   Rule: `HLT-032-DOCKER-BAD-BEHAVIOR`
   Check: `HLT-032-DOCKER-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `docker.compose.socket-mount`
   Reason: the container can reach the host Docker daemon
   Fix: remove the socket mount or isolate the job behind a dedicated daemon boundary
   Rerun: `just security`
   Fingerprint: `sha256:d39d0fa9e17d2aa012bc51c8a5e31bdf0a45e085d47747ca7b1c98af5ba4be94`
   Evidence: detector=docker.compose.socket-mount, path=.github/workflows/daily-repo-status.lock.yml, line=691, proof_window=None, snippet=export MCP_GATEWAY_DOCKER_COMMAND='docker run -i --rm --network host --add-host host.docker.internal:127.0.0.1 --user '"${MCP_GATEWAY_UID}"':'"${MCP_GATEWAY_GID
23. `high` `security` `.github/workflows/daily-repo-status.lock.yml:691`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:472d4f2c5b363404e1a23ecbadeef7b972c5bcfbca5d02a36a81a94a4038662b`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=691, proof_window=None, snippet=export MCP_GATEWAY_DOCKER_COMMAND='docker run -i --rm --network host --add-host host.docker.internal:127.0.0.1 --user '"${MCP_GATEWAY_UID}"':'"${MCP_GATEWAY_GID
24. `high` `security` `.github/workflows/daily-repo-status.lock.yml:719`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:33d0031e37fc4c7f713d2cd8940b605a66e622002f32190fedecd1f4aaeeb8bb`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=719, proof_window=None, snippet="url": "http://host.docker.internal:$GH_AW_SAFE_OUTPUTS_PORT",
25. `high` `security` `.github/workflows/daily-repo-status.lock.yml:779`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:41861f08984ef56ca0705f833a999ab82dd4d59890eee60c34ce3dfdda33b5c7`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=779, proof_window=None, snippet=printf '%s\n' "{\"\$schema\":\"https://github.com/github/gh-aw-firewall/releases/download/v0.27.2/awf-config.schema.json\",\"network\":{\"allowDomains\":[\"api.
26. `high` `security` `.github/workflows/daily-repo-status.lock.yml:796`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.secret.echo-or-debug`
   Reason: secret-bearing workflow step writes sensitive values to logs
   Fix: never echo secrets; pass them directly to trusted binaries and keep shell tracing off
   Rerun: `just security`
   Fingerprint: `sha256:ae949dfb4c54acaf09e9c89a3ae018c0d7d5bb4a3ade6921c0652f685be2370c`
   Evidence: detector=ci.secret.echo-or-debug, path=.github/workflows/daily-repo-status.lock.yml, line=796, proof_window=None, snippet=sudo -E awf --config "${RUNNER_TEMP}/gh-aw/awf-config.json" --container-workdir "${GITHUB_WORKSPACE}" --mount "${RUNNER_TEMP}/gh-aw:${RUNNER_TEMP}/gh-aw:ro" --m
27. `high` `agent` `.github/workflows/daily-repo-status.lock.yml:840`
   Rule: `HLT-035-GIT-BAD-BEHAVIOR`
   Check: `HLT-035-GIT-BAD-BEHAVIOR:agent` `hard` confidence `0.95`
   Route: TLR `Context/setup`, lane `audit`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `git.remote.credential-url`
   Reason: remote credential is present in a command or config line
   Fix: move credentials out of the URL and use a token helper or credential store
   Rerun: `just score`
   Fingerprint: `sha256:4f187bbc3d7b419f5fe26c5a5276fa741cf831ebf6be4269c572881aa5e6b83b`
   Evidence: detector=git.remote.credential-url, path=.github/workflows/daily-repo-status.lock.yml, line=840, proof_window=None, snippet=git remote set-url origin "https://x-access-token:${GITHUB_TOKEN}@${SERVER_URL_STRIPPED}/${REPO_NAME}.git"
28. `high` `security` `.github/workflows/daily-repo-status.lock.yml:886`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:af586a91d53eb9642d6ee0edc6bff9e7d829e8164c46808f4f965808084ae9ec`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=886, proof_window=None, snippet=GH_AW_ALLOWED_DOMAINS: "api.business.githubcopilot.com,api.enterprise.githubcopilot.com,api.github.com,api.githubcopilot.com,api.individual.githubcopilot.com,ap
29. `high` `security` `.github/workflows/daily-repo-status.lock.yml:1050`
   Rule: `HLT-020-CI-HARDENING-GAP`
   Check: `HLT-020-CI-HARDENING-GAP:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/audit-rubric.md#top-level-risk-mapping`
   Reason: security or proof job is marked nonblocking
   Fix: remove the nonblocking override and let the security or proof job fail so the CI gate actually proves the change
   Rerun: `just security`
   Fingerprint: `sha256:5528eeb18a862b413d130cefad392dffe82367c3530e0697b58991f61e1eec88`
   Evidence: CI hardening gap detected
30. `high` `security` `.github/workflows/daily-repo-status.lock.yml:1332`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:db83a116f2416bfe1af22ef47d57483c211e6cc15a95d7058478399f594ea651`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=1332, proof_window=None, snippet=printf '%s\n' "{\"\$schema\":\"https://github.com/github/gh-aw-firewall/releases/download/v0.27.2/awf-config.schema.json\",\"network\":{\"allowDomains\":[\"api.
31. `high` `security` `.github/workflows/daily-repo-status.lock.yml:1349`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.secret.echo-or-debug`
   Reason: secret-bearing workflow step writes sensitive values to logs
   Fix: never echo secrets; pass them directly to trusted binaries and keep shell tracing off
   Rerun: `just security`
   Fingerprint: `sha256:5f14c733381bdeab1447be5c60306b32b09f6cb657725114f61c43ef3681698d`
   Evidence: detector=ci.secret.echo-or-debug, path=.github/workflows/daily-repo-status.lock.yml, line=1349, proof_window=None, snippet=sudo -E awf --config "${RUNNER_TEMP}/gh-aw/awf-config.json" --container-workdir "${GITHUB_WORKSPACE}" --mount "${RUNNER_TEMP}/gh-aw:${RUNNER_TEMP}/gh-aw:ro" --m
32. `high` `security` `.github/workflows/daily-repo-status.lock.yml:1412`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:4593095e7f0725b07807b67dc6e199527c92045ff125422ff2bb0dc416199f3b`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=1412, proof_window=None, snippet=const continueOnError = process.env.GH_AW_DETECTION_CONTINUE_ON_ERROR !== 'false';
33. `high` `security` `.github/workflows/daily-repo-status.lock.yml:1413`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:7bdfc3512d2db97f8e1c8baf07bd393fa54ec1378b88e65475b5e51a4d1e87fb`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=1413, proof_window=None, snippet=const detectionExecutionFailed = process.env.DETECTION_AGENTIC_EXECUTION_OUTCOME === 'failure';
34. `high` `security` `.github/workflows/daily-repo-status.lock.yml:1510`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.artifact.cache.secret-path`
   Reason: workflow stores a secret-bearing path in cache or artifact upload
   Fix: limit the path to build outputs and keep credential files out of caches and artifacts
   Rerun: `just security`
   Fingerprint: `sha256:c2b307300cba193eb1dfe2f18696466cd0d382d120be53177a251da3ae5573d3`
   Evidence: detector=ci.artifact.cache.secret-path, path=.github/workflows/daily-repo-status.lock.yml, line=1510, proof_window=None, snippet=GH_AW_ALLOWED_DOMAINS: "api.business.githubcopilot.com,api.enterprise.githubcopilot.com,api.github.com,api.githubcopilot.com,api.individual.githubcopilot.com,ap
35. `high` `security` `.github/workflows/jankurai.yml:66`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.security-scan.nonblocking`
   Reason: security or proof job is explicitly non-blocking
   Fix: remove the non-blocking override so scan failures stop the pipeline
   Rerun: `just security`
   Fingerprint: `sha256:6d039cd80e31f16bf01059c7a904bb60b2103d9e3a9401ebea8933383b76df53`
   Evidence: detector=ci.security-scan.nonblocking, path=.github/workflows/jankurai.yml, line=66, proof_window=None, snippet=continue-on-error: true
36. `high` `security` `.github/workflows/jankurai.yml:70`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.security-scan.nonblocking`
   Reason: security or proof job is explicitly non-blocking
   Fix: remove the non-blocking override so scan failures stop the pipeline
   Rerun: `just security`
   Fingerprint: `sha256:adde3f41175cdd573dfcdb443be7dce17bafa4eb889106f19ce6d0ed0ca0ecff`
   Evidence: detector=ci.security-scan.nonblocking, path=.github/workflows/jankurai.yml, line=70, proof_window=None, snippet=continue-on-error: true
37. `high` `security` `.github/workflows/jankurai.yml:74`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.security-scan.nonblocking`
   Reason: security or proof job is explicitly non-blocking
   Fix: remove the non-blocking override so scan failures stop the pipeline
   Rerun: `just security`
   Fingerprint: `sha256:e1ff2a02b7a4183b0b805dc630e02e14815063b5dd5de938d0b81c0c68816a53`
   Evidence: detector=ci.security-scan.nonblocking, path=.github/workflows/jankurai.yml, line=74, proof_window=None, snippet=continue-on-error: true
38. `high` `security` `.github/workflows/jankurai.yml:78`
   Rule: `HLT-034-CI-BAD-BEHAVIOR`
   Check: `HLT-034-CI-BAD-BEHAVIOR:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `ci.security-scan.nonblocking`
   Reason: security or proof job is explicitly non-blocking
   Fix: remove the non-blocking override so scan failures stop the pipeline
   Rerun: `just security`
   Fingerprint: `sha256:2adc9f6968be3e6770e7cc089b0e10f3591ba5d8522acff21af4c76d3b74a674`
   Evidence: detector=ci.security-scan.nonblocking, path=.github/workflows/jankurai.yml, line=78, proof_window=None, snippet=continue-on-error: true
39. `high` `ci` `.github/workflows/playwright.yml:13`
   Rule: `HLT-042-CI-LOCAL-PARITY`
   Check: `HLT-042-CI-LOCAL-PARITY:ci` `hard` confidence `0.95`
   Route: TLR `Verification`, lane `fast`, owner `ops`
   Docs: `docs/ci-local.md`
   Matched term: `ci.local-parity.workflow-not-thin`
   Reason: without a single source of truth, local runs drift from CI and breakage is only visible after push
   Fix: extract the workflow steps into ops/ci/<lane>.sh and call them with `bash ops/ci/<lane>.sh`
   Rerun: `just fast`
   Fingerprint: `sha256:b24f86966acfe5a4b334e0f918fd308faf3b9b5dc792b3184c35d8c7f85c739c`
   Evidence: detector=ci.local-parity.workflow-not-thin, path=.github/workflows/playwright.yml, line=13, proof_window=None, snippet=jobs:
40. `high` `ci` `.github/workflows/vectorize-health.yml:23`
   Rule: `HLT-042-CI-LOCAL-PARITY`
   Check: `HLT-042-CI-LOCAL-PARITY:ci` `hard` confidence `0.95`
   Route: TLR `Verification`, lane `fast`, owner `ops`
   Docs: `docs/ci-local.md`
   Matched term: `ci.local-parity.workflow-not-thin`
   Reason: without a single source of truth, local runs drift from CI and breakage is only visible after push
   Fix: extract the workflow steps into ops/ci/<lane>.sh and call them with `bash ops/ci/<lane>.sh`
   Rerun: `just fast`
   Fingerprint: `sha256:5be62e6a3e5f800695506b7b95d5a29c9bc213ee8c97a76555c77152725d448a`
   Evidence: detector=ci.local-parity.workflow-not-thin, path=.github/workflows/vectorize-health.yml, line=23, proof_window=None, snippet=jobs:
41. `medium` `proof` `Justfile`
   Rule: `HLT-018-PERF-CONCURRENCY-DRIFT`
   Check: `HLT-018-PERF-CONCURRENCY-DRIFT:proof` `soft` confidence `0.76`
   Route: TLR `Verification`, lane `fast`, owner `workspace`
   Docs: `docs/testing.md`
   Reason: `Build speed signals` scored 70 below the standard floor of 85
   Fix: add fast deterministic build/test targets, caches, and narrow proof lanes for agent iteration
   Rerun: `just fast`
   Fingerprint: `sha256:a256a7390d4b91a5b0a95d6f092e524c8f4080f27fe2b62e28cf0801343d0fef`
   Evidence: build acceleration markers found, targeted test/build commands found, locked dependency graph present, CI cache hint found
42. `critical` `security` `agent/baselines/main.repo-score.md:1394`
   Rule: `HLT-010-SECRET-SPRAWL`
   Check: `HLT-010-SECRET-SPRAWL:security` `hard` confidence `0.95`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `agent`
   Docs: `docs/audit-rubric.md#top-level-risk-mapping`
   Reason: secret-like value or credential material appears in repository text
   Fix: remove and rotate the credential, add local and CI secret scanning, and scan transcripts/artifacts/MCP config for related exposure
   Rerun: `just security`
   Fingerprint: `sha256:fbdc3acf6a5791e31134b6960bda06dcf6e4d9c2789e3ec5afb87244e374264c`
   Evidence: Evidence: const SECRET = 'integration-test-secret-at-least-32-bytes!'
43. `medium` `boundary` `agent/boundaries.toml`
   Rule: `HLT-007-HANDWRITTEN-CONTRACT`
   Check: `HLT-007-HANDWRITTEN-CONTRACT:boundary` `soft` confidence `0.76`
   Route: TLR `Contracts/data`, lane `contract`, owner `agent`
   Docs: `docs/audit-rubric.md#known-vibe-coding-insults`
   Reason: `Contract and boundary integrity` scored 60 below the standard floor of 85
   Fix: add generated contracts and boundary checks for public APIs, data access, and cross-runtime seams
   Rerun: `just fast`
   Fingerprint: `sha256:088255e568c1ffdd351c9862de8b72557028081a9cd8afd007818eddad8e0103`
   Evidence: contract surface found, generated contract artifacts found, polyglot boundary layout present, boundary manifest present
44. `high` `context` `agent/owner-map.json`
   Rule: `HLT-003-OWNERLESS-PATH`
   Check: `HLT-003-OWNERLESS-PATH:context` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#ownership-boundaries`
   Reason: path `.jankurai/score-history.jsonl` has no owner-map route
   Fix: add the narrowest stable prefix for this path to `agent/owner-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:4f19710df0a7808bc29a619bf91fc6e1be34b99a193c7a5f98b95c458107314a`
   Evidence: .jankurai/score-history.jsonl
45. `high` `context` `agent/owner-map.json`
   Rule: `HLT-003-OWNERLESS-PATH`
   Check: `HLT-003-OWNERLESS-PATH:context` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#ownership-boundaries`
   Reason: path `.mcp.json` has no owner-map route
   Fix: add the narrowest stable prefix for this path to `agent/owner-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:38d99046c14723dc28a47a949f6343bf375872727c7b0cb5bf7a470b8621e5d6`
   Evidence: .mcp.json
46. `high` `context` `agent/owner-map.json`
   Rule: `HLT-003-OWNERLESS-PATH`
   Check: `HLT-003-OWNERLESS-PATH:context` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#ownership-boundaries`
   Reason: path `.npmrc` has no owner-map route
   Fix: add the narrowest stable prefix for this path to `agent/owner-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:dde7079d7d542d42f4829f9707dc42a1275c0a9e27b91a8ca3f9d0b0c00cf2e8`
   Evidence: .npmrc
47. `high` `context` `agent/owner-map.json`
   Rule: `HLT-003-OWNERLESS-PATH`
   Check: `HLT-003-OWNERLESS-PATH:context` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#ownership-boundaries`
   Reason: path `.pre-commit-config.yaml` has no owner-map route
   Fix: add the narrowest stable prefix for this path to `agent/owner-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:22090329bf95fdcde00d6b8ff6c8ec84130225472c169c603ecefe7bf66b4f8f`
   Evidence: .pre-commit-config.yaml
48. `high` `context` `agent/owner-map.json`
   Rule: `HLT-003-OWNERLESS-PATH`
   Check: `HLT-003-OWNERLESS-PATH:context` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#ownership-boundaries`
   Reason: path `AUDIT_FIXES_SUMMARY.md` has no owner-map route
   Fix: add the narrowest stable prefix for this path to `agent/owner-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:871e4049db146ff6baede28720ce075026efe51a9c02960a1457ccb689c3dc06`
   Evidence: AUDIT_FIXES_SUMMARY.md
49. `high` `context` `agent/owner-map.json`
   Rule: `HLT-003-OWNERLESS-PATH`
   Check: `HLT-003-OWNERLESS-PATH:context` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#ownership-boundaries`
   Reason: path `BingSiteAuth.xml` has no owner-map route
   Fix: add the narrowest stable prefix for this path to `agent/owner-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:5a380a1414d334c836a3a5f5520d29ed65cd49878a0018fb58a1fda314263093`
   Evidence: BingSiteAuth.xml
50. `high` `context` `agent/owner-map.json`
   Rule: `HLT-003-OWNERLESS-PATH`
   Check: `HLT-003-OWNERLESS-PATH:context` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#ownership-boundaries`
   Reason: path `FEATURE_COMPLIANCE_MATRIX.csv` has no owner-map route
   Fix: add the narrowest stable prefix for this path to `agent/owner-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:6d3cda6baf81eb9b47897ef06624cd3436459719caca2a17d39fc9e02e2467ee`
   Evidence: FEATURE_COMPLIANCE_MATRIX.csv
51. `high` `context` `agent/owner-map.json`
   Rule: `HLT-003-OWNERLESS-PATH`
   Check: `HLT-003-OWNERLESS-PATH:context` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#ownership-boundaries`
   Reason: path `JANKURAI_AUDIT_2026_07_02.md` has no owner-map route
   Fix: add the narrowest stable prefix for this path to `agent/owner-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:82a6679385e6991cc96cc2d9b913445d6bb2fa27a7c25f62e21499cb14a886e2`
   Evidence: JANKURAI_AUDIT_2026_07_02.md
52. `high` `context` `agent/owner-map.json`
   Rule: `HLT-003-OWNERLESS-PATH`
   Check: `HLT-003-OWNERLESS-PATH:context` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#ownership-boundaries`
   Reason: path `JANURAI_AUDIT_2026_06_15.md` has no owner-map route
   Fix: add the narrowest stable prefix for this path to `agent/owner-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:a42411e4d67c7407e459d568fa78cb90ba43c6f5f0673fd5a4bd969640656440`
   Evidence: JANURAI_AUDIT_2026_06_15.md
53. `high` `context` `agent/owner-map.json`
   Rule: `HLT-003-OWNERLESS-PATH`
   Check: `HLT-003-OWNERLESS-PATH:context` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#ownership-boundaries`
   Reason: path `PROMISE_AUDIT_QUICK_REFERENCE.md` has no owner-map route
   Fix: add the narrowest stable prefix for this path to `agent/owner-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:5d66bb9467b495a64b42b3e9885f75d6fcb5a71491a01b987b2b5f80abdbe986`
   Evidence: PROMISE_AUDIT_QUICK_REFERENCE.md
54. `high` `proof` `agent/test-map.json`
   Rule: `HLT-004-UNMAPPED-PROOF`
   Check: `HLT-004-UNMAPPED-PROOF:proof` `hard` confidence `0.88`
   Route: TLR `Verification`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#proof-lanes`
   Reason: path `.dev.vars.example` has no test-map proof route
   Fix: add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:73d2ed790b95a07a823e837802e9510b2e9a718992d0af45ae0e5540bd559db3`
   Evidence: .dev.vars.example
55. `high` `proof` `agent/test-map.json`
   Rule: `HLT-004-UNMAPPED-PROOF`
   Check: `HLT-004-UNMAPPED-PROOF:proof` `hard` confidence `0.88`
   Route: TLR `Verification`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#proof-lanes`
   Reason: path `.env.example` has no test-map proof route
   Fix: add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:0b9aed5afb7c6f94cd166fa74e960d897cb6b3e698c6b31aec9b820aa39d27dc`
   Evidence: .env.example
56. `high` `proof` `agent/test-map.json`
   Rule: `HLT-004-UNMAPPED-PROOF`
   Check: `HLT-004-UNMAPPED-PROOF:proof` `hard` confidence `0.88`
   Route: TLR `Verification`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#proof-lanes`
   Reason: path `.gitattributes` has no test-map proof route
   Fix: add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:5685ed57c4e04c23e7f38d6f58088747659a19ca2aeab855f958d680acaa8819`
   Evidence: .gitattributes
57. `high` `proof` `agent/test-map.json`
   Rule: `HLT-004-UNMAPPED-PROOF`
   Check: `HLT-004-UNMAPPED-PROOF:proof` `hard` confidence `0.88`
   Route: TLR `Verification`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#proof-lanes`
   Reason: path `.github/AGENTS.md` has no test-map proof route
   Fix: add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:0ef94c517ba5d8438cda9cff4411bbdc6c18f75807b4d7a355c81a866f8f68d6`
   Evidence: .github/AGENTS.md
58. `high` `proof` `agent/test-map.json`
   Rule: `HLT-004-UNMAPPED-PROOF`
   Check: `HLT-004-UNMAPPED-PROOF:proof` `hard` confidence `0.88`
   Route: TLR `Verification`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#proof-lanes`
   Reason: path `.github/SECURITY_INCIDENT.md` has no test-map proof route
   Fix: add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:18b9add8ae8bebeb805fc61e0b26b92863721211068e6f9af89d8b52303c6b2a`
   Evidence: .github/SECURITY_INCIDENT.md
59. `high` `proof` `agent/test-map.json`
   Rule: `HLT-004-UNMAPPED-PROOF`
   Check: `HLT-004-UNMAPPED-PROOF:proof` `hard` confidence `0.88`
   Route: TLR `Verification`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#proof-lanes`
   Reason: path `.github/action-pins.env` has no test-map proof route
   Fix: add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:4d50dbad51f70c344442afc7aeefedda4eabd6638718719c0c00ae13c58be70e`
   Evidence: .github/action-pins.env
60. `high` `proof` `agent/test-map.json`
   Rule: `HLT-004-UNMAPPED-PROOF`
   Check: `HLT-004-UNMAPPED-PROOF:proof` `hard` confidence `0.88`
   Route: TLR `Verification`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#proof-lanes`
   Reason: path `.github/agents/agentic-workflows.md` has no test-map proof route
   Fix: add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:6f9e4ae63a8852c4852fdae83ac8977e243343a55f3df11cfd42354e38660732`
   Evidence: .github/agents/agentic-workflows.md
61. `high` `proof` `agent/test-map.json`
   Rule: `HLT-004-UNMAPPED-PROOF`
   Check: `HLT-004-UNMAPPED-PROOF:proof` `hard` confidence `0.88`
   Route: TLR `Verification`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#proof-lanes`
   Reason: path `.github/aw/actions-lock.json` has no test-map proof route
   Fix: add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:276ed71810a35ff53793348103c72e18fa70cd7912457e70e8aa58007063aa24`
   Evidence: .github/aw/actions-lock.json
62. `high` `proof` `agent/test-map.json`
   Rule: `HLT-004-UNMAPPED-PROOF`
   Check: `HLT-004-UNMAPPED-PROOF:proof` `hard` confidence `0.88`
   Route: TLR `Verification`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#proof-lanes`
   Reason: path `.github/dependabot.yml` has no test-map proof route
   Fix: add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:360ba701702551129fcdec586565ed5115ef32470760622429a277b9ec486d14`
   Evidence: .github/dependabot.yml
63. `high` `proof` `agent/test-map.json`
   Rule: `HLT-004-UNMAPPED-PROOF`
   Check: `HLT-004-UNMAPPED-PROOF:proof` `hard` confidence `0.88`
   Route: TLR `Verification`, lane `fast`, owner `agent`
   Docs: `agent/JANKURAI_STANDARD.md#proof-lanes`
   Reason: path `.github/mcp.json` has no test-map proof route
   Fix: add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Rerun: `just fast`
   Fingerprint: `sha256:a4f769a3bc51acb39cdeef4ec31c22166f7964f7acdc45104aa61a7a598ec7f0`
   Evidence: .github/mcp.json
64. `medium` `context` `contracts/openapi-v3.json:1`
   Rule: `HLT-040-REPO-ROT-BAD-BEHAVIOR`
   Check: `HLT-040-REPO-ROT-BAD-BEHAVIOR:context` `soft` confidence `0.88`
   Route: TLR `Context/setup`, lane `audit`, owner `tools`
   Docs: `docs/language-bad-behavior.md#web-security-and-repo-rot-detectors`
   Matched term: `repo-rot.path.fake-versioned-source`
   Reason: ambiguous old-looking active source makes agents and reviewers guess whether code is live
   Fix: delete the stale copy, move history to VCS/archive tooling, or document owner, proof lane, expiry, and migration plan
   Rerun: `just score`
   Fingerprint: `sha256:8c9889eae90dc386562ed6d95cf2e6f4a5a139c5747cc5f0ff88da52a891d24b`
   Evidence: detector=repo-rot.path.fake-versioned-source, path=contracts/openapi-v3.json, line=1, proof_window=None, snippet={
65. `high` `boundary` `contracts/openapi-v3.json:1`
   Rule: `HLT-007-HANDWRITTEN-CONTRACT`
   Check: `HLT-007-HANDWRITTEN-CONTRACT:boundary` `hard` confidence `0.88`
   Route: TLR `Contracts/data`, lane `contract`, owner `tools`
   Docs: `docs/audit-rubric.md#known-vibe-coding-insults`
   Reason: contract source `contracts/openapi-v3.json` has no generated zone entry
   Fix: add a `[[zone]]` in `agent/generated-zones.toml` with `source`, `command`, and `path` for this contract, or generate typed clients from it
   Rerun: `just fast`
   Fingerprint: `sha256:54e379d3c3cd2384ee506a3d3657157011dfc9d33fd0f1c66c2af7451f856771`
   Evidence: contract source `contracts/openapi-v3.json` has no generated zone entry — handwritten drift is likely
66. `medium` `data` `db/`
   Rule: `HLT-006-DIRECT-DB-WRONG-LAYER`
   Check: `HLT-006-DIRECT-DB-WRONG-LAYER:data` `soft` confidence `0.76`
   Route: TLR `Contracts/data`, lane `db`, owner `db`
   Docs: `docs/audit-rubric.md#required-shape`
   Reason: `Data truth and workflow safety` scored 65 below the standard floor of 85
   Fix: move durable truth into migrations, constraints, adapters, and application-owned transactions
   Rerun: `just fast`
   Fingerprint: `sha256:591bd7a90e2a3a23d1ed43a03d858c0acee6bc9208e81c196c2336fc5a3f82c1`
   Evidence: database surface present, migration directory present, constraint or RLS language found, strict DB boundary violation: src/components/admin/UserDetailDrawer.tsx
67. `high` `boundary` `functions/api/SessionRoom.ts:126`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:a55b96f41e7a6fa3a7c78cc7bccfcc5298fe6f8bc509979c3d689d6eb663f8e6`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/SessionRoom.ts, line=126, snippet=// caller's `stub.fetch()` — which the REST layer can only surface as an
68. `high` `boundary` `functions/api/lib/agent-audit.ts:113`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:641bc9b70ee1704bc2adaf4ed90f5664ad204541e6548c85aebd79cf6c2aa352`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/agent-audit.ts, line=113, snippet=action: params.action as AuditAction,
69. `high` `boundary` `functions/api/lib/ai-wizard.ts:349`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:8b37e84470f5a0edc256153f0d2891be0aaeeea40d800fd24490c7ac00f2415f`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/ai-wizard.ts, line=349, snippet=const parsed = JSON.parse(payload) as { response?: unknown }
70. `high` `boundary` `functions/api/lib/ai/ai-gateway.ts:123`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:3bd027e915dfbf856e51145e5499c228236ca7e9be719b4670041a69aa690038`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/ai/ai-gateway.ts, line=123, snippet=const data = (await response.json()) as {
71. `high` `security` `functions/api/lib/audit.ts:263`
   Rule: `HLT-023-INPUT-BOUNDARY-GAP`
   Check: `HLT-023-INPUT-BOUNDARY-GAP:security` `hard` confidence `0.88`
   Route: TLR `Security, secrets, agency`, lane `security`, owner `tools`
   Docs: `docs/audit-rubric.md#top-level-risk-mapping`
   Matched term: `string sql`
   Reason: input handling risk needs deterministic negative tests
   Fix: replace unsafe sinks with typed schemas, parameterized APIs, allowlists, or sandboxed execution plus negative tests
   Rerun: `just security`
   Fingerprint: `sha256:500a1d41eede5956b6e33760936790db69a2960f1ea8585091218ebcb8428da0`
   Evidence: * COUNT and SELECT reuse the same fragment + bind order; LIMIT/OFFSET are appended separately (never via string replace).
72. `high` `boundary` `functions/api/lib/audit.ts:340`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:392a24b81ee39eed6e19f8e14f8184d0bf3135d681a95d9edb69e143eb1b6eb0`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/audit.ts, line=340, snippet=console.error('[audit] queryAuditEvents failed:', (err as Error).message)
73. `high` `boundary` `functions/api/lib/boundary-decode.ts:4`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:32de33788d2bce1eb4fb8cd7e006c2c531173833a3cf3c504feb7e833e0ccf8c`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/boundary-decode.ts, line=4, snippet=* Every KV read or external JSON parse that previously used `JSON.parse(x) as T`
74. `high` `boundary` `functions/api/lib/connect-invite.ts:144`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:9aa00e1b82b874d64503c79651ca384b5db16992c287890e5d4078b9385ca037`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/connect-invite.ts, line=144, snippet=claims = JSON.parse(textDecoder.decode(base64UrlDecode(payload))) as FederationInviteClaims
75. `high` `vibe` `functions/api/lib/copilot-suggest.ts:207`
   Rule: `HLT-001-DEAD-MARKER`
   Check: `HLT-001-DEAD-MARKER:vibe` `hard` confidence `0.88`
   Route: TLR `Entropy`, lane `fast`, owner `tools`
   Docs: `docs/audit-rubric.md#future-hostile-language-rule`
   Reason: fallback soup detected in product code
   Fix: collapse fallback chains into explicit typed states with bounded retry policy, telemetry, and documented repair guidance
   Rerun: `just fast`
   Fingerprint: `sha256:e4873ae89849280b68fc0c7b2fa69cb21cdf785d1ec6c4fd60562a3f702064c3`
   Evidence: functions/api/lib/copilot-suggest.ts:207 if (!json) return null
76. `high` `boundary` `functions/api/lib/embed-token.ts:118`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:a03993fe54aea5c63266b990c310cc07a34953951c7d57067347f67e6e753659`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/embed-token.ts, line=118, snippet=claims = JSON.parse(json) as EmbedWidgetTokenClaims
77. `high` `vibe` `functions/api/lib/event-workspace.ts:65`
   Rule: `HLT-001-DEAD-MARKER`
   Check: `HLT-001-DEAD-MARKER:vibe` `hard` confidence `0.88`
   Route: TLR `Entropy`, lane `fast`, owner `tools`
   Docs: `docs/audit-rubric.md#future-hostile-language-rule`
   Reason: product code contains TODO/stub/unimplemented/unreachable placeholder markers
   Fix: replace placeholders with implemented behavior, typed unsupported-state errors, or a tracked exception record with docs
   Rerun: `just fast`
   Fingerprint: `sha256:0fc7c2199fbeff8925531906fa47a0fe9ce2bab99d7a551acd237a522cfea476`
   Evidence: functions/api/lib/event-workspace.ts:65 const room = env.SESSION_ROOM.get(stub)
78. `high` `boundary` `functions/api/lib/marketing/mention-monitor.ts:85`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:4aac76f7274120d34cec5787296cb7e5f08c5bfaf749535d7d0405827b34696b`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/marketing/mention-monitor.ts, line=85, snippet=const queries = queriesRaw ? (JSON.parse(queriesRaw) as string[]) : reddit.DEFAULT_REDDIT_QUERIES
79. `high` `boundary` `functions/api/lib/marketing/mention-monitor.ts:89`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:08352edec2ed9a3ded30637afc5df165ecf40a94475c86928804d585f2db0ffd`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/marketing/mention-monitor.ts, line=89, snippet=const queries = queriesRaw ? (JSON.parse(queriesRaw) as string[]) : youtube.DEFAULT_YOUTUBE_QUERIES
80. `high` `boundary` `functions/api/lib/marketing/publisher.ts:150`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:64bd498f661f50280ab0762c7873bcb0f1d18e20a892210f914c4ac16dca464b`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/marketing/publisher.ts, line=150, snippet=const metadata = JSON.parse(row.metadata) as YouTubeMetadata
81. `high` `boundary` `functions/api/lib/marketing/video-assets.ts:40`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:5b77fb691180fc40e9a38642eb1ae5e24ebaaa709ff81dcb4ed2e09955b7f52b`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/marketing/video-assets.ts, line=40, snippet=return (JSON.parse(r.tags) as string[]).includes(filter.tag!)
82. `high` `boundary` `functions/api/lib/marketing/video-assets.ts:110`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:188a90ba9e56dfd4f848c92c8ca310fed556ad1d20eae00a01199e49a565137a`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/marketing/video-assets.ts, line=110, snippet=payload = JSON.parse(atob(payloadB64)) as PreviewTokenPayload
83. `high` `boundary` `functions/api/lib/marketing/video-gen.ts:100`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.suppress.ts-nocheck`
   Reason: broad suppression is hard to audit
   Fix: remove the broad suppression or scope it to a single justified line
   Rerun: `just fast`
   Fingerprint: `sha256:7b3798d28249d461d4ca28ca5083af35d802425713ad48d1138c51bbf68515ee`
   Evidence: detector=typescript.suppress.ts-nocheck, path=functions/api/lib/marketing/video-gen.ts, line=100, snippet=// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party models aren't in AiModelList; batch status shape is undocumented
84. `high` `boundary` `functions/api/lib/marketing/video-gen.ts:110`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:daee42ce991b5d976407c376255b5773bbcbcdad00b30717870a8cf00667a8c9`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/marketing/video-gen.ts, line=110, snippet=const job = JSON.parse(raw) as VideoGenJob
85. `high` `boundary` `functions/api/lib/pulse-aggregation.ts:268`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:5b8b51cddcf419f2bdc3cb19e1a16cea33b6976143d1b111403baf7f36e26e62`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/pulse-aggregation.ts, line=268, snippet=const parsed = JSON.parse(payloadJson) as { questionCount?: number }
86. `high` `boundary` `functions/api/lib/workflows/session-pipeline.ts:55`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:436f9fc1fa322c86bab1417f0bec569b65c11e447023b2ef0f6da891746f7945`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/workflows/session-pipeline.ts, line=55, snippet=const classification = await classify(scannedQuestions, input.language as Lang, env)
87. `high` `boundary` `functions/api/lib/workflows/session-pipeline.ts:58`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:a6dcbc85063b3bfc558e22c7339caba0e07847bcc994bcb0d5137b685ce93a22`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/workflows/session-pipeline.ts, line=58, snippet=const template = buildTemplateRecord(input, scannedQuestions, classification, input.language as Lang)
88. `high` `boundary` `functions/api/lib/workflows/session-pipeline.ts:80`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:c070347aba012b89615da7ded0a4f158f5d1b49f8da19f53a1b382e32da70e13`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/lib/workflows/session-pipeline.ts, line=80, snippet=const raw = await runAI(env as Env, model, input)
89. `high` `boundary` `functions/api/repositories/kbVectorRepository.ts:12`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:035c4ef2c5b75485a9542d2cb276d9d1e9cf6d529f6a36f4a4bcbb4eaafe1933`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/repositories/kbVectorRepository.ts, line=12, snippet=//     Vectorize as parametric `filter` — never concatenated into a query.
90. `high` `boundary` `functions/api/routes/ai-insights/register-analyze.ts:97`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:4c757731159bd3e3c6c580fa8bc4941b842fb66895995b3c0ed5f9881b177341`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/routes/ai-insights/register-analyze.ts, line=97, snippet=logEvent({ event: 'vectorize.query.skip', reason: (vecErr as Error).message })
91. `high` `boundary` `functions/api/routes/captions.ts:35`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:29b98a04e76e7f940b14c90c84860b8febe1d00cfc396014fe725a0499e147c3`
   Evidence: detector=typescript.types.any-boundary, path=functions/api/routes/captions.ts, line=35, snippet=// Segment metadata travels as query params (the body is the raw audio chunk).
92. `high` `data` `migrations/0057_add_reaction_question_kind.sql:24`
   Rule: `HLT-030-SQL-BAD-BEHAVIOR`
   Check: `HLT-030-SQL-BAD-BEHAVIOR:data` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `db`, owner `db`
   Docs: `docs/BAD_SQL.md`
   Matched term: `drop table`
   Reason: comment-only markers are not proof for destructive schema or data removal
   Fix: add same-stem or same-directory migration metadata plus verify/check evidence
   Rerun: `just fast`
   Fingerprint: `sha256:302de7c71d836c0118138fb0450ec06154b839cbb44a786a14a645d1cd2af1a7`
   Evidence: detector=sql.migration.destructive-no-proof, proof-window=structured-metadata, snippet=DROP TABLE questions
93. `high` `data` `migrations/0057_add_reaction_question_kind.sql:24`
   Rule: `HLT-021-DESTRUCTIVE-MIGRATION`
   Check: `HLT-021-DESTRUCTIVE-MIGRATION:data` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `db-migration-analyze`, owner `db`
   Docs: `docs/BAD_MIGRATION.md`
   Reason: destructive migration lacks documented safety evidence
   Fix: add same-stem or same-directory migration metadata with owner/approval, rollback or roll-forward, backup/restore or irreversible approval, lock/timeout posture, and verify/check evidence; comments such as `jankurai:migration-safe` are not sufficient
   Rerun: `cargo run -p jankurai -- migrate . --analyze --json target/jankurai/migration-report.json`
   Fingerprint: `sha256:4072611c636d871e2dcd1ebe7ff0e7988b035ad6217e7af07dc5e3c6f7490fb5`
   Evidence: drop ddl: DROP TABLE questions;
94. `high` `agent` `ops/git-hooks/lib.sh:173`
   Rule: `HLT-035-GIT-BAD-BEHAVIOR`
   Check: `HLT-035-GIT-BAD-BEHAVIOR:agent` `hard` confidence `0.95`
   Route: TLR `Context/setup`, lane `audit`, owner `ops`
   Docs: `docs/testing.md`
   Matched term: `git.remote.force-mutation`
   Reason: remote mutation can overwrite shared branch history
   Fix: replace the force push with a reviewed fast-forward or a dedicated release branch
   Rerun: `just score`
   Fingerprint: `sha256:4947c9b8bb6a0726dbd965ef0f71c6b2274179c6a924946a777f14ece21680f1`
   Evidence: detector=git.remote.force-mutation, path=ops/git-hooks/lib.sh, line=173, proof_window=None, snippet=echo "   Re-run full quality gates after push: QESTO_PREPUSH_MODE=full git push --force-with-lease" >&2
95. `high` `stack` `packages/sdk-js/index.js`
   Check: `HLT-000-SCORE-DIMENSION:stack` `hard` confidence `0.88`
   Route: TLR `Context/setup`, lane `audit`, owner `unmapped`
   Reason: runtime code uses a language outside the chosen optimal stack
   Fix: move product runtime behavior to Rust core, TypeScript web, SQL migrations, or generated contracts; Python needs a dated advanced-ML/data exception
   Rerun: `just score`
   Fingerprint: `sha256:606e0daaf55cf77913868e844b05c1d9c7fcd46d4a00d1a02b27ece4cb20549d`
   Evidence: packages/sdk-js/index.js uses `.js`, Rust core + TypeScript/React/Vite + PostgreSQL + generated contracts + exception-only Python AI/data service
96. `medium` `context` `scripts/copy-marketing-videos.mjs:1`
   Rule: `HLT-040-REPO-ROT-BAD-BEHAVIOR`
   Check: `HLT-040-REPO-ROT-BAD-BEHAVIOR:context` `soft` confidence `0.88`
   Route: TLR `Context/setup`, lane `audit`, owner `agent`
   Docs: `docs/language-bad-behavior.md#web-security-and-repo-rot-detectors`
   Matched term: `repo-rot.path.fake-versioned-source`
   Reason: ambiguous old-looking active source makes agents and reviewers guess whether code is live
   Fix: delete the stale copy, move history to VCS/archive tooling, or document owner, proof lane, expiry, and migration plan
   Rerun: `just score`
   Fingerprint: `sha256:a989f86cd70d8b9613dfc28b0ebf0e25d34b19f7cc1b2a0ff28bcdf9d756f057`
   Evidence: detector=repo-rot.path.fake-versioned-source, path=scripts/copy-marketing-videos.mjs, line=1, proof_window=None, snippet=#!/usr/bin/env node
97. `high` `agent` `scripts/create-sprint-56-60-branches.ps1:40`
   Rule: `HLT-035-GIT-BAD-BEHAVIOR`
   Check: `HLT-035-GIT-BAD-BEHAVIOR:agent` `hard` confidence `0.95`
   Route: TLR `Context/setup`, lane `audit`, owner `agent`
   Docs: `docs/testing.md`
   Matched term: `git.stage.unbounded`
   Reason: automation commits broad untracked state or bypasses verification
   Fix: enumerate the exact paths and keep verification on
   Rerun: `just score`
   Fingerprint: `sha256:371f815845345de365f96afd548d23a62a646e76f964d52edf57aeab5a698fcd`
   Evidence: detector=git.stage.unbounded, path=scripts/create-sprint-56-60-branches.ps1, line=40, proof_window=None, snippet=git add -A
98. `high` `boundary` `scripts/embed-kb.ts:294`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:e6fe7633f5935fbc144cbdeb13dde3e8ef2725b645e282cacadde509cd072816`
   Evidence: detector=typescript.types.any-boundary, path=scripts/embed-kb.ts, line=294, snippet=const result = (await response.json()) as { result?: { data?: number[][] } }
99. `high` `boundary` `scripts/kb-health.ts:113`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:1b975b943010cfe7f776b4bc671f2367a157f24de412a1c3bc0eff522cb849ab`
   Evidence: detector=typescript.types.any-boundary, path=scripts/kb-health.ts, line=113, snippet=fetch(base, { headers }).then((r) => r.json() as Promise<any>),
100. `high` `boundary` `scripts/kb-health.ts:114`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:7f26d1e449a27dac34b21620d4e23521336b368ed4d670e98363ef222ceea6b9`
   Evidence: detector=typescript.types.any-boundary, path=scripts/kb-health.ts, line=114, snippet=fetch(`${base}/info`, { headers }).then((r) => r.json() as Promise<any>),
101. `high` `boundary` `scripts/kb-sync-cli.ts:191`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:114ad61da45dbb69f03aed63949ca88097fd09e94de2608e5be2422381c0939f`
   Evidence: detector=typescript.types.any-boundary, path=scripts/kb-sync-cli.ts, line=191, snippet=const data = (await response.json()) as { data?: { vectors_upserted?: number } };
102. `high` `boundary` `scripts/kb-sync-cli.ts:293`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:41ecbea2a5638880c0a8f548ffccb4c8adf50605dabc8aa923dba983f205137f`
   Evidence: detector=typescript.types.any-boundary, path=scripts/kb-sync-cli.ts, line=293, snippet=const data = (await response.json()) as { data?: { vectors_deleted?: number } };
103. `high` `agent` `scripts/rebuild-sprint-50-55-branches.ps1:81`
   Rule: `HLT-035-GIT-BAD-BEHAVIOR`
   Check: `HLT-035-GIT-BAD-BEHAVIOR:agent` `hard` confidence `0.95`
   Route: TLR `Context/setup`, lane `audit`, owner `agent`
   Docs: `docs/testing.md`
   Matched term: `git.stage.unbounded`
   Reason: automation commits broad untracked state or bypasses verification
   Fix: enumerate the exact paths and keep verification on
   Rerun: `just score`
   Fingerprint: `sha256:21f11428ba02a6815623c377177c3e85620d1bb45b65192b8a81e1edf250f840`
   Evidence: detector=git.stage.unbounded, path=scripts/rebuild-sprint-50-55-branches.ps1, line=81, proof_window=None, snippet=git add -A
104. `medium` `context` `scripts/smoke-platform-v7.mjs:1`
   Rule: `HLT-040-REPO-ROT-BAD-BEHAVIOR`
   Check: `HLT-040-REPO-ROT-BAD-BEHAVIOR:context` `soft` confidence `0.88`
   Route: TLR `Context/setup`, lane `audit`, owner `agent`
   Docs: `docs/language-bad-behavior.md#web-security-and-repo-rot-detectors`
   Matched term: `repo-rot.path.fake-versioned-source`
   Reason: ambiguous old-looking active source makes agents and reviewers guess whether code is live
   Fix: delete the stale copy, move history to VCS/archive tooling, or document owner, proof lane, expiry, and migration plan
   Rerun: `just score`
   Fingerprint: `sha256:1e43454a534fef64a00437813fb50014dc1fa1444d7bbf78b5ee5261b7eabdef`
   Evidence: detector=repo-rot.path.fake-versioned-source, path=scripts/smoke-platform-v7.mjs, line=1, proof_window=None, snippet=#!/usr/bin/env node
105. `medium` `context` `scripts/smoke-platform-v7.sh:1`
   Rule: `HLT-040-REPO-ROT-BAD-BEHAVIOR`
   Check: `HLT-040-REPO-ROT-BAD-BEHAVIOR:context` `soft` confidence `0.88`
   Route: TLR `Context/setup`, lane `audit`, owner `agent`
   Docs: `docs/language-bad-behavior.md#web-security-and-repo-rot-detectors`
   Matched term: `repo-rot.path.fake-versioned-source`
   Reason: ambiguous old-looking active source makes agents and reviewers guess whether code is live
   Fix: delete the stale copy, move history to VCS/archive tooling, or document owner, proof lane, expiry, and migration plan
   Rerun: `just score`
   Fingerprint: `sha256:03bb112950edabb047a5649961c85b1f621abea125945b65fedd580e0b0c3e17`
   Evidence: detector=repo-rot.path.fake-versioned-source, path=scripts/smoke-platform-v7.sh, line=1, proof_window=None, snippet=#!/usr/bin/env bash
106. `high` `boundary` `scripts/sync-help-docs.ts:80`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:6d46921dcbc330d27115e3251da757c7fac4e3f4d552a3ea7c6eb084cfb9e0fb`
   Evidence: detector=typescript.types.any-boundary, path=scripts/sync-help-docs.ts, line=80, snippet=const docs = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8')) as HelpChunk[]
107. `high` `boundary` `src/components/CaptionsLocalePicker.tsx:72`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.suppress.ts-nocheck`
   Reason: broad suppression is hard to audit
   Fix: remove the broad suppression or scope it to a single justified line
   Rerun: `just fast`
   Fingerprint: `sha256:0e152c81c04256a131b26556368695068b759da56d3470174b374c3d56218979`
   Evidence: detector=typescript.suppress.ts-nocheck, path=src/components/CaptionsLocalePicker.tsx, line=72, snippet=// eslint-disable-next-line react-hooks/exhaustive-deps
108. `high` `data` `src/components/admin/UserDetailDrawer.tsx:1`
   Rule: `HLT-006-DIRECT-DB-WRONG-LAYER`
   Check: `HLT-006-DIRECT-DB-WRONG-LAYER:data` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `db`, owner `tools`
   Docs: `docs/audit-rubric.md#required-shape`
   Reason: direct database access appears in a wrong layer
   Fix: move SQL and DB clients to `crates/adapters` or `db/`; expose typed application/domain APIs upward
   Rerun: `just fast`
   Fingerprint: `sha256:d70660ac2a8342b700be15bc7c502e61f61b417f4ae18fe52c18bafaca7e1e0e`
   Evidence: DB marker in non-adapter layer
109. `high` `boundary` `src/components/marketing/VideoLibraryTab.tsx:143`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:ad3b29b7e8c3f3e1ef7898ce1d39104ff10a1b28f90c290ed5b668f9de3178a8`
   Evidence: detector=typescript.types.any-boundary, path=src/components/marketing/VideoLibraryTab.tsx, line=143, snippet=tags = JSON.parse(asset.tags) as string[]
110. `high` `boundary` `src/hooks/useCountUp.ts:63`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.suppress.ts-nocheck`
   Reason: broad suppression is hard to audit
   Fix: remove the broad suppression or scope it to a single justified line
   Rerun: `just fast`
   Fingerprint: `sha256:690463e2efe1120a8475e5e9ad7d37a33649298fd2731889496257dc52a39f65`
   Evidence: detector=typescript.suppress.ts-nocheck, path=src/hooks/useCountUp.ts, line=63, snippet=// eslint-disable-next-line react-hooks/exhaustive-deps
111. `high` `boundary` `src/hooks/useMarketingApi.ts:86`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:144cca28cb543da7b5d804dc24fffdc256a84947c02cce0470a2bcc1ab10be77`
   Evidence: detector=typescript.types.any-boundary, path=src/hooks/useMarketingApi.ts, line=86, snippet=return `?${new URLSearchParams(entries as [string, string][]).toString()}`
112. `high` `boundary` `src/pages/EmbedWidget.tsx:117`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.types.any-boundary`
   Reason: value shape is not proven before the cast
   Fix: validate the value first, then narrow it with a proof-aware decoder
   Rerun: `just fast`
   Fingerprint: `sha256:2d0351bd47db267b4838d0ad97225407a47f3f8dec747bbb9499d6887954a71f`
   Evidence: detector=typescript.types.any-boundary, path=src/pages/EmbedWidget.tsx, line=117, snippet=const themeParam = (searchParams.get('theme') ?? 'light') as 'light' | 'dark'
113. `high` `boundary` `src/pages/EmbedWidget.tsx:238`
   Rule: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR`
   Check: `HLT-031-TYPESCRIPT-BAD-BEHAVIOR:boundary` `hard` confidence `0.95`
   Route: TLR `Contracts/data`, lane `fast`, owner `tools`
   Docs: `docs/testing.md`
   Matched term: `typescript.suppress.ts-nocheck`
   Reason: broad suppression is hard to audit
   Fix: remove the broad suppression or scope it to a single justified line
   Rerun: `just fast`
   Fingerprint: `sha256:06ca5496adccad8aa599fc433c80bba7cb2130c451d0075a4532976691225240`
   Evidence: detector=typescript.suppress.ts-nocheck, path=src/pages/EmbedWidget.tsx, line=238, snippet=// eslint-disable-next-line react-hooks/exhaustive-deps
114. `high` `vibe` `src/pages/Privacy.tsx:107`
   Rule: `HLT-001-DEAD-MARKER`
   Check: `HLT-001-DEAD-MARKER:vibe` `hard` confidence `0.88`
   Route: TLR `Entropy`, lane `fast`, owner `tools`
   Docs: `docs/audit-rubric.md#future-hostile-language-rule`
   Reason: future-hostile/dead-language term `old` appears in product/runtime code
   Fix: remove or rename the marker, implement the intended behavior, model a typed unsupported state, or move docs/generated/vendor/product-copy text into an allowlisted context
   Rerun: `just fast`
   Fingerprint: `sha256:09a0beccfdbe2c14be5d7406df936b77ff5fa70d75820586b7fb0cb38fd67e95`
   Evidence: src/pages/Privacy.tsx:107, future-hostile/dead-language term `old` appears

## Policy

- Policy file: `./agent/audit-policy.toml`
- Minimum score: `85`
- Fail on: `critical, high`

## Agent Fix Queue

1. `high` `HLT-007-HANDWRITTEN-CONTRACT` `contracts/openapi-v3.json` - add a `[[zone]]` in `agent/generated-zones.toml` with `source`, `command`, and `path` for this contract, or generate typed clients from it
   Route: `Contracts/data`/`contract`
2. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/SessionRoom.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
3. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/agent-audit.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
4. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/ai-wizard.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
5. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/ai/ai-gateway.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
6. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/audit.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
7. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/boundary-decode.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
8. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/connect-invite.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
9. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/embed-token.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
10. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/marketing/mention-monitor.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
11. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/marketing/publisher.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
12. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/marketing/video-assets.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
13. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/marketing/video-gen.ts` - remove the broad suppression or scope it to a single justified line
   Route: `Contracts/data`/`fast`
14. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/marketing/video-gen.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
15. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/pulse-aggregation.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
16. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/lib/workflows/session-pipeline.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
17. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/repositories/kbVectorRepository.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
18. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/routes/ai-insights/register-analyze.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
19. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `functions/api/routes/captions.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
20. `high` `HLT-030-SQL-BAD-BEHAVIOR` `migrations/0057_add_reaction_question_kind.sql` - add same-stem or same-directory migration metadata plus verify/check evidence
   Route: `Contracts/data`/`db`
21. `high` `HLT-021-DESTRUCTIVE-MIGRATION` `migrations/0057_add_reaction_question_kind.sql` - add same-stem or same-directory migration metadata with owner/approval, rollback or roll-forward, backup/restore or irreversible approval, lock/timeout posture, and verify/check evidence; comments such as `jankurai:migration-safe` are not sufficient
   Route: `Contracts/data`/`db-migration-analyze`
22. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `scripts/embed-kb.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
23. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `scripts/kb-health.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
24. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `scripts/kb-sync-cli.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
25. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `scripts/sync-help-docs.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
26. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `src/components/CaptionsLocalePicker.tsx` - remove the broad suppression or scope it to a single justified line
   Route: `Contracts/data`/`fast`
27. `high` `HLT-006-DIRECT-DB-WRONG-LAYER` `src/components/admin/UserDetailDrawer.tsx` - move SQL and DB clients to `crates/adapters` or `db/`; expose typed application/domain APIs upward
   Route: `Contracts/data`/`db`
28. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `src/components/marketing/VideoLibraryTab.tsx` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
29. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `src/hooks/useCountUp.ts` - remove the broad suppression or scope it to a single justified line
   Route: `Contracts/data`/`fast`
30. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `src/hooks/useMarketingApi.ts` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
31. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `src/pages/EmbedWidget.tsx` - validate the value first, then narrow it with a proof-aware decoder
   Route: `Contracts/data`/`fast`
32. `high` `HLT-031-TYPESCRIPT-BAD-BEHAVIOR` `src/pages/EmbedWidget.tsx` - remove the broad suppression or scope it to a single justified line
   Route: `Contracts/data`/`fast`
33. `medium` `HLT-007-HANDWRITTEN-CONTRACT` `agent/boundaries.toml` - add generated contracts and boundary checks for public APIs, data access, and cross-runtime seams
   Route: `Contracts/data`/`contract`
34. `medium` `HLT-006-DIRECT-DB-WRONG-LAYER` `db/` - move durable truth into migrations, constraints, adapters, and application-owned transactions
   Route: `Contracts/data`/`db`
35. `high` `HLT-042-CI-LOCAL-PARITY` `.github/workflows/copilot-setup-steps.yml` - extract the workflow steps into ops/ci/<lane>.sh and call them with `bash ops/ci/<lane>.sh`
   Route: `Verification`/`fast`
36. `high` `HLT-042-CI-LOCAL-PARITY` `.github/workflows/daily-repo-status.lock.yml` - extract the workflow steps into ops/ci/<lane>.sh and call them with `bash ops/ci/<lane>.sh`
   Route: `Verification`/`fast`
37. `high` `HLT-042-CI-LOCAL-PARITY` `.github/workflows/playwright.yml` - extract the workflow steps into ops/ci/<lane>.sh and call them with `bash ops/ci/<lane>.sh`
   Route: `Verification`/`fast`
38. `high` `HLT-042-CI-LOCAL-PARITY` `.github/workflows/vectorize-health.yml` - extract the workflow steps into ops/ci/<lane>.sh and call them with `bash ops/ci/<lane>.sh`
   Route: `Verification`/`fast`
39. `high` `HLT-004-UNMAPPED-PROOF` `agent/test-map.json` - add the narrowest stable prefix and runnable proof command to `agent/test-map.json`
   Route: `Verification`/`fast`
40. `medium` `HLT-018-PERF-CONCURRENCY-DRIFT` `Justfile` - add fast deterministic build/test targets, caches, and narrow proof lanes for agent iteration
   Route: `Verification`/`fast`
41. `medium` `HLT-027-HUMAN-REVIEW-EVIDENCE-GAP` `.claude/agents/seo-reviewer-agent.md` - attach raw CI logs, review receipts, and replayable commands instead of accepting claims or summaries
   Route: `Repair`/`audit`
42. `high` `HLT-035-GIT-BAD-BEHAVIOR` `.claude/hooks/pre-bash.sh` - enumerate the exact paths and keep verification on
   Route: `Context/setup`/`audit`
43. `high` `HLT-035-GIT-BAD-BEHAVIOR` `.claude/hooks/pre-bash.sh` - replace the destructive reset with a targeted checkout or explicit path list
   Route: `Context/setup`/`audit`
44. `high` `HLT-035-GIT-BAD-BEHAVIOR` `.github/workflows/daily-repo-status.lock.yml` - move credentials out of the URL and use a token helper or credential store
   Route: `Context/setup`/`audit`
45. `high` `HLT-003-OWNERLESS-PATH` `agent/owner-map.json` - add the narrowest stable prefix for this path to `agent/owner-map.json`
   Route: `Context/setup`/`fast`
46. `high` `HLT-035-GIT-BAD-BEHAVIOR` `ops/git-hooks/lib.sh` - replace the force push with a reviewed fast-forward or a dedicated release branch
   Route: `Context/setup`/`audit`
47. `high` `packages/sdk-js/index.js` - move product runtime behavior to Rust core, TypeScript web, SQL migrations, or generated contracts; Python needs a dated advanced-ML/data exception
   Route: `Context/setup`/`audit`
48. `high` `HLT-035-GIT-BAD-BEHAVIOR` `scripts/create-sprint-56-60-branches.ps1` - enumerate the exact paths and keep verification on
   Route: `Context/setup`/`audit`
49. `high` `HLT-035-GIT-BAD-BEHAVIOR` `scripts/rebuild-sprint-50-55-branches.ps1` - enumerate the exact paths and keep verification on
   Route: `Context/setup`/`audit`
50. `medium` `HLT-040-REPO-ROT-BAD-BEHAVIOR` `contracts/openapi-v3.json` - delete the stale copy, move history to VCS/archive tooling, or document owner, proof lane, expiry, and migration plan
   Route: `Context/setup`/`audit`
51. `medium` `HLT-040-REPO-ROT-BAD-BEHAVIOR` `scripts/copy-marketing-videos.mjs` - delete the stale copy, move history to VCS/archive tooling, or document owner, proof lane, expiry, and migration plan
   Route: `Context/setup`/`audit`
52. `medium` `HLT-040-REPO-ROT-BAD-BEHAVIOR` `scripts/smoke-platform-v7.mjs` - delete the stale copy, move history to VCS/archive tooling, or document owner, proof lane, expiry, and migration plan
   Route: `Context/setup`/`audit`
53. `medium` `HLT-040-REPO-ROT-BAD-BEHAVIOR` `scripts/smoke-platform-v7.sh` - delete the stale copy, move history to VCS/archive tooling, or document owner, proof lane, expiry, and migration plan
   Route: `Context/setup`/`audit`
54. `critical` `HLT-010-SECRET-SPRAWL` `agent/baselines/main.repo-score.md` - remove and rotate the credential, add local and CI secret scanning, and scan transcripts/artifacts/MCP config for related exposure
   Route: `Security, secrets, agency`/`security`
55. `high` `HLT-024-AGENT-TOOL-SUPPLY-GAP` `.claude/skills/cso.md` - pin and review agent tools, MCP servers, hooks, and rule files; keep untrusted tool output separate from trusted policy
   Route: `Security, secrets, agency`/`security`
56. `high` `HLT-034-CI-BAD-BEHAVIOR` `.github/workflows/daily-repo-status.lock.yml` - limit the path to build outputs and keep credential files out of caches and artifacts
   Route: `Security, secrets, agency`/`security`
57. `high` `HLT-032-DOCKER-BAD-BEHAVIOR` `.github/workflows/daily-repo-status.lock.yml` - remove the socket mount or isolate the job behind a dedicated daemon boundary
   Route: `Security, secrets, agency`/`security`
58. `high` `HLT-034-CI-BAD-BEHAVIOR` `.github/workflows/daily-repo-status.lock.yml` - never echo secrets; pass them directly to trusted binaries and keep shell tracing off
   Route: `Security, secrets, agency`/`security`
59. `high` `HLT-020-CI-HARDENING-GAP` `.github/workflows/daily-repo-status.lock.yml` - remove the nonblocking override and let the security or proof job fail so the CI gate actually proves the change
   Route: `Security, secrets, agency`/`security`
60. `high` `HLT-034-CI-BAD-BEHAVIOR` `.github/workflows/jankurai.yml` - remove the non-blocking override so scan failures stop the pipeline
   Route: `Security, secrets, agency`/`security`
61. `high` `HLT-023-INPUT-BOUNDARY-GAP` `functions/api/lib/audit.ts` - replace unsafe sinks with typed schemas, parameterized APIs, allowlists, or sandboxed execution plus negative tests
   Route: `Security, secrets, agency`/`security`
62. `high` `HLT-001-DEAD-MARKER` `functions/api/lib/copilot-suggest.ts` - collapse fallback chains into explicit typed states with bounded retry policy, telemetry, and documented repair guidance
   Route: `Entropy`/`fast`
63. `high` `HLT-001-DEAD-MARKER` `functions/api/lib/event-workspace.ts` - replace placeholders with implemented behavior, typed unsupported-state errors, or a tracked exception record with docs
   Route: `Entropy`/`fast`
64. `high` `HLT-001-DEAD-MARKER` `src/pages/Privacy.tsx` - remove or rename the marker, implement the intended behavior, model a typed unsupported state, or move docs/generated/vendor/product-copy text into an allowlisted context
   Route: `Entropy`/`fast`
65. `medium` `HLT-001-DEAD-MARKER` `.` - split large or ambiguous authored code into smaller semantic modules with focused tests
   Route: `Entropy`/`fast`
