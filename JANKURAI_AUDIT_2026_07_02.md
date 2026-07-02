# Jankurai Full Audit — 2026-07-02

**Standard**: jankurai 0.9.0 · **Auditor**: CLI v1.5.1 (built from `node_modules/jankurai-workspace/crates/jankurai`, the version CI pins)
**Loop executed**: kickoff → adopt (observe) → context-pack → prove → audit (changed-fast) → audit (full advisory) → security → ux → copy-code → witness
**Scope**: full source surface (`src`, `functions`, `worker`, `workers`, `migrations`, `schema.sql`, `tests`, `ops`, `agent`, `.github`, `docs`, `knowledge-base`, `contracts`)

## Verdict

| Receipt | Result |
| --- | --- |
| Canonical advisory score | **60 / 100** (raw 70, 17 hard-rule caps, 217 findings) |
| Accepted baseline (`agent/baselines/main.repo-score.json`) | 93 / 100 |
| Merge witness | **`ratchet_fail`** — score delta **−33** |
| Unit tests (`vitest run`) | **2413 / 2413 passing** (286 files) |
| `npm audit --audit-level=high` | 0 vulnerabilities |

Per the no-proof-no-merge rule, **no PR should be merged against this repo state** until the P0 items below are repaired and a clean witness is produced. All canonical artifacts are under `target/jankurai/` (gitignored by design; regenerate with the commands in each section).

---

## P0 — Root-cause regression: the `justfile` is destroyed

`justfile` is committed with git mode `120000` (symlink) whose *link target is the file's own text content* (introduced in commit `777fc57` "update"). On every fresh clone:

- `just fast / check / test / security / score / ux-qa` all fail with *"failed to read justfile: No such file or directory"* — **every one-command proof lane in `agent/JANKURAI_STANDARD.md` and `agent/test-map.json` is dead**.
- Jankurai's lane detection reads root command files, so the broken justfile cascades into a large share of the 17 caps (`no-one-command-setup-or-validation`, `agent-tool-supply-chain-gap`, `ci-local-parity`, …) and explains most of the 93 → 60 crash. The baseline was produced with the same auditor version, i.e. the justfile was intact then.

**Repair**: recommit `justfile` as a regular blob (mode `100644`) with its content. This single fix should recover the bulk of the score regression. (Advisory mode — not applied; queued in `target/jankurai/repair-queue.jsonl`.)

## P1 — Proof-lane and governance integrity

1. **`functions/` has no owner-map and no test-map route** (proof plan decision: `blocked`). The largest backend surface is unroutable; `agent/owner-map.json` maps `functions/api/` but proof routing needs the `functions` prefix. `workers/` is fully unmapped. `.github` has an owner but no proof route. The repo root itself (`wrangler.toml`, `package.json`, `index.html`, …) has no owner (`HLT-003` / `HLT-004`, 20 findings).
2. **`db` lane is a false proof route**: `agent/test-map.json` maps `migrations/` to `npm test -- --run tests/unit/migrations`, which exits 1 with *"No test files found"* — no migration tests exist at that path.
3. **`doctor` lane is unrunnable as written**: `npx jankurai doctor .` 404s (jankurai is not an npm-registry package and is not a devDependency). It is also not a named lane in `agent/proof-lanes.toml`.
4. **Rendered UX-QA lane cannot run in CI**: `.github/workflows/jankurai.yml` step `ux-qa` invokes `jankurai ux audit --config agent/ux-qa.toml`, which requires `packages/ux-qa/dist/cli.js` — that package does not exist in this repo and `npm ci` never builds it. The `missing-rendered-ux-qa-lane` cap is real, not just detection noise.
5. **Playwright pins `channel: 'chrome'` on all four projects** while `ops/ci/ux-qa.sh` installs *chromium* — the lane only works on GitHub runners because branded Chrome happens to be preinstalled there. 86+ e2e tests cannot run on any machine without Google Chrome (verified: full e2e lane failure in this environment).
6. **Tool/policy version skew**: `agent/audit-policy.toml` and `agent/ux-qa.toml` are authored for jankurai **1.6.10** (schema 1.9.0) while CI pins **v1.5.1**. Verified consequences: the `[dead_language]` allow-list is not honored (132 `HLT-001` findings, mostly allow-listed terms like `placeholder`/`fallback`), and migration-safety markers (`-- jankurai:migration-safe`) are ignored (see False Positives). Either upgrade the pinned CLI or restore 1.5.x-schema policy files.
7. **Generated-zone drift**: `agent/generated-zones.toml` declares `src/ui/tokens.ts` and `src/ui/tailwind-theme.ts`, which do not exist (`HLT-002`, hard ×2). `contracts/openapi-v3.json` is a contract surface with no generated-zone entry (`HLT-007`).
8. **Generated artifacts tracked in git**: `tests/tests/artifacts/playwright-report/index.html` is committed (and the doubly-nested `tests/tests/` path is itself rot). Fake-versioned filenames flagged: `contracts/openapi-v3.json`, `scripts/smoke-platform-v7.{mjs,sh}` (`HLT-040`).

Governance artifacts otherwise present and healthy: `agent/owner-map.json`, `agent/test-map.json`, `agent/generated-zones.toml`, `agent/audit-policy.toml`, `agent/proof-lanes.toml`, `agent/security-policy.toml`, `agent/ux-qa.toml`, `AGENTS.md`, `.pre-commit-config.yaml`, baseline + CI lane — the gap is routing coverage and version coherence, not absence.

## P2 — Code quality

- **Copy-code (hard ×2)**: `design-system/templates/*/support.js` is an exact 1,658-line file duplicated **6×** (≈8,300 redundant lines) and `ds-base.js` duplicated 6×. Also: `session-title.ts` duplicated between `functions/api/lib/` and `src/lib/` (backend/frontend drift risk), and `functions/reddit-auth.ts` / `functions/youtube-auth.ts` share copy-pasted OAuth blocks. 44 classes total — `jankurai copy-code . rank`.
- **Code shape dimension scored 0**: the same design-system template JS files exceed the 500/1000-LOC ceilings; they drag the whole dimension down. Consolidating the 6× `support.js` into one shared module fixes both this and the duplication cap.
- **TypeScript boundary casts** (`HLT-031`, 33 findings): unvalidated `as` casts at I/O boundaries, e.g. `functions/api/lib/ai-wizard.ts:349` (`JSON.parse(payload) as {…}`), `functions/api/lib/ai/ai-gateway.ts:123` (`await response.json() as {…}`). Prefer zod `safeParse` (already the repo pattern elsewhere).
- **Python containment scored 0**: `packages/sdk-python/` sits outside the allowed Python roots for the declared target stack. Either allow-list the SDK path in policy or relocate; today it zeroes a 4-point dimension.
- **Secret-like content (critical per rubric, low real risk)**: `tests/e2e/marketing/demo-data.ts` contains `password: 'DemoShowcase2026!'` — a demo fixture, but it trips the `secret-like-content-detected` cap (60). Move to an env-injected fixture or add a scoped scan exception.
- **PII in `.env.example`**: `VITE_SUPERUSER_EMAIL=oostelaar@hotmail.com` — a real personal address committed and baked into the client bundle (superuser gating hint). Replace with a placeholder domain; keep enforcement server-side (comment says it already is).

## Security — Qesto-specific rules (manual pass, all verified)

| Rule | Status | Evidence |
| --- | --- | --- |
| Stripe webhook verifies signature before mutation | ✅ | `functions/api/routes/billing.ts:155-191` — verify → parse → schema → idempotency → handle |
| Workers AI input sanitized before prompts | ✅ | all calls route through `runThroughAIGateway` (`sanitizeAIGatewayRequest` + assert, `ai-gateway.ts:89-95`); only fallback `env.AI.run` uses the sanitized input |
| KV session tokens / PII have TTL | ✅ | magic-link + marketing sessions use `expirationTtl` (`templates-marketing.ts:131-133`) |
| Vectorize queries validated / bounded | ✅ | `topK` set at all 5 query sites; kbSearchService bounds `topK = limit*3` |
| CORS: no credentialed wildcard | ✅ | `app.ts:130-146` — exact-origin allowlist + pages.dev preview regex; `credentials: true` never paired with `*` |
| No secrets in logs / error responses | ✅ | no `console.*` with secret material found; structured logger; `x-qesto-api-commit` only |
| D1 parameterized statements | ✅ | dynamic `SET ${sets.join()}` clauses use hardcoded column fragments + bound values only |

`jankurai security run .`: npm audit clean; gitleaks/cargo-audit/syft/zizmor skipped (not installed — advisory outside strict mode). The repo's own `ops/ci/secret-scan.sh` + `supply-chain.sh` lanes exist and run in CI.

## UX / a11y

- `jankurai ux audit` could not complete here even after building the runner and serving the app (Playwright 1.59 / available headless-shell rev incompatibility at screenshot time) — but the P1-4 finding stands independent of this environment.
- Manual posture: 278 `aria-label`s, 328 `role`/`aria-live`/`aria-modal` usages, zero alt-less `<img>` in `src/`, dedicated axe a11y Playwright project, route-level code splitting confirmed in the production build (Dashboard etc. in `dist/chunks/`).

## False positives to carry into repair triage (do not "fix")

- `HLT-042` CI-local-parity ×5 (`lib.sh`/pre-push/doctor/runner "missing"): **all referenced files exist** (`ops/ci/lib.sh`, `ops/git-hooks/pre-push`, `scripts/ci-doctor.sh`, `scripts/ci-local.sh`) — detection collapsed with the justfile.
- `HLT-016` "no secret/dependency scanning in CI": `ops/ci/secret-scan.sh`, `supply-chain.sh` and the jankurai security workflow step exist.
- `HLT-021`/`HLT-030` on `migrations/0057`: the `DROP TABLE questions` is the safe SQLite rebuild pattern (create→copy→drop→rename + FK/quick_check verification + `jankurai:migration-safe` marker); the 1.5.1 auditor doesn't parse the marker (version skew, P1-6).
- `HLT-035` git-bad-behavior in `.claude/hooks/pre-bash.sh` / `ops/git-hooks/lib.sh`: the detectors match the very strings these guards *block*.
- `HLT-006` DB-in-wrong-layer on `src/components/admin/UserDetailDrawer.tsx`: no DB marker reproducible in that file.
- `HLT-001` dead-marker bulk: most hits are the policy-allow-listed terms (`placeholder` HTML attribute, DO `stub`, intentional `fallback`) — masked by P1-6.

## Recommended repair order

1. Recommit `justfile` as a regular file (P0) → re-run full audit; expect most caps to clear.
2. Fix policy/CLI version skew (P1-6): pin CI to jankurai ≥1.6.10 **or** downgrade policy schemas.
3. Add owner/test-map routes for `functions/`, `workers/`, repo root, `.github`; point the `db` lane at real tests; make `doctor` a named lane with a runnable command (P1-1..3).
4. Repair generated-zone entries + untrack `tests/tests/artifacts/` (P1-7..8).
5. Decide the rendered UX-QA runner story (vendor `@jankurai/ux-qa` build in CI, or re-point the lane at `ops/ci/ux-qa.sh`) and drop the branded-Chrome pin (P1-4..5).
6. Deduplicate `design-system/templates` support/ds-base modules (P2) — biggest single score lever after the justfile.
7. Then re-baseline `agent/baselines/main.repo-score.json` from a clean advisory run in a dedicated commit.

## Artifact index (local, gitignored — regenerate to inspect)

`target/jankurai/`: `kickoff.{json,md}`, `adoption-plan.{json,md}`, `context-pack.{json,md}`, `proof-plan.{json,md}`, `proof-receipts/` + `logs/` + `evidence-index.json`, `audit-fast.{json,md}`, `audit-timings.json`, `repo-score.{json,md}` (canonical), `score-history.jsonl`, `repair-queue.jsonl` (88 entries), `security/evidence.json`, `copy-code.{json,md}`, `merge-witness.{json,md}`.
