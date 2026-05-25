# Branch Audit — 2026-05-25

Audit of all remote branches in `SolarnodeCC/Qesto` against the hard rules in [`CLAUDE.md`](../../../CLAUDE.md):
1. No `ANTHROPIC_API_KEY` (Workers AI only)
2. Secrets never in `wrangler.toml`
3. `npm test` must pass
4. `tsc --noEmit` must pass
5. DRAFT-API for draft, WebSocket for LIVE
6. Documentation in `/knowledge-base/`

## Inventory

29 remote branches.

### Deployed (merged into `main`) — safe to delete

| Branch | Merged via | Notes |
|---|---|---|
| `claude/code-review-production-deploy-xJXAl` | PR #321 | CI gate baseline |
| `cursor/sprint-60-70-master-plan-6de4` | PR #335 | Sprint plan docs |
| `claude/fix-templates-page` | PR #333 | Templates crash + SW fix (squash-merged) |
| `feat/sprint-36-39-v24` | PR #319 | (squash-merged) |
| `feat/sprint-40-enterprise-integrations` | PR #322 | Zoom + Salesforce OAuth |
| `feat/sprint-41-mobile-admin` | PR #323 | PWA + offline votes |
| `feat/sprint-42-compliance-coaching` | PR #324 | (squash-merged) |
| `feat/sprint-43-public-api-v1` | PR #325 | (squash-merged) |
| `feat/sprint-44-v25-rc` | PR #326 | v2.5.0 RC |
| `feat/sprint-45-sdks-partners` | PR #327 | JS + Python SDKs |
| `feat/sprint-46-perf-multiregion` | PR #328 | (squash-merged) |
| `feat/sprint-47-v26-rc` | PR #329 | v2.6 RC |
| `feat/sprint-48-multiregion-api-v2` | PR #330 | (squash-merged) |
| `feat/sprint-49-observability-hardening` | PR #331 | (squash-merged) |
| `feat/sprint-50-v30-rc` | PR #332 | v3.0 RC |

These are safe to delete via the GitHub UI (Settings → Branches or the PR's "Delete branch" button). Not deleted automatically in this audit per user direction.

### Undeployed — need review + PR

| Branch | Files | Tsc errors | Tests | Verdict |
|---|---|---|---|---|
| `feat/sprint-60-v35-moat` (carries 51-59) | 97 | **26** | 851 pass | **BLOCKED on typecheck** |
| `feat/sprint-57-60-v33-v35` | 83 | **12** | 846 pass | **BLOCKED on typecheck + duplicate work** |
| `devops/sprint-60-70-infra-plan` | 2 | 0 (docs only) | n/a | Ready |
| `claude/jankurai-audit-github-actions-AyH3U` | 1 | 0 (CI yaml) | n/a | Ready, with supply-chain note |

### Stale/abandoned PR

- **PR #320**: `main → feat/sprint-36-39-v24`, titled "tst", `mergeable_state: dirty`, 11255 additions across 164 files. Reverse-direction test PR. Recommended to close.

## Findings

### `feat/sprint-60-v35-moat` — BLOCKED

Carries sprints 51-60 stacked: Obsidian KB standard, multi-region writes, LDAP sync, webhook rate limits, partner OAuth/marketplace/branding/SLA, LIVE tournaments, RAG coaching, SOC2 trust page, v3.5 moat doc.

**Pass:**
- No `ANTHROPIC_API_KEY` references in `functions/`, `src/`, `worker/`
- No `wrangler.toml` changes (no secrets added there)
- No hardcoded secrets in non-test code
- All 851 unit tests pass
- 36 new tests added for LDAP sync, multi-region, tournaments, webhook rate limit, etc.
- New docs added under `/knowledge-base/` per rule 6 (ADR-0022, ADR-0023, sprint specs, release notes)

**Fail — hard rule 4 (`tsc --noEmit` must pass):**

26 TypeScript errors across 13 files. Categories:
- `SessionVars` vs `{ trace_id?: string }` incompatibility in `functions/api/routes/sessions/{crud,lifecycle}.ts`, `SessionRoom.ts`, `app.ts` — observability middleware Variables type doesn't extend the auth Variables type.
- `Argument of type 'unknown' is not assignable` in `src/pages/MarketplacePage.tsx:26` and `PartnerSlaPage.tsx:22` — `.then(json => ...)` lacks a runtime type guard.
- `'webhookId' specified more than once` in `functions/api/routes/webhook-admin.ts:46` — object spread collision.
- Type errors in `ldap-sync.ts`, `ldap.ts`, `multi-region-mutation.ts`, `multi-region-admin.ts`, `partner-branding.ts`, `register-coaching.ts`.

**Recommendation:** open as **draft PR**, blocking on typecheck remediation. Do not merge to `main` in current state.

### `feat/sprint-57-60-v33-v35` — BLOCKED + DUPLICATE

Single squash commit ("plannen cursor"), 83 files. Nearly identical surface area to `feat/sprint-60-v35-moat` — same LDAP/multi-region/marketplace/coaching files — but with a different lineage and 12 tsc errors instead of 26.

**Recommendation:** treat as alternative/competing cut. Pick one of `feat/sprint-60-v35-moat` OR `feat/sprint-57-60-v33-v35` and discard the other. Opening both as PRs to `main` would cause irreconcilable conflicts.

### `devops/sprint-60-70-infra-plan` — READY

Two markdown files:
- `knowledge-base/product/backlog/BACKLOG_MASTER.md` (+39 lines, new DEVOPS-S60-S70 story registry)
- `knowledge-base/product/planning/SPRINT60_70_FRONTEND_PROPOSAL.md` (+813 lines, new)

Docs only. No code, no CI changes. Safe to merge.

### `claude/jankurai-audit-github-actions-AyH3U` — READY (with caveat)

`.github/workflows/jankurai.yml` diff:
- Replaces `jeppsontaylor/Jankurai@v0.8.15` with `neverhuman/jankurai@v1.5.1`
- Removes `agent/repo-score.{json,md}` upload paths (presumably no longer produced by the new fork)

**Supply-chain note:** `main` currently uses `jeppsontaylor/Jankurai@v0.8.16` (per merged PR #297). This branch reverts to `.15` and then swaps to a personal fork (`neverhuman/jankurai`). Pin is a version tag, not a SHA — version tags are mutable on GitHub. If the swap is intentional (e.g. upstream was unmaintained), consider SHA-pinning. Otherwise rebasing on top of `main` would lose the dependabot bump.

**Recommendation:** merge if the maintainer swap is intentional. Confirm with whoever proposed the change.

## Production deploy

Production deploys go via Cloudflare Pages — either CI on push to `main` or `wrangler pages deploy` (rule from `CLAUDE.md` "Deployment" section). This audit cannot trigger either from the session. After merging clean PRs, run:

```bash
npm run build
wrangler pages deploy
```

## Recommended actions (in order)

1. Close stale PR #320.
2. Merge `devops/sprint-60-70-infra-plan` → main (docs only).
3. Confirm Jankurai fork swap, then merge `claude/jankurai-audit-github-actions-AyH3U` → main.
4. Choose between `feat/sprint-60-v35-moat` and `feat/sprint-57-60-v33-v35`. Fix typecheck on the chosen one. Then merge.
5. After every merge to `main`: run `npm run build && wrangler pages deploy`.
6. Delete the 15 merged branches via the GitHub UI.
