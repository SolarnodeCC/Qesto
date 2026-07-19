# GitHub Repository & Actions Security Audit — `SolarnodeCC/Qesto`

**Date:** 2026-07-19
**Auditor:** Automated GitHub infrastructure & security review
**Scope:** `.github/workflows/*`, Actions configuration, branch protection, access
control, repository security features, supply-chain posture.
**Repository visibility:** Private (owner has 0 public repos; the daily-status
workflow's `lockdown:false` therefore has no external effect).

---

## 1. Executive Summary

The **workflow layer is strong**: every third-party action is pinned to a full
commit SHA, `GITHUB_TOKEN` permissions are scoped to least privilege on every
job, timeouts and concurrency cancellation are set everywhere, and secrets are
consumed only through `env:`/`secrets.*` (no hardcoded credentials).

The **repository governance layer is the weak point**: `main` has **no branch
protection**, yet a push to `main` **auto-deploys to production** (`qesto.cc`)
with no environment gate or approval. Security scanning (jankurai) runs in
**advisory / non-blocking** mode, so nothing actually blocks a bad merge. These
are the findings to fix first.

**Overall maturity: Level 2–3 of 5 ("Managed, trending to Defined").** CI hygiene
is mature; release governance and enforced gates are not yet in place.

---

## 2. Critical Issues (fix first)

| # | Finding | Why it's critical |
|---|---------|-------------------|
| C1 | **`main` is unprotected** — no required reviews, no required status checks, force-push/delete not blocked. | The single admin (or any automation/token with write) can push straight to `main`. |
| C2 | **Production auto-deploys from an unprotected `main` with no environment gate.** `ci.yml` `build` job runs `wrangler pages deploy` on every push to `main`. | An unreviewed commit reaches `qesto.cc` and purges CDN cache with zero human approval or rollback gate. C1 + C2 compound. |
| C3 | **Security/quality gates are advisory-only.** `jankurai.yml` runs in `--mode advisory` with `continue-on-error: true` on the supply-chain, proofbind, and security lanes; Playwright E2E runs **only on push to `main`, not on PRs**. | Nothing blocks a merge on a regression. The gates produce evidence but have no teeth. |

---

## 3. Findings by Category

### 3.1 GitHub Actions Workflows

#### ✅ Action pinning — GOOD
**Status:** ✅
All third-party actions across all 9 workflows are pinned to 40-char commit
SHAs (`actions/checkout`, `setup-node`, `upload-artifact`, `github-script`,
`slackapi/slack-github-action`, `github/gh-aw`). The generated
`daily-repo-status.lock.yml` is fully pinned as well. This defeats the "moving
tag" supply-chain attack class.

#### ✅ Token permissions — GOOD
**Status:** ✅
Every workflow declares `permissions:` at both workflow and job level, scoped to
least privilege (`contents: read` default; `security-events: write` only on the
audit job; `issues: write` only on the agentic safe-outputs job). The generated
lock file starts from `permissions: {}` and grants per-job. This is textbook.

#### ✅ Secrets handling — GOOD
**Status:** ✅
No hardcoded credentials. All secrets flow through `secrets.*` into `env:`. The
`secrets`-not-allowed-in-`if:` limitation is correctly worked around by mapping
the Slack webhook into job `env` first (kb-sync, help-sync).

#### ⚠️ Production deploy has no environment protection — ATTENTION
**Status:** ⚠️ (see C2)
**Current state:** `ci.yml` `build` job deploys to Cloudflare Pages and purges
cache on push to `main`, gated only by `if: github.ref == 'refs/heads/main'`.
**Recommendation:** Bind the deploy job to a GitHub **Environment** (e.g.
`production`) with a required reviewer and/or wait timer, and move
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ZONE_ID` to
environment secrets so they are only exposed to the gated job.
**Priority:** High · **Effort:** ~1 hr (Settings → Environments + `environment:` key)

#### ⚠️ Advisory-only security gates — ATTENTION
**Status:** ⚠️ (see C3)
**Current state:** `jankurai.yml` runs `--mode advisory`; supply-chain/security
lanes are `continue-on-error: true`. The in-file comment notes the honest score
(~60) is below the aspirational floor (85) and gating is deferred. Issue #612
tracks making the ratchet a required check.
**Recommendation:** (1) Set a realistic ratchet baseline **at the current score**
so *regressions* fail even before reaching 85, and make that lane a required
check. (2) Add the CI + jankurai + Playwright jobs to branch-protection required
checks so they gate PRs.
**Priority:** High · **Effort:** ~half day

#### ⚠️ E2E does not gate PRs — ATTENTION
**Status:** ⚠️
**Current state:** `playwright.yml` triggers only on `push: [main]`. E2E failures
are discovered *after* merge.
**Recommendation:** Add `pull_request: [main]` and make it a required check.
**Priority:** Medium · **Effort:** ~30 min (+ CI-minute cost; the 60-min timeout
is generous — tune it down)

#### ⚠️ CI runs on every branch push — ATTENTION (cost)
**Status:** ⚠️
**Current state:** `ci.yml` and `jankurai.yml` both trigger on `push` to `**` /
alongside `pull_request`, so feature-branch pushes and their PRs run the full
suite twice.
**Recommendation:** Trigger CI on `pull_request` + push to `main` only, or add
`paths-ignore` for docs-only changes. `concurrency … cancel-in-progress: true`
is already set (good) — this is purely a duplicate-run cost optimization.
**Priority:** Low · **Effort:** ~15 min

#### ✅ Timeouts, concurrency, caching, artifacts — GOOD
**Status:** ✅
All jobs set `timeout-minutes`; all workflows use `concurrency` with
`cancel-in-progress`; npm cache is enabled on `setup-node`; artifacts have
explicit `retention-days` (7–30). No unbounded retention.

### 3.2 Access Control

#### ⚠️ Single admin, solo owner — ATTENTION
**Status:** ⚠️
**Current state:** One collaborator (`SolarnodeCC`, admin). This is a solo+AI
project, so two-person review is structurally impossible today.
**Recommendation:** Even solo, require a PR + passing status checks to merge
(protects against direct-to-`main` mistakes and lets bot PRs be gated). Enable
2FA on the owner account and, if this becomes an org, enforce SSO/2FA org-wide.
**Priority:** Medium · **Effort:** low

#### ❌ Branch protection absent — CRITICAL
**Status:** ❌ (see C1)
**Current state:** All 20 branches sampled report `protected: false`; the
jankurai.yml comment on #612 confirms required checks are not yet enforced on
`main`.
**Recommendation:** On `main` enable: require a PR before merge; require status
checks to pass (CI quality-gates, jankurai audit, Playwright) with
"branch up to date"; block force pushes and deletion. Since reviews-from-others
is impossible solo, at minimum require checks + linear history.
**Priority:** High · **Effort:** ~30 min

### 3.3 Secret Management & Incident Handling

#### ⚠️ Open credential-rotation item — ATTENTION
**Status:** ⚠️
**Current state:** `.github/SECURITY_INCIDENT.md` documents a CRITICAL May-2026
JWT exposure (`ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`). Tokens were
removed from the repo, but the rotation steps are still marked "Action Required /
Pending" and the incident is not closed.
**Recommendation:** Confirm both tokens were rotated and the exposed OAuth client
revoked, then close the incident with a dated confirmation. Enable **push
protection** (secret scanning) so a JWT/token pattern is blocked at push time —
the incident's own "Prevention" section calls for this.
**Priority:** High · **Effort:** low (mostly confirmation)

#### ℹ️ Long-lived Cloudflare API token — INFO
**Status:** ⚠️
**Current state:** Deploy and KB-sync use a long-lived `CLOUDFLARE_API_TOKEN`.
Cloudflare doesn't offer GitHub-OIDC federation the way AWS/GCP do, so a scoped
token is acceptable, but it is long-lived.
**Recommendation:** Ensure the token is scoped to the minimum (Pages:Edit, the
specific D1/Vectorize/KV resources, Cache Purge for the one zone), set a rotation
SLA (the incident doc says quarterly), and move it to environment secrets (C2).
**Priority:** Medium · **Effort:** low

### 3.4 Vulnerabilities & Dependencies

#### ✅ Dependabot version updates — GOOD
**Status:** ✅
`dependabot.yml` covers `github-actions` and `npm` weekly, with major-version
npm updates ignored (sensible for a solo maintainer) and a documented lock on
`gh-aw-actions`.

#### ⚠️ No first-party SAST / code scanning (CodeQL) — ATTENTION
**Status:** ⚠️
**Current state:** No CodeQL workflow. jankurai provides custom supply-chain +
security scanning but runs advisory-only (C3). There is no GitHub-native code
scanning writing to the Security tab beyond what jankurai emits via
`security-events: write`.
**Recommendation:** Add the CodeQL starter workflow for JS/TS as a required
check, and separately verify **Dependabot security *alerts*** and **secret
scanning + push protection** are enabled in Settings → Security (Dependabot here
only does *version* updates; alerts are a separate toggle not visible from the
repo files).
**Priority:** Medium · **Effort:** ~1 hr

### 3.5 Repository Configuration & Documentation

#### ⚠️ No SECURITY.md disclosure policy — ATTENTION
**Status:** ⚠️
**Current state:** `.github/SECURITY_INCIDENT.md` is an incident record, not a
disclosure policy. No root/`.github` `SECURITY.md`. `CONTRIBUTING.md` exists only
under `knowledge-base/`.
**Recommendation:** Add `.github/SECURITY.md` with a private reporting channel
(GitHub private vulnerability reporting or a security email) and supported-version
statement.
**Priority:** Medium · **Effort:** ~30 min

#### ⚠️ No CODEOWNERS, PR template, or issue templates — ATTENTION
**Status:** ⚠️
**Current state:** None present. (Given the volume of `cursor[bot]` automated PRs,
templates and ownership would add useful structure.)
**Recommendation:** Add `.github/CODEOWNERS` (routes review to the owner and, once
required-reviews are on, enforces it), a `pull_request_template.md`, and at least
a bug/feature `ISSUE_TEMPLATE`.
**Priority:** Low–Medium · **Effort:** ~1 hr

#### ⚠️ `action-pins.env` drift — ATTENTION (fixed in this PR)
**Status:** ⚠️ → ✅ (corrected here)
**Current state:** `.github/action-pins.env` presents itself as the canonical pin
registry ("update via release tags") but is **referenced by no workflow or
script**, and 3 of its 5 SHAs had drifted from what the workflows actually run:
| Action | `action-pins.env` (stale) | Actual usage / `aw/actions-lock.json` |
|---|---|---|
| `actions/checkout` | `df4cb1c…` (v6) | `9c091bb…` (v7.0.0) |
| `actions/github-script` | `373c709c…` | `3a2844b7…` (v9.0.0) |
| `slackapi/slack-github-action` | `45a88b95…` | `0d95c9a7…` (v3) |
**Impact:** Anyone copying a pin from this file would pin a *different, older*
action version than the repo standard — a real supply-chain foot-gun.
**Recommendation (applied):** Aligned the three stale SHAs to actual usage and
added a note that `.github/aw/actions-lock.json` is the source of truth for the
gh-aw actions. Consider deleting the file if it serves no automation.
**Priority:** Low · **Effort:** done

### 3.6 Agentic Workflows (gh-aw / daily-repo-status)

#### ✅ Generated lock file is well-scoped — GOOD
**Status:** ✅
`daily-repo-status.lock.yml` starts from `permissions: {}`, grants narrow per-job
permissions (`issues: write` only on the safe-outputs job), pins all actions, and
uses `safe-outputs` with `close-older-issues`. `lockdown:false` is safe here
because the repo is private. Keep the source (`.md`) and lock (`.lock.yml`) in
sync via `gh aw compile` (Dependabot is correctly told not to bump the pinned
gh-aw actions).

---

## 4. Prioritized Recommended Actions

**Phase 1 — Governance & gating (do first, ~1 day)**
1. Enable branch protection on `main`: require PR, require status checks
   (CI quality-gates, jankurai audit, Playwright), block force-push/delete. *(C1)*
2. Bind the production deploy to a `production` Environment with a required
   reviewer/wait-timer; move CF secrets to environment scope. *(C2)*
3. Turn jankurai's ratchet on at the current baseline score and make it a
   required check; add `pull_request` trigger to Playwright. *(C3)*

**Phase 2 — Security features & hygiene (~1 day)**
4. Confirm secret scanning + **push protection** and Dependabot **security
   alerts** are enabled in Settings → Security.
5. Close out the May-2026 token-exposure incident with rotation confirmation.
6. Add the CodeQL JS/TS starter workflow as a required check.

**Phase 3 — Documentation & polish (~half day)**
7. Add `.github/SECURITY.md`, `CODEOWNERS`, PR/issue templates.
8. Narrow CI triggers to `pull_request` + push-to-`main`; tune Playwright timeout.
9. ✅ (done) Reconcile `action-pins.env` with actual SHAs, or delete it.

---

## 5. Risk Assessment

| Domain | Rating |
|---|---|
| Workflow supply-chain hygiene (pinning, perms, secrets) | ✅ Strong (Level 4) |
| Release governance (branch protection, deploy gates) | ❌ Weak (Level 1–2) |
| Enforced quality/security gates | ⚠️ Present but advisory (Level 2) |
| Dependency management | ✅ Good version updates; ⚠️ verify alerts (Level 3) |
| Documentation / policy (SECURITY.md, CODEOWNERS) | ⚠️ Partial (Level 2) |
| **Overall** | **Level 2–3 of 5 — Managed, trending to Defined** |

The gap is not in *how workflows are written* (that is mature) but in *what is
enforced*. Closing Phase 1 alone moves the overall posture to a solid Level 3–4:
the mature CI already exists — it just needs to be made mandatory and the
production door needs a lock.

---

## 6. Notes & Assumptions

- Branch-protection, secret-scanning, and Dependabot-alert *enablement* states
  that live only in repository **Settings** (not in tracked files) were inferred
  from tracked signals (all sampled branches `protected:false`; the #612 comment;
  `dependabot.yml` covering version updates only). Verify each in the GitHub UI
  before treating a ✅/⚠️ as final.
- This audit reviewed configuration only; it did not execute the workflows.
