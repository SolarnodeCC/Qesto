# Qesto — Pre-Production Technical Due Diligence

**Engagement type:** External technical & security due diligence
**Date:** 2026-09-15
**Commit under review:** `8eab268` (`main`), audit branch `claude/codebase-technical-audit-4wu6hj`
**Scope:** repository, source code, APIs, GitHub configuration, CI/CD, cloud/edge infrastructure, database, dependencies, supply chain, testing, architecture
**Frameworks applied:** OWASP Top 10 (2021), OWASP ASVS 4.0, NIST SSDF (SP 800-218), NIST SP 800-63B, CIS Benchmarks (GitHub, Software Supply Chain), Twelve-Factor App, SOLID / Clean Code, Clean & Hexagonal Architecture, Well-Architected

**Prior work:** supersedes and extends [`TECHNICAL_AUDIT_2026-09-15.md`](./TECHNICAL_AUDIT_2026-09-15.md). Where this document and that one disagree, this one is authoritative — three findings changed materially under deeper evidence (DD-03, DD-05, DD-19).

---

## Scope statement and limits

**Assessed directly:** 104k LOC of application source (`functions/`, `src/`, `worker/`), 53k LOC of tests, 36 D1 tables, 395 route registrations, 10 GitHub Actions workflows, `wrangler.toml`, all CI shell scripts, the full dependency tree (472 packages), live production `/api/version`, and the GitHub repository state via API (branches, PRs, checks).

**Not applicable — confirmed absent, not overlooked:**

| Requested area | Finding |
|---|---|
| Containers / Docker | No `Dockerfile`, no `docker-compose`. Only use of Docker is pulling the gitleaks image in CI. |
| Kubernetes | None. |
| Terraform / Bicep / IaC | None. Infrastructure is declared in `wrangler.toml` plus **undocumented Cloudflare dashboard state** — see DD-08. |
| GraphQL / gRPC | None. REST only. |
| Traditional IAM / network segmentation | No VPC, no security groups, no IAM roles. Cloudflare Workers is the isolation boundary; tenancy is enforced in application code — see DD-13. |

**Could not verify (no access):** branch-protection *rule detail* (the API exposes `protected: true` on `main` but not which rules), GitHub Environment reviewer configuration, Dependabot security-updates toggle, Cloudflare WAF/zone settings, the Cloudflare Workers Builds build command, and the production secret inventory. Findings that depend on these are marked **Confidence: Medium** and state the assumption.

**Verification performed this engagement:**

```
npx tsc --noEmit                    → exit 0, zero errors
npx vitest run                      → 316 files, 2706 tests, 100% pass, 78.8s
npm audit                           → 15 advisories (1 low, 5 moderate, 9 high)
npm audit --omit=dev                → 1 moderate (hono)
npx madge --circular                → 8 circular dependencies
npx license-checker                 → 472 packages, no license risk
curl https://qesto.cc/api/version   → {"env":"production","commit":"dev"}
git grep <secret patterns>          → no committed secrets
GitHub API: branches, PRs, checks   → 43 branches, 27 open PRs, main protected
```

---

# PART I — FINDINGS

Severity uses CVSS-aligned business framing. Confidence is **High** (directly evidenced in code/config/API output), **Medium** (strong inference, one unverifiable assumption), or **Low** (indicative, needs runtime confirmation).

---

## DD-01 · Security remediation pipeline is deadlocked

| | |
|---|---|
| **Category** | DevSecOps / Supply Chain / Governance |
| **Severity** | **Critical** |
| **Confidence** | **High** |

**Evidence.** The repository has 27 open pull requests. Among them:

| PR | Title | Opened | Age | State |
|---|---|---|---|---|
| #839 | `chore(deps): bump hono from 4.13.1 to 4.13.7` | 2026-08-31 | **15 days** | `blocked` |
| #862 | `chore(deps): bump js-yaml from 4.3.1 to 4.3.2` | 2026-09-13 | 2 days | open |
| #861 | `chore(deps): bump sharp and wrangler` | 2026-09-11 | 4 days | open |
| #836 | `chore(deps): bump axe-core from 4.12.1 to 4.13.0` | 2026-08-31 | 15 days | open |

PR #839 is a **5-line change to 2 files** (`package.json` + lockfile) that closes four upstream GHSAs. Its API state:

```json
{"number":839, "mergeable_state":"blocked", "draft":false,
 "requested_reviewers":["SolarnodeCC"], "additions":5, "deletions":5}
```

`main` reports `"protected": true`. A protected branch requiring review, plus a **single human reviewer who is also the sole maintainer**, produces a structural deadlock: security patches cannot land without the one person, and that person is the bottleneck for 16 Dependabot PRs simultaneously.

**Business impact.** The organisation cannot demonstrate a functioning vulnerability-remediation SLA — a direct finding in SOC 2 CC7.1, ISO 27001 A.8.8 and any enterprise vendor security review. "We use Dependabot" is not a control when the output sits unmerged for two weeks. Mean-time-to-remediate is currently unbounded.

**Technical impact.** Detection works; enforcement and remediation do not. Every dependency finding in this report is *already detected and already fixed upstream* — the value is trapped in the review queue. This will worsen monotonically: each week adds ~4 Dependabot PRs and each stale PR accrues merge conflicts against a moving `main`.

**Exploitation scenario.** No attacker action is required. The exposure window is self-inflicted and grows on its own. An attacker monitoring the public advisory feed knows precisely which versions a target runs (see DD-19: `/api/version` is unauthenticated) and how long the window has been open.

**Recommended fix.** Break the human dependency for low-risk, machine-verifiable updates.

**Example remediation** — auto-merge patch/minor dependency updates once CI is green:

```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot auto-merge
on: pull_request_target        # required: Dependabot PRs run with a read-only token
permissions:
  contents: write
  pull-requests: write
jobs:
  auto-merge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - id: meta
        uses: dependabot/fetch-metadata@08eff52bf64351f401fb50d4972fa95b9f2c2d1b # v2.4.0
        with: { alert-lookup: true }
      # Only patch/minor, and only when the bump closes an advisory or is routine.
      - if: steps.meta.outputs.update-type != 'version-update:semver-major'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`pull_request_target` is required here and is safe **only because this workflow checks out no PR code**. Pair it with a required status check so auto-merge still waits for CI. Then merge the existing backlog oldest-first, starting with #839.

---

## DD-02 · No security gate in CI can fail a build

| | |
|---|---|
| **Category** | DevSecOps / Secure SDLC (NIST SSDF PW.7, PW.8) |
| **Severity** | **Critical** |
| **Confidence** | **High** |

**Evidence.** Every scanner is explicitly neutered.

`ops/ci/supply-chain.sh`:
```bash
npm audit --audit-level=moderate || true                      # cannot fail
docker run ... gitleaks detect --exit-code 0 ... || true       # cannot fail, twice
npm ci --dry-run --silent 2>&1 | grep -q "added 0 packages" && \
  report_success "Package provenance verified" || echo "⚠ Package changes detected"
```

The provenance check is not merely non-blocking, it is **incapable of passing**: a fresh `npm ci --dry-run` always reports *N* added packages, never `added 0 packages`. It has printed the same warning on every run since it was written, and nothing consumes the warning.

`.github/workflows/codeql.yml` — both `init` and `analyze` carry `continue-on-error: true`, with an in-file comment conceding that code scanning on a private repo requires GitHub Advanced Security, which is not enabled. CodeQL therefore produces **no output at all**.

`.github/workflows/jankurai.yml` — `jankurai audit . --mode advisory`, and 6 of 8 lanes carry `continue-on-error: true`.

**Business impact.** The repository presents the *appearance* of a mature DevSecOps programme — SAST, secret scanning, SCA, supply-chain lane — that would satisfy a questionnaire but fails on inspection. In a funding or acquisition diligence this is worse than having no tooling: it reads as a control assertion that does not hold, which calls every other assertion into question.

**Technical impact.** A vulnerable dependency, a committed credential, or an injected sink merges green. There is no automated stop.

**Exploitation scenario.** A contributor (or a compromised bot account — note `cursor[bot]` has write access and has opened 5 PRs) commits a credential or a malicious transitive dependency. gitleaks detects it, prints it, exits 0. CI is green. The change merges and — per DD-08 — deploys to production without any further gate.

**Recommended fix.** Make each lane fail, with explicit, time-boxed exceptions rather than blanket suppression.

**Example remediation:**

```bash
# ops/ci/supply-chain.sh
set -euo pipefail

# Fail on high+; accept documented exceptions with an expiry date.
npm audit --audit-level=high --json > target/security/npm-audit.json || {
  node scripts/audit-allowlist.mjs target/security/npm-audit.json   # exits 1 on un-allowlisted
}

# gitleaks: real exit code, real ignore file.
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest detect \
  --source /repo --redact --exit-code 1 \
  --report-path /repo/target/security/gitleaks.json

# Provenance: verify the lockfile is unchanged by install, which is the actual intent.
npm ci --ignore-scripts
git diff --exit-code package-lock.json
```

Replace CodeQL with Semgrep OSS (works on private repos without a licence) or enable GHAS, then drop `continue-on-error`. Finally, register these as **required status checks** in branch protection — an exit code changes nothing until a rule consumes it.

---

## DD-03 · Anonymous vote identifiers are reversible to client IP

| | |
|---|---|
| **Category** | Privacy / GDPR / Cryptography (OWASP A02:2021) |
| **Severity** | **Critical** |
| **Confidence** | **High** |

**Evidence.** `functions/api/lib/voter.ts:48-55`:

```ts
export async function deriveVoterIdentity(request: Request): Promise<VoterIdentity> {
  const ip = clientIp(request)
  const ipHash = (await sha256Hex(ip)).slice(0, 8)            // 32 bits, no salt
  const fingerprint = (await sha256Hex(fingerprintInput(request))).slice(0, 12)
  return { voterId: `anon_${ipHash}_${fingerprint}`, ipHash, fingerprint }
}
```

That `voterId` is persisted verbatim as `votes.voter_id` for every anonymous vote — `functions/api/lib/session-room-persistence.ts:86`:

```sql
INSERT INTO votes (id, session_id, question_id, voter_id, option_id, submitted_at) VALUES (?,?,?,?,?,?)
```

`schema.sql:176` asserts the opposite of what the code does:
> `author_hash = opaque voterId (sha256(ip || fingerprint)), never PII`

**Technical impact.** The IPv4 space is 2³². An unsalted SHA-256 over a 32-bit input, truncated to 32 bits, is exhaustively invertible — a complete IPv4 → 8-hex-char rainbow table is roughly 4.3 billion hashes, minutes of GPU time and a few GB on disk. The fingerprint adds 48 bits over a *low-entropy* tuple (`user-agent | accept-language | accept-encoding`), whose realistic distinct-value count is in the low millions, not 2⁴⁸. There is no salt, no pepper, no keyed MAC.

`zero_knowledge` — the product's strongest advertised privacy tier — suppresses only sentiment analysis (`session-room-vote-admission.ts:198`), XR avatars (`session-room-xr-handler.ts:71`) and AI insights (`insights-guards.ts:23`). **The vote row itself is written with the reversible identifier in every mode.**

**Business impact.** Under GDPR Recital 26 and EDPB Opinion 05/2014, a reversible hash is pseudonymisation, not anonymisation — the data remains personal data. The product is sold on "Privacy-by-default" with named anonymity modes. The gap between the marketed control and the implemented one is a misrepresentation exposure (Art. 5(1)(a) fairness/transparency, Art. 25 privacy-by-design, Art. 32 security of processing), and it is the single finding most likely to end an enterprise procurement review or trigger a DPA dispute.

**Exploitation scenario.** A works-council confidence vote on a named manager runs in `zero_knowledge` mode. Anyone with read access to D1 — an operator, a support engineer during an incident, a subpoena recipient, or an attacker who obtains a backup — joins `votes.voter_id` against a precomputed IPv4 table and reconstructs, per participant IP, exactly how each person voted. On a corporate network with per-desk static IPs or a small remote team, this is de-anonymisation at the individual level.

**Recommended fix.** Per-session keyed derivation with a destroyable key, and no identifier at all in `zero_knowledge`.

**Example remediation:**

```ts
// functions/api/lib/voter.ts
// Salt is generated in the DO at session start and destroyed at close.
// Destroying it makes every historical voter_id permanently un-invertible.
export async function deriveVoterIdentity(
  request: Request,
  sessionSalt: Uint8Array,          // 32 random bytes, per session
): Promise<VoterIdentity> {
  const key = await crypto.subtle.importKey(
    'raw', sessionSalt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${clientIp(request)}|${fingerprintInput(request)}`),
  )
  const full = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('')
  return { voterId: `anon_${full}`, ipHash: full.slice(0, 16), fingerprint: full.slice(16, 32) }
}
```

```ts
// session-room-persistence.ts — zero_knowledge writes no linkable identifier at all.
const voterIdForDurableRow =
  meta.anonymity === 'zero_knowledge' ? crypto.randomUUID() : v.voterId
```

Dedupe for ZK sessions stays in DO memory (`K_VOTERS`) for the session lifetime only. Then: correct `schema.sql:176`, correct the privacy documentation, and decide the migration for existing rows (see *Strategic Recommendations*).

---

## DD-04 · No multi-factor authentication anywhere in the system

| | |
|---|---|
| **Category** | Authentication (OWASP A07:2021, ASVS V2.8, NIST 800-63B AAL2) |
| **Severity** | **High** |
| **Confidence** | **High** |

**Evidence.** `grep -irl 'totp|mfa|two.factor|authenticator'` over `functions/` and `src/` returns **zero files**. Authentication is magic link, password, or OAuth. Session = HS256 JWT, **14-day TTL** (`routes/auth/constants.ts:3`), in a `SameSite=None` cookie (`routes/auth/cookie.ts`).

The privileges behind that single factor include: platform-admin user management and suspend/restore, audit-log export, **user impersonation** (`middleware/auth.ts:75-88`), SCIM provisioning, Stripe billing, and cross-tenant forensics.

**Business impact.** A hard blocker in essentially every enterprise security questionnaire and a prerequisite for SOC 2 CC6.1. It also caps the addressable market: regulated buyers cannot approve a tool whose admin plane is single-factor.

**Technical impact.** One phished or stuffed password yields 14 days of uninterrupted, non-reauthenticated access to the full admin plane.

**Exploitation scenario.** The maintainer's password appears in an unrelated breach corpus. An attacker authenticates at `/api/auth/password/login` (20 attempts per IP per 15 min — see DD-06, and trivially parallelised across IPs), receives a 14-day cookie, and uses the impersonation endpoint to act as any tenant's owner. Nothing in the system requires a second factor, re-authentication, or notifies the account holder.

**Recommended fix.** TOTP (RFC 6238) for privileged roles; it needs ~80 lines of WebCrypto and no dependency. Shorten the session and add step-up.

**Example remediation:**

```ts
// functions/api/lib/totp.ts — no dependency; HMAC-SHA1 per RFC 6238.
export async function verifyTotp(secretB32: string, code: string, now = Date.now()): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', base32Decode(secretB32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  )
  const step = Math.floor(now / 30_000)
  for (const drift of [-1, 0, 1]) {              // ±30s clock tolerance
    const ctr = new DataView(new ArrayBuffer(8))
    ctr.setBigUint64(0, BigInt(step + drift))
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, ctr.buffer))
    const off = mac[19] & 0x0f
    const bin = ((mac[off] & 0x7f) << 24) | (mac[off+1] << 16) | (mac[off+2] << 8) | mac[off+3]
    if (timingSafeEqual(String(bin % 1_000_000).padStart(6, '0'), code)) return true
  }
  return false
}
```

Gate `adminMiddleware` and team-`owner` mutations on a verified `mfa_at` claim no older than 15 minutes. Reduce `JWT_TTL_SECONDS` from 14 days to 24 hours with a rotating refresh token.

---

## DD-05 · Public API has effectively no contract

| | |
|---|---|
| **Category** | API Governance / OpenAPI compliance |
| **Severity** | **High** |
| **Confidence** | **High** |

**Evidence.** Two competing contract artifacts exist; both are empty or near-empty.

`contracts/openapi/qesto-api.yaml` is **10 lines** and ends:
```yaml
paths: {}
```
This is the input to `npm run contracts:generate` (`openapi-typescript ... -o contracts/generated/api.d.ts`), so the generated client types describe nothing.

`contracts/openapi-v3.json` documents **3 paths**: `/sessions`, `/sessions/{id}/results`, `/openapi.json`. The actual public API surface is **25 route registrations** across v1 (4), v2 (6) and v3 (15) — `/usage`, `/residency`, and the whole of v1 and v2 are undocumented.

The guard is a tautology. `scripts/check-contract-drift.ts` hashes `functions/api/lib/openapi-v3-spec.ts` against `contracts/openapi-v3.json`:
```ts
if (hash(onDisk) !== hash(serialized)) { process.exit(1) }
```
It verifies that the committed JSON matches the TypeScript constant it was generated from. It **cannot** detect that either one fails to describe the implemented routes. `npm run check:contracts` passes on an empty spec.

This is served to customers: `/api/v3/openapi.json` is a live endpoint, and there is a `developer-portal.ts` route module.

**Business impact.** Integration partners get a specification that omits ~88% of the API. Every integration is therefore built against reverse-engineered behaviour, which makes every future change a potential unannounced breaking change and puts the v1/v2/v3 versioning scheme in name only. Support cost and integration churn both scale with this.

**Technical impact.** No contract testing, no generated clients, no request/response validation derived from a schema, no automated breaking-change detection. The `contracts/` lane in CI provides false assurance.

**Exploitation scenario.** Not directly exploitable, but it is an amplifier: undocumented endpoints (`/usage`, `/residency`, all of v1/v2) receive less review attention and no schema-level input validation, which is where authorization and validation regressions accumulate unseen.

**Recommended fix.** Generate the spec *from the routes* so it cannot drift, and make coverage the gate.

**Example remediation:** adopt `@hono/zod-openapi`, which derives the spec from the same Zod schemas already used for validation:

```ts
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

const SessionSchema = z.object({ id: z.string(), title: z.string(), status: z.enum(['draft','live','closed']) })
  .openapi('Session')

app.openapi(createRoute({
  method: 'get', path: '/sessions/{id}/results',
  security: [{ apiKey: [] }],
  request: { params: z.object({ id: z.string().openapi({ example: '01HXYZ...' }) }) },
  responses: {
    200: { content: { 'application/json': { schema: SessionSchema } }, description: 'Results' },
    404: { description: 'Not found' },
  },
}), handler)
```

Then replace the tautological drift check with a **coverage** check: enumerate registered routes under `/api/v*` and fail if any lacks a spec entry. Delete the dead `contracts/openapi/qesto-api.yaml` or make it the single source.

---

## DD-06 · Rate limiting fails open and is not atomic

| | |
|---|---|
| **Category** | Availability / Brute force (OWASP A04:2021, ASVS V11.1) |
| **Severity** | **High** |
| **Confidence** | **High** |

**Evidence.** Three compounding defects.

*Fails open.* `middleware/rate-limit.ts:109-122` returns 503 on limiter error **only** when `RATE_LIMIT_FAIL_CLOSED` is set. That flag does not appear anywhere in `wrangler.toml`, so `getFlag()` returns `false` and the `catch` falls through to `void err` → `await next()`. Any KV fault disables rate limiting globally and silently.

*Not atomic.* `wrangler.toml` ships `ATOMIC_RATE_LIMIT_ENABLED = "false"`, so all eleven `[[ratelimits]]` bindings are inert. The live path is a KV read-modify-write — `middleware/public-api-auth.ts:37-57`:
```ts
const count = Number((await rlKv.get(rlKey)) ?? '0')
if (count >= KEY_LIMIT_PER_MIN) return { limited: true }
await rlKv.put(rlKey, String(count + 1), { expirationTtl: KEY_WINDOW_SEC * 2 })
```
Cloudflare KV is eventually consistent with a ~60 s per-colo cache TTL. Concurrent requests — especially across colos — read the same `count`. The effective limit is a multiple of the configured one, unbounded by concurrency.

*IP-only.* The middleware keys solely on `sha256(cf-connecting-ip).slice(0,16)`.

**Business impact.** Unmetered abuse translates directly to Workers/KV/D1/Workers-AI spend, and an auth-endpoint DoS takes down login for all tenants.

**Technical impact.** The login path runs PBKDF2 at **600,000 iterations** (`lib/password.ts:13`) — correct for storage, but ~200-400 ms of CPU per attempt. With fail-open limiting, an unauthenticated attacker converts cheap requests into expensive server CPU at a several-hundred-fold amplification.

**Exploitation scenario.** Attacker induces or waits for KV pressure, then issues a sustained flood of `POST /api/auth/password/login` with random credentials. Each request costs the attacker ~1 KB and costs the Worker ~300 ms CPU. The isolate saturates, legitimate logins time out, and the Workers bill rises. Concurrently the per-email gate — also KV-backed — under-counts, so an actual credential-stuffing run proceeds far past the nominal 10-per-15-min budget.

**Recommended fix.** Fail closed on auth routes, and enable the atomic limiter that is already provisioned.

**Example remediation:**

```toml
# wrangler.toml
RATE_LIMIT_FAIL_CLOSED = "true"     # auth must never degrade to unlimited
ATOMIC_RATE_LIMIT_ENABLED = "true"  # the [[ratelimits]] bindings already exist
```

```ts
// middleware/rate-limit.ts — fail closed by default, allow an explicit opt-out per profile.
} catch (err) {
  const failOpen = getFlag(c.env, 'RATE_LIMIT_FAIL_OPEN_PROFILES')?.split(',').includes(label)
  if (!failOpen) {
    return c.json({ ok: false, error: { code: 'rate_limit_unavailable', message: 'Try again shortly' } }, 503)
  }
}
```

Add a second dimension (account/API key) alongside IP, and put Turnstile in front of `/password/login` after *n* failures.

---

## DD-07 · RBAC permission matrix is evaluated but not enforced

| | |
|---|---|
| **Category** | Broken Access Control (OWASP A01:2021, ASVS V4.1) |
| **Severity** | **High** |
| **Confidence** | **High** |

**Evidence.** `middleware/rbac.ts` defines ~45 route→role mappings, queries D1 for the caller's roles, evaluates `hasRequiredRole()`, and then discards the result for everything except platform-admin routes:

```ts
if (!hasRequiredRole(userRoles, requiredRoles)) {
  const isPlatformAuthorityRoute = requiredRoles.has('platform_admin')
  if (isPlatformAuthorityRoute) { /* 403 */ }
  // ← every other case: no return. Falls through.
}
c.set('canAccess', true)     // unconditionally true
```

The in-file rationale — that a coarse global-role check would shadow finer team-scoped checks and cause false denials — is technically sound. The implementation is not: it leaves 40+ matrix entries that assert protection which does not exist, and pays a D1 query per request for a discarded answer. `canAccess` is a context variable that is always `true`.

Two email-based bypasses compound this: `rbac.ts:236-241` grants full access and returns **before** the platform-admin check when `user.email === c.env.SEED_ADMIN_EMAIL`; `middleware/plan.ts:80` does the same for `SUPERUSER_EMAIL`.

**Business impact.** Any engineer or AI agent adding a route and a matrix line reasonably believes the route is gated. It is not. This is broken access control by misleading abstraction, and it is precisely the class of defect that produces a breach *after* a clean-looking code review.

**Technical impact.** Authorization rests entirely on in-route object-level checks (`requireTeamPermission`, `adminMiddleware`, owner comparisons) across 395 routes, with no systematic enforcement and no test that asserts coverage.

**Exploitation scenario.** A new route `PATCH /api/teams/:id/billing` is added with a `PERMISSION_MATRIX` entry restricting it to `owner|admin`, and the author omits the in-route `requireTeamPermission` call believing the matrix covers it. Any authenticated `viewer` can then call it. Nothing in CI, review, or runtime catches the omission.

**Recommended fix.** Make the middleware honest about what it enforces, and add a test that proves route coverage.

**Example remediation:**

```ts
// Rename to what it actually is, and keep only what it actually gates.
const PLATFORM_ADMIN_ROUTES = new Set([
  'GET /api/admin/users', 'POST /api/admin/users/:id/suspend', /* ... */
])
export const platformAdminGuard: MiddlewareHandler = async (c, next) => { /* ... */ }
```

```ts
// tests/unit/route-authorization-coverage.test.ts
// Every registered /api route must either be allow-listed public, or reject
// an unauthenticated request. Fails loudly when a new route forgets its gate.
it.each(enumerateRoutes(createApp()))('%s requires auth or is explicitly public', async (route) => {
  if (PUBLIC_ROUTES.has(route.key)) return
  const res = await app.request(route.path, { method: route.method })
  expect([401, 403]).toContain(res.status)
})
```

Replace the email shortcuts with a real `platform_admin` row in `user_roles`, so privilege is data with an audit trail rather than a config string.

---

## DD-08 · Production deploys bypass every quality and approval gate

| | |
|---|---|
| **Category** | CI/CD / Change Management |
| **Severity** | **High** |
| **Confidence** | **High** |

**Evidence.** Both Cloudflare projects are **Git-integrated**, deploying directly from GitHub outside GitHub Actions. Demonstrated live on the audit's own PR #872, which changed only `knowledge-base/`:

```
✅ Deployment successful!  qesto-api   e4b747c5   (Workers Builds)
✅ Deploy successful!      qesto       e4b747c5   (Cloudflare Pages)
```

`ci.yml` skips `knowledge-base/**` via `paths-ignore`, so **no test, no `tsc --noEmit`, no architecture ratchet ran** — and `qesto-api` built and deployed anyway.

Consequences, each independently verified:

1. `npm test` and `tsc --noEmit` are `CLAUDE.md` hard rules #3/#4 but are **not in the path that ships the Worker**. Red CI does not block an API deploy.
2. The `environment: production` approval gate in `ci.yml` — added deliberately per the July infra audit — is bypassed entirely, because Workers Builds is not a GitHub Actions job.
3. `scripts/deploy-api.mjs` (which sets `--var=COMMIT_SHA`, `--tag`, and a dirty-tree guard) is not the production path. Verified against production:
   ```
   $ curl -s https://qesto.cc/api/version
   {"ok":true,"data":{"env":"production","commit":"dev"},"trace_id":"..."}
   $ curl -sI https://qesto.cc/api/version | grep x-qesto-api-commit
   x-qesto-api-commit: dev
   ```
4. `ci.yml` *also* runs `wrangler pages deploy dist` while the Pages Git integration deploys the same project — two deploys race on every push to `main`.
5. None of this is in the repository. There is no build config in `wrangler.toml` and no deployment document describing the Git integration. The real deployment model exists only in the Cloudflare dashboard.

**Business impact.** There is no enforceable change-control boundary around production — a direct SOC 2 CC8.1 finding. Incident forensics is crippled: production cannot state which commit it runs.

**Technical impact.** Untested code reaches production. Rollback is manual and undocumented. Commit-to-deploy traceability is broken, which also makes `scripts/verify-deploy.mjs`'s commit-parity check structurally unsatisfiable.

**Exploitation scenario.** An attacker (or a well-meaning contributor) merges a change whose tests fail. Cloudflare's Git integration deploys it to `qesto-api` regardless. Because `COMMIT_SHA` is `dev`, responders during the ensuing incident cannot determine from the API which build is live, and must bisect against Cloudflare dashboard build history.

**Recommended fix.** One deploy path, gated, with the config in version control.

**Example remediation** — disable both Git integrations, deploy from Actions, API before frontend:

```yaml
  deploy:
    needs: ci                       # the quality gates are now a hard dependency
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production          # approval gate now actually applies
    steps:
      - run: npm ci
      - name: Deploy API (first — additive changes must land before the UI calls them)
        run: node scripts/deploy-api.mjs
        env: { CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}', GITHUB_SHA: '${{ github.sha }}' }
      - name: Deploy frontend
        run: npx wrangler pages deploy dist --project-name=qesto
```

If Workers Builds is retained instead, set its dashboard build command to `npm run check:rc && npx wrangler deploy --var=COMMIT_SHA:$WORKERS_CI_COMMIT_SHA`, restrict the integration to `main`, and commit the dashboard configuration to `knowledge-base/operations/deployment/`.

---

## DD-09 · Password reset does not invalidate existing sessions

| | |
|---|---|
| **Category** | Session Management (ASVS V3.3.3) |
| **Severity** | **High** |
| **Confidence** | **High** |

**Evidence.** `routes/auth/password.ts:243-300` (`/password/reset-confirm`) writes the new hash, updates `last_login_at`, and issues a fresh cookie. It never calls `revokedSessionTokenKey()`. The revocation mechanism exists and is used elsewhere — `routes/auth/session-routes.ts:62,107` (logout) and `routes/admin/user-support.ts:209` (admin action) — but not on the reset path.

**Business impact.** The primary self-service account-recovery control does not recover the account. A compromised user who "fixes" it by resetting their password remains compromised, and will reasonably believe otherwise.

**Technical impact.** Attacker sessions survive up to the full 14-day JWT lifetime after a reset.

**Exploitation scenario.** Attacker obtains a session cookie via device access or token theft. Victim notices suspicious activity and resets their password. Attacker's cookie remains valid for up to 14 days, with no indication to the victim and no mechanism the victim can invoke to terminate it.

**Recommended fix.** A per-user epoch is better than per-token revocation, because the reset path cannot enumerate outstanding tokens.

**Example remediation:**

```sql
ALTER TABLE users ADD COLUMN sessions_valid_from INTEGER NOT NULL DEFAULT 0;
```

```ts
// On reset-confirm, password change, and email change:
await db.prepare('UPDATE users SET sessions_valid_from = ?1 WHERE id = ?2')
        .bind(Date.now(), userId).run()

// middleware/auth.ts — reuse the KV read that already happens.
if (claims.iat * 1000 < user.sessions_valid_from) {
  return c.json({ ok:false, error:{ code:'unauthenticated', message:'Session superseded' } }, 401)
}
```

---

## DD-10 · Signup issues a 14-day session without email verification

| | |
|---|---|
| **Category** | Authentication / Identity Proofing (ASVS V2.1) |
| **Severity** | **High** |
| **Confidence** | **High** |

**Evidence.** `routes/auth/password.ts:29-113` creates the user, calls `ensurePersonalTeam()`, and calls `setAuthSessionCookie(c, jwt)` immediately. There is no verification email and no `email_verified` column in `schema.sql`. The only control is `isDisposableEmail()` — a domain denylist, which proves nothing about mailbox ownership.

**Business impact.** Unverified addresses receive product mail, which degrades sender reputation on the shared Resend domain and risks deliverability for genuine magic links — the primary login mechanism. It also permits trivial free-tier farming during the ADR-0074 promo window.

**Technical impact.** Account identity is unproven at creation. The codebase already contains `lib/email-domain.ts` and `lib/connect-invite.ts`; the moment domain-based team joining or SSO domain claims are wired to these, unverified email becomes a tenant-takeover primitive.

**Exploitation scenario.** Attacker registers `cfo@targetcompany.com`, which they do not control. Today that yields a personal workspace. When domain-claim or invite-matching logic ships — both scaffolded — the same unverified account auto-joins the target's tenant, or intercepts an invitation flow keyed on email equality.

**Recommended fix.** Verify before granting anything beyond a personal sandbox.

**Example remediation:**

```sql
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
```

```ts
// Reuse the existing magic-link token machinery (lib/tokens.ts).
const raw = generateMagicLinkToken()
await writeKvJson(c.env.ACTIONS_KV, verifyKey(await hashMagicLinkToken(raw)),
                 { userId, email: normalEmail }, { expirationTtl: 86_400 })
void sendEmail(c.env.RESEND_API_KEY, { to: normalEmail, subject: 'Confirm your Qesto address', /* ... */ })

// Gate the sensitive surface, not the whole app.
export const requireVerifiedEmail: MiddlewareHandler = async (c, next) => {
  if (!(await isEmailVerified(c.env.DB, c.get('user').sub))) {
    return errorResponse(c, 403, 'email_unverified', 'Confirm your email address to continue')
  }
  await next()
}
// Apply to: team join/invite accept, billing, API-key creation, SCIM.
```

---

## DD-11 · Password-reset request endpoint has no rate limit

| | |
|---|---|
| **Category** | Abuse / User Enumeration (ASVS V2.2.1) |
| **Severity** | **High** |
| **Confidence** | **High** |

**Evidence.** `routes/auth/password.ts:205-242`. `/password/login` and `/password/signup` each carry a dual IP+email `atomicRateLimitDual` gate; `/api/auth/request` is limited in `app.ts`. `/password/reset-request` has **none**. It also performs the Resend network call inline before responding:

```ts
if (user) {
  await writeKvJson(c.env.ACTIONS_KV, resetKey(tokenHash), { userId: user.id, email }, { ... })
  try { await sendEmail(c.env.RESEND_API_KEY, { to: email, ... }) } catch { /* logged */ }
}
return c.json({ ok: true, data: { accepted: true } }, 202)
```

**Business impact.** Direct, uncapped Resend spend and a domain-reputation risk: a sustained flood of reset mails to non-consenting recipients invites spam complaints against the shared sending domain, which would break magic-link login for every customer.

**Technical impact.** Two issues. (1) Unbounded email amplification. (2) The constant `202` is defeated by timing: the `if (user)` branch performs a KV write plus an outbound HTTPS call to Resend, a difference measurable in the tens-to-hundreds of milliseconds. The endpoint is a reliable user-existence oracle.

**Exploitation scenario.** Attacker scripts `POST /password/reset-request` across a list of an organisation's likely addresses, timing each response to enumerate which are registered — building a target list for the credential stuffing that DD-06 leaves inadequately throttled. Separately, the same endpoint is pointed at one victim address in a loop as a harassment/mail-bomb vector.

**Recommended fix.** Same dual gate as its siblings, plus constant-time response.

**Example remediation:**

```ts
const ip = c.req.header('cf-connecting-ip')
for (const gate of [
  ip ? { key: `ip:${ip}`, prefix: 'auth-reset', profileLabel: 'auth_reset_ip', max: LOGIN_MAX_PER_IP } : null,
  { key: `email:${email}`, prefix: 'auth-reset', profileLabel: 'auth_reset_email', max: LOGIN_MAX_PER_EMAIL },
].filter(Boolean)) {
  const r = await atomicRateLimitDual(c.env, {
    key: gate.key, burst: 'auth_burst',
    sustained: { max: gate.max, windowSeconds: LOGIN_WINDOW_SECONDS, prefix: gate.prefix },
    profileLabel: gate.profileLabel,
  })
  if (!r.allowed) return errorResponse(c, 429, 'rate_limited', 'Too many requests. Try again later.')
}

// Move the mail off the response path so timing is identical either way.
if (user) c.executionCtx.waitUntil(sendResetEmail(c.env, user, email))
return c.json({ ok: true, data: { accepted: true } }, 202)
```

---

## DD-12 · Vote persistence is a sequential per-row D1 round-trip loop

| | |
|---|---|
| **Category** | Performance / Scalability / Data Integrity |
| **Severity** | **High** |
| **Confidence** | **High** |

**Evidence.** `lib/session-room-persistence.ts:85-118` — the hottest path in the product:

```ts
for (const v of state.voteBuffer) {
  if (v.supersedesOptionId) {
    await deleteStmt.bind(v.questionId, v.voterId, v.supersedesOptionId).run()   // round-trip
  }
  await insertStmt.bind(crypto.randomUUID(), v.sessionId, /* ... */).run()        // round-trip
}
```

Each `.run()` is an individual awaited D1 call. The flush fires every `FLUSH_INTERVAL_MS = 5000` (`session-room-types.ts:13`). The `starter` plan permits `maxParticipantsPerSession: 500` and `team` more (`types/plan-quotas.ts`).

Repository-wide, `DB.batch()` — D1's **only** atomicity and pipelining primitive, since D1 has no interactive transactions — appears **3 times** in the entire codebase (`session-room-townhall-handler.ts:415`, `sessions/wizard-questions.ts:209`, `gamification.ts:195`).

**Business impact.** The failure mode is a live, on-stage product event: a presenter running a 500-person session sees results stall. That is the single most visible, least forgivable failure this product can have.

**Technical impact.** A 500-participant question produces up to 1,000 sequential round-trips (delete + insert for vote changes) inside one 5-second flush window. At a conservative 5-15 ms per D1 call, that is **5-15 seconds of serialised work** — the flush cannot keep pace with its own interval, the buffer grows, and the Durable Object's single-threaded event loop is occupied, delaying broadcasts to all connected sockets. The DO also holds `_voters` and `_counts` fully in memory against a 128 MB limit.

Integrity: a mid-loop failure leaves a partial flush. It is idempotent on re-flush by design (the `UNIQUE constraint failed` swallow), but `votes`, `K_VOTERS` and `K_COUNTS` are not updated atomically with respect to each other.

**Exploitation scenario.** Requires no attacker — normal peak usage triggers it. Adversarially, a participant scripting rapid vote changes (`vote_policy='multi'`) maximises the delete+insert pair count, and the `VOTE_BUCKET_CAPACITY = 10` token bucket permits a burst per socket; with `PER_IP_CONCURRENT_CAP = 10` sockets per IP, a single host can sustain a disproportionate share of flush work.

**Recommended fix.** Batch the flush; it is a contained change to one function.

**Example remediation:**

```ts
// Build all statements, then submit as one pipelined, atomic batch.
const statements: D1PreparedStatement[] = []
for (const v of state.voteBuffer) {
  if (v.supersedesOptionId) {
    statements.push(deleteStmt.bind(v.questionId, v.voterId, v.supersedesOptionId))
  }
  statements.push(
    insertStmt.bind(crypto.randomUUID(), v.sessionId, v.questionId, v.voterId, v.optionId, v.submittedAt),
  )
}
// Chunk so one batch never exceeds D1's statement ceiling; order is preserved.
for (let i = 0; i < statements.length; i += 100) {
  await env.DB.batch(statements.slice(i, i + 100))
}
```

Switch the insert to `INSERT OR IGNORE` so the duplicate case is handled by the engine rather than by catching and string-matching an error message. Add a load test asserting flush latency at 500 concurrent voters — `tests/load/k6-smoke.js` exists but does not cover this and does not run in CI.

---

## DD-13 · Eight circular dependencies, including the authorization module

| | |
|---|---|
| **Category** | Architecture / Clean Architecture / Maintainability |
| **Severity** | **Medium** |
| **Confidence** | **High** |

**Evidence.** `npx madge --circular --extensions ts,tsx functions/api src`:

```
✖ Found 8 circular dependencies!
1) lib/ai/ai-gateway.ts > lib/ai/session-context.ts
2) lib/session-room-context.ts > lib/session-room-energizer-handler.ts
3) lib/session-room-context.ts > lib/session-room-ideate-handler.ts
4) lib/session-room-context.ts > lib/session-room-retro-handler.ts
5) lib/session-room-context.ts > lib/session-room-townhall-handler.ts
6) lib/authz.ts > routes/teams/index.ts
7) lib/authz.ts > routes/teams/index.ts > routes/teams/members.ts > routes/teams/shared.ts
8) lib/authz.ts > routes/teams/index.ts > routes/teams/roles.ts
```

Cycles 6-8 are a **layering inversion**: `lib/authz.ts` — the authorization primitive — imports from the route layer that is supposed to consume it. This is a Dependency Inversion Principle violation on the single most security-sensitive module in the system.

**Business impact.** Raises the cost and risk of every change to authorization, which is exactly where change must be cheapest and safest to review.

**Technical impact.** Module-initialisation order becomes significant and fragile; tree-shaking is defeated; `authz.ts` cannot be unit-tested in isolation without pulling in the entire teams route tree and its transitive KV/D1 dependencies — which is a plausible contributor to the low branch coverage on this exact path (DD-18).

**Exploitation scenario.** Not directly exploitable. It is a latent-defect amplifier: circular imports in ESM can yield partially-initialised bindings (`undefined` at call time) depending on entry order. On an authorization module, a `TypeError` on an undefined guard function — or worse, a falsy check that silently passes — is a plausible failure mode that would only surface under a specific import path.

**Recommended fix.** Invert the dependency: move shared types and pure helpers down, never import routes from `lib/`.

**Example remediation:**

```ts
// functions/api/lib/authz-types.ts  (new — pure, zero imports)
export type Permission = 'session:launch' | 'session:close' | 'energizer:activate' | /* ... */
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer'
export interface TeamMembershipReader { load(teamId: string, userId: string): Promise<TeamRole | null> }

// lib/authz.ts — depends on the interface, not on routes.
import type { TeamMembershipReader, Permission } from './authz-types'
export function createAuthz(reader: TeamMembershipReader) { /* ... */ }

// routes/teams/index.ts — supplies the concrete reader (composition root).
```

Add `madge --circular` to `ops/ci/quality-gates.sh` as a ratchet at the existing count of 8 so it can only shrink, matching the pattern already used for `check-kv-access` and friends.

---

## DD-14 · No pagination strategy; 117 unbounded result sets

| | |
|---|---|
| **Category** | API Design / Performance / Scalability |
| **Severity** | **Medium** |
| **Confidence** | **High** |

**Evidence.** 117 `.all<>()` call sites in `functions/api/` have no `LIMIT`. Only 12 route handlers read any of `limit`, `offset`, `cursor` or `page` — against 395 route registrations. Where limits exist they are hardcoded ceilings rather than pagination, e.g. `lib/marketing/video-assets.ts:33`:

```sql
SELECT ... FROM video_assets WHERE category = ?1 ORDER BY created_at DESC LIMIT 1000
```

and the tag filter is then applied **in application memory** over those 1,000 rows (`video-assets.ts:41-46`).

`listTemplates()` in `lib/templates-kv.ts:109-125` is the counter-example done properly — clamped limit/offset with a parameterised count query. The pattern exists; it is not applied.

**Business impact.** Response times and Workers CPU consumption grow linearly with tenant data. The largest, most valuable customers degrade first. API consumers cannot page, so integrations silently truncate at hardcoded ceilings.

**Technical impact.** Unbounded memory and serialisation in a 128 MB isolate with a CPU budget. `sessionRepository.ts:90,125,131` and `admin/user-support.ts:77,86` return full history sets. A tenant with 10k sessions returns 10k rows in one JSON payload.

**Exploitation scenario.** A tenant (or an attacker on a free account) creates a large number of sessions/votes, then repeatedly calls an unbounded list endpoint. Each request forces a full table scan and a large serialisation, consuming CPU-time and egress out of proportion to request cost — an economic-denial-of-service against the Workers bill, and a latency-degradation vector for co-located tenants.

**Recommended fix.** One shared cursor helper, applied to every list endpoint, with a schema-enforced default.

**Example remediation:**

```ts
// functions/api/lib/pagination.ts
export const PageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().optional(),      // opaque: base64(`${created_at}:${id}`)
})

export function keysetPage(sql: string, cursor?: string) {
  if (!cursor) return { clause: '', binds: [] as unknown[] }
  const [ts, id] = atob(cursor).split(':')
  return { clause: ' AND (created_at, id) < (?, ?)', binds: [Number(ts), id] }
}
```

```ts
const { limit, cursor } = PageQuery.parse(c.req.query())
const page = keysetPage(base, cursor)
const rows = await db.prepare(`${base}${page.clause} ORDER BY created_at DESC, id DESC LIMIT ?`)
                     .bind(...binds, ...page.binds, limit + 1).all()
const hasMore = rows.results.length > limit
```

Keyset beats offset here: D1/SQLite `OFFSET` still scans skipped rows. Add a lint ratchet counting `.all<` without `LIMIT`, baselined at 117.

---

## DD-15 · Public source maps expose full application source

| | |
|---|---|
| **Category** | Information Disclosure (OWASP A05:2021) |
| **Severity** | **Medium** |
| **Confidence** | **High** |

**Evidence.** `vite.config.ts:43` sets `sourcemap: true` for the production build. The emitted `.map` files deploy to Pages under `/assets/*` and `/chunks/*`, which `public/_headers` serves with `Cache-Control: public, max-age=31536000, immutable`.

**Business impact.** Competitors and attackers read unminified source including comments, feature-flag names, unreleased functionality, and plan-gating logic.

**Technical impact.** Removes the reconnaissance cost of understanding the client. Internal route names, the full API call surface, and the client-side entitlement checks are all legible.

**Exploitation scenario.** Attacker fetches `https://qesto.cc/assets/index-<hash>.js.map`, recovers the original TypeScript, and reads `featuresUnlocked` handling and plan-gate checks to identify which gates are enforced only client-side — then tests those endpoints directly. Comments referencing unshipped features (e.g. the SAML caveats) provide a prioritised target list.

**Recommended fix.** Generate maps, do not serve them.

**Example remediation:**

```ts
// vite.config.ts
build: {
  sourcemap: 'hidden',   // emitted for error-tracking upload; no //# sourceMappingURL served
}
```

```
# public/_headers — belt and braces
/*.map
  X-Robots-Tag: noindex
```
and add a post-build step that uploads maps to the error tracker, then deletes them from `dist/` before deploy.

---

## DD-16 · Two D1 queries and a KV read before every authenticated request

| | |
|---|---|
| **Category** | Performance / Cost / Scalability |
| **Severity** | **Medium** |
| **Confidence** | **High** |

**Evidence.** Per authenticated request, unconditionally:

| Middleware | Cost |
|---|---|
| `authMiddleware` | KV read — session revocation list |
| `planMiddleware` | `SELECT plan FROM users WHERE id = ?1` (1.5 s timeout) |
| `rbacMiddleware` | `SELECT role FROM user_roles WHERE user_id = ?1` |

None is cached. `middleware/kv-cache.ts` exists but is not used on this path. The RBAC query is the most wasteful: per DD-07 its result is discarded for all non-platform-admin routes.

The code documents the realised risk — `app.ts` records a **2026-07-03 D1 incident** where duplicate middleware registration multiplied this by ~10× and produced 13-second requests. Idempotency guards were added; the per-request baseline of 2 queries + 1 KV read was not addressed.

**Business impact.** Adds latency to every authenticated interaction in a product whose core value proposition is real-time responsiveness, and creates a D1 read bill that scales linearly with traffic rather than with users.

**Technical impact.** ~15-40 ms added latency per request under healthy D1; a single point of contention under unhealthy D1, where both queries serialise behind the same degraded binding.

**Exploitation scenario.** Not attacker-driven, but attacker-amplifiable: any authenticated endpoint, called in a loop, multiplies D1 read load by three. Combined with DD-06's fail-open limiter, a modest request flood becomes disproportionate database pressure.

**Recommended fix.** Put slow-changing authorization data in the token, or cache it.

**Example remediation:**

```ts
// Option A — claims in the JWT, short TTL. Zero reads on the hot path.
type AuthClaims = { sub: string; email: string; plan: PlanTier; roles: string[]; iat: number; exp: number }
// Reissue on role/plan change; keep TTL ≤ 15 min with a refresh token (pairs with DD-04).

// Option B — per-user KV cache with explicit invalidation.
const cacheKey = `authctx:${user.sub}`
let ctx = await readKvJson<AuthContext>(env.ACTIONS_KV, cacheKey)
if (!ctx) {
  ctx = await loadPlanAndRoles(env.DB, user.sub)
  await writeKvJson(env.ACTIONS_KV, cacheKey, ctx, { expirationTtl: 60 })
}
// Invalidate on: plan change (Stripe webhook), role grant/revoke, suspension.
```

Drop the RBAC query entirely once DD-07 is resolved.

---

## DD-17 · KV write on every authenticated API-key request

| | |
|---|---|
| **Category** | Performance / Cost / Data Integrity |
| **Severity** | **Medium** |
| **Confidence** | **High** |

**Evidence.** `middleware/public-api-auth.ts:111-114` rewrites the entire API-key record on every successful request, solely to refresh `lastUsedAt`:

```ts
const updated: ApiKeyRecord = { ...parsed.data, lastUsedAt: Date.now() }
await writeKvJson(c.env.INTEGRATIONS_KV, apiKeyKvKey(parsed.data.id), updated, {
  expirationTtl: API_KEY_RECORD_TTL_SECONDS,      // ONE_YEAR_SECONDS
})
```

**Business impact.** A per-request KV write at roughly $5/million writes, incurred for a field with no per-second business value, scaling directly with API adoption — the metric the business wants to grow.

**Technical impact.** Cloudflare KV permits approximately **one write per second per key**. The documented API-key limit is 120 requests/minute (2/s), so normal peak usage exceeds the per-key write rate, producing write contention and lost updates. Separately, re-`put`ting with a one-year `expirationTtl` on each use means an **unused key silently expires out of KV** and stops working with an `unauthenticated` error rather than an explicit revocation.

**Exploitation scenario.** Low direct security impact. The availability edge is real: a partner integration at sustained throughput drives per-key write contention; combined with the non-atomic KV rate-limit counter in the same middleware (DD-06), the limiter and the usage record degrade together under exactly the load where they matter.

**Recommended fix.** Throttle the write; take usage metering off the KV write path.

**Example remediation:**

```ts
// Update at most once every 5 minutes — sufficient for a "last used" display.
const STALE_MS = 5 * 60_000
if (!parsed.data.lastUsedAt || Date.now() - parsed.data.lastUsedAt > STALE_MS) {
  c.executionCtx.waitUntil(
    writeKvJson(c.env.INTEGRATIONS_KV, apiKeyKvKey(parsed.data.id),
                { ...parsed.data, lastUsedAt: Date.now() }),   // no TTL — keys expire via expiresAt
  )
}
// Per-request usage belongs in Analytics Engine, which is built for high-cardinality writes.
writeEvent(c.env.METRICS_AE, { name: 'api.request', teamId, detail: `${c.req.method} ${c.req.path}` })
```

---

## DD-18 · Test coverage floors sit at 42% lines / 30% branches

| | |
|---|---|
| **Category** | Testing Strategy / Quality Assurance |
| **Severity** | **Medium** |
| **Confidence** | **High** |

**Evidence.** `vite.config.ts:113-118`:
```ts
thresholds: { statements: 41, branches: 30, functions: 37, lines: 42 }
```
2,706 tests pass across 316 files — verified this engagement — but they exercise well under half the shipped surface. The in-file comment is candidly honest: under vitest v3 the thresholds sat at the wrong nesting level and were **silently ignored while real coverage was ~31%**, with a green build throughout.

Lane inventory is otherwise good: `unit`, `integration`, `functional`, `component`, `e2e` (Playwright), `a11y` (axe-core), `eval` (AI golden set), `stress` (DO concurrency), `load` (k6). **But `test:stress` and the k6 load lane never run in CI** — no workflow or `ops/ci/` script references them.

**Business impact.** 30% branch coverage on a codebase this dense in authorization, plan-gating and state-machine branching means the majority of decision points are unverified. The 2,706 green tests provide assurance the coverage does not support — the more dangerous condition, because it is trusted.

**Technical impact.** Regressions in untested branches ship silently. Specifically untested-at-depth: the middleware chain, `session-room-vote*`, and per DD-13 `authz.ts` is hard to test in isolation at all.

**Exploitation scenario.** An authorization regression — for instance the DD-07 scenario where a route's in-route check is omitted — is not caught by any test, because no test asserts that every route rejects unauthenticated access.

**Recommended fix.** Stop chasing the global number; ratchet hard on the security-critical files, which are small.

**Example remediation:**

```ts
// vite.config.ts — per-glob thresholds; the global floor stays as a backstop.
thresholds: {
  statements: 41, branches: 30, functions: 37, lines: 42,
  'functions/api/middleware/**': { branches: 90, lines: 95 },
  'functions/api/lib/{jwt,password,authz,embed-token,session-token}.ts': { branches: 90, lines: 95 },
  'functions/api/lib/session-room-vote*.ts': { branches: 85, lines: 90 },
},
```

Add the stress and load lanes to CI — nightly rather than per-PR, given runtime:

```yaml
  # .github/workflows/nightly-perf.yml
  on: { schedule: [{ cron: '0 3 * * *' }] }
  steps:
    - run: npm run test:stress
    - run: k6 run tests/load/k6-smoke.js --vus 500 --duration 2m
```

---

## DD-19 · Hono advisories: one of four applies — with an exposure oracle

| | |
|---|---|
| **Category** | Dependency / Supply Chain |
| **Severity** | **Medium** |
| **Confidence** | **High** |

**Evidence.** `npm audit --omit=dev` reports exactly one production-dependency finding: `hono <= 4.13.4`, three advisories. PR #839 would take it to 4.13.7, adding a fourth fix. Applicability was tested against the codebase rather than assumed:

| Advisory | Precondition | Applies? |
|---|---|---|
| GHSA-hxh3-vqpv-xpqv — `hono/jsx` XSS | uses `hono/jsx`, `renderToString` | **No** — zero imports |
| GHSA-gqvv-2mrq-wpjv — `toSSG()` path traversal | uses `toSSG()` | **No** — not used |
| GHSA-g6gw-c38x-mqfc — `parseBody()` memory exhaustion | `parseBody({ dot: true })` | **No** — routes use `c.req.json()` |
| **GHSA-crvj-82cr-hjcx — query-parser fragment differential** | Cache Middleware **or** *"applications behind a proxy, WAF, or logging layer that inspects query strings"* | **Yes** — second clause |

Verified imports across `functions/`: only `hono/cookie`, `hono/cors`, `hono/utils/http-status`. Hono's Cache Middleware is not used — but Qesto runs behind Cloudflare (a proxy, WAF and logging layer that inspects query strings) and sets `s-maxage=60` on the HTML shell via `public/_headers`.

**This corrects the prior audit**, which framed all three moderates as live runtime risk. Only one plausibly applies.

**Business impact.** Modest on its own. Its real significance is as the concrete instance of DD-01: a 5-line merge, already prepared, unmerged for 15 days.

**Technical impact.** Hono may parse query parameters that appear after a `#` fragment, which Cloudflare's cache-key computation and WAF inspection do not see. The two components disagree about what the request says.

**Exploitation scenario.** An attacker crafts `…/some/path#?foo=bar` such that Cloudflare computes a cache key from the fragment-stripped URL while Hono reads `foo=bar` and varies its response. A response generated under attacker-influenced parameters is then stored under the cache key of the benign URL and served to other users — cache poisoning. The same divergence lets a request evade a WAF rule that matches on query content while still reaching handler logic that reads it. **Aggravating factor:** `/api/version` is unauthenticated and returns `{"env":"production","commit":"dev"}`, so an attacker can confirm the deployment is live but cannot determine the build — while the public GitHub repository shows PR #839 open and unmerged, which tells them the vulnerable version is still running.

**Recommended fix.** Merge PR #839. Then fix the ineffective override.

**Example remediation:**

```jsonc
// package.json — ^4.3.1 resolves to 4.3.1, which is inside the advisory range 4.0.0 – 4.3.1.
"overrides": {
  "esbuild": "^0.28.1",
  "ws": "^8.21.0",
  "js-yaml": "^4.3.2"   // was ^4.3.1 — PR #862 carries this
}
```

Close the `/api/version` oracle by requiring auth for the commit field, or — better — make it truthful (DD-08) and accept it as an intentional, accurate deploy probe.

---

## DD-20 · Cloudflare Git integration is undocumented infrastructure-as-clickops

| | |
|---|---|
| **Category** | Infrastructure / Configuration Management (Twelve-Factor III) |
| **Severity** | **Medium** |
| **Confidence** | **High** |

**Evidence.** There is no `Dockerfile`, no Terraform, no Bicep, no Pulumi. Infrastructure is `wrangler.toml` plus Cloudflare dashboard state. The dashboard state includes at minimum: the Workers Builds Git integration and its build command, the Pages Git integration, WAF and zone settings, secret values, and the `[[ratelimits]]` namespace registry.

None of it is in the repository. The Workers Builds integration was discovered only because this audit opened a PR and observed the deploy bot — it is invisible to any repository-only review, including every prior audit in `knowledge-base/quality/audits/`.

Related: `wrangler.toml` defines no `[env.staging]` or `[env.preview]` and ships `ENV = "production"` in the default `[vars]`. Local `wrangler dev` therefore inherits `ENV="production"`, which the code must actively compensate for — `middleware/csrf.ts:130` carries an `apiIsLocal` heuristic explicitly to work around it.

**Business impact.** No disaster recovery for the control plane. If the Cloudflare account is lost, compromised, or misconfigured, the repository is insufficient to rebuild the service. There is no review trail for infrastructure changes and no way to diff them.

**Technical impact.** Configuration drift is undetectable. Environment separation is a runtime heuristic rather than a configuration boundary — a Twelve-Factor III violation that has already produced compensating security logic in the CSRF middleware, which is precisely where compensating logic becomes a future gap.

**Exploitation scenario.** An attacker or careless operator with Cloudflare dashboard access alters the Workers Builds branch filter to deploy from an arbitrary branch, or weakens a WAF rule. Nothing in the repository changes, no PR is opened, no review occurs, and no audit in this directory would detect it.

**Recommended fix.** Declare what can be declared; document the rest as reviewed configuration.

**Example remediation:**

```toml
# wrangler.toml — real environment separation; removes the apiIsLocal heuristic.
[env.staging]
vars = { ENV = "staging", PAGES_URL = "https://staging.qesto.cc", API_URL = "https://staging.qesto.cc" }

[env.dev]
vars = { ENV = "dev", PAGES_URL = "http://localhost:5173", API_URL = "http://localhost:8787" }
```

Add `knowledge-base/operations/deployment/CLOUDFLARE_DASHBOARD_STATE.md` recording — and requiring PR review to change — the Workers Builds build command and branch filter, the Pages integration settings, the WAF rule set, the secret inventory (names only), and the rate-limit namespace registry. Where Cloudflare's API supports it, move these to a Terraform provider so drift becomes a diff.

---

## DD-21 · Consolidated Medium and Low findings

| ID | Category | Title | Sev | Conf | Evidence | Impact & Fix |
|---|---|---|---|---|---|---|
| DD-22 | Access Control | Middleware order carries security meaning with nothing enforcing it | Med | High | `app.ts` ~90 `mountXxxRoutes()` calls; `softAuthMiddleware`/`rbacMiddleware` registered on `/api/*` **after** `mountPublicApiV1/2/3`, `mountPlatformRoutes`, `mountScimRoutes` — Hono honours registration order, so those never see RBAC | No gap today (each has its own auth), but a misplaced line silently disables authorization. Hoist auth to one `/api/*` registration with an explicit `PUBLIC_ROUTES` allowlist; add the route-coverage test from DD-07 |
| DD-23 | Auth | Impersonation tokens share the session signing key | Med | High | `middleware/auth.ts:75-88` accepts any valid JWT whose `jti` starts with `imp:`, signed with the same `JWT_SECRET`; no server-side registry of active impersonations | Security rests on an unenforced invariant across 90 route modules: that no mint path ever accepts a caller-influenced `jti`. A demoted admin's impersonation cookie stays valid to JWT expiry. Use a separate `IMPERSONATION_SECRET`, cap TTL at 30 min, register active impersonations in `ACTIONS_KV`, and add a test asserting no mint path accepts an `imp:` prefix from input |
| DD-24 | CSRF | Requests with neither `Origin` nor `Referer` are accepted | Med | High | `middleware/csrf.ts:104-134` rejects only when a header is present and mismatched | Narrow residual risk (modern browsers send `Origin` on form POSTs and `sendBeacon`). The code names the right mitigation but does not implement it: require `X-Qesto-Client: web` on mutations from the SPA — CORS blocks custom headers cross-origin without a passed preflight, and cookie-less API-key integrations are unaffected |
| DD-25 | CORS | Any `*.qesto.pages.dev` preview is a fully trusted credentialed origin against production | Med | High | `app.ts:130` and `csrf.ts:121` both allow `^https:\/\/[a-z0-9]+\.qesto\.pages\.dev$` with `credentials: true`. Confirmed live on PR #872: `https://69bd9913.qesto.pages.dev` matches | Any preview build — including from an unreviewed branch — can drive credentialed state-changing requests against production for any logged-in visitor. Coverage is also accidental: the branch preview `claude-codebase-technical-au.qesto.pages.dev` fails the regex because hyphens are excluded. Point previews at a staging API, or gate them behind Cloudflare Access |
| DD-26 | Headers | `/display/*` sends contradictory framing directives | Med | High | `public/_headers`: `X-Frame-Options: SAMEORIGIN` **and** `frame-ancestors *` | Browsers prefer `frame-ancestors`, so the effective policy is "anyone may frame" while the XFO line implies otherwise. Clickjacking/misrepresentation surface on live-results pages. Decide explicitly: drop XFO and replace `*` with an allowlist of the origins that actually need embedding |
| DD-27 | Headers | SPA CSP omits `base-uri` and `object-src` | Low | High | `public/_headers`; the API CSP in `middleware/security-headers.ts` correctly sets `base-uri 'none'` | `default-src` does not cover `base-uri`. No exploit path today (zero XSS sinks), but the inconsistency is the signal. Add `base-uri 'self'; object-src 'none';` |
| DD-28 | Exposure | API reachable on a second, unhardened origin | Med | Med | `public/_headers` `connect-src` includes `https://qesto-api.oostelaar.workers.dev` | The `workers.dev` route bypasses zone-level WAF, bot management and firewall rules, and leaks the personal account name. Set `workers_dev = false`; remove from CSP. *Medium confidence: whether the route is currently enabled is dashboard state* |
| DD-29 | Dependencies | Four unused packages in production `dependencies` | Low | High | `@capacitor/app`, `@capacitor/preferences`, `@capacitor/push-notifications` referenced in **zero** source files; `src/lib/native-shell.ts` uses the `window.Capacitor` global directly with its own type declaration. No `ios/` or `android/` directories exist. `jankurai-workspace` (a Rust CI audit tool) is also in `dependencies` | Install-time surface and supply-chain exposure for unused code. Move `jankurai-workspace` to `devDependencies`; remove the three Capacitor runtime packages until the native shell actually ships |
| DD-30 | Repo Hygiene | 43 branches, 27 open PRs, duplicate abandoned bot PRs | Low | High | Four separate `fix(e2e): run Playwright webServer from the repo root` PRs from `cursor[bot]` (#830, #832, #859) plus #865/#870; 16 open Dependabot PRs; branches from `cursor/`, `claude/`, `feat/`, `fix/` going back weeks | Signals abandoned automation re-proposing the same fix. Review queue is the bottleneck (DD-01). Enable auto-delete on merge, close superseded bot PRs, and cap concurrent bot PRs |
| DD-31 | Docs | Repository documentation contradicts live repository state | Low | High | `.github/CODEOWNERS` states "Branch protection is not currently enabled"; the GitHub API reports `main` → `"protected": true` | Stale security documentation is worse than none — it misdirects audits. **Note:** this also means the *rules* are unverifiable from here; whether required status checks are configured is unknown, and DD-01's evidence (`mergeable_state: blocked` with a requested reviewer) suggests required reviews are on. Reconcile the docs and publish the actual ruleset |
| DD-32 | Observability | Cron trigger ceiling already reached | Low | High | `wrangler.toml`: `crons = [5 entries]` with the comment "Cloudflare allows at most 5 cron triggers per Worker — we are at the limit"; six logical jobs are multiplexed onto five expressions by string-matching in `handleScheduled` | A hard platform wall already hit. Scheduling logic becomes a growing `if/else` on cron strings, and a fault in one job can abort siblings in the same invocation. Move background work to Cloudflare Queues — the producer binding is already drafted (commented out) in `wrangler.toml` |
| DD-33 | Logging | 41 raw `console.*` calls bypass the PII redaction layer | Low | High | `lib/log.ts` defines a solid 10-pattern redactor, but `middleware/rbac.ts:190`, `routes/auth/password.ts:176`, `routes/billing-shared.ts:57` and others call `console.*` directly, some with `userId` | Internal ULIDs are not PII, but the path is unguarded and will eventually carry something that is. Route everything through `logEvent`/`safeLogContext` and add a lint rule banning bare `console.*` in `functions/` |
| DD-34 | Logging | Redaction pattern over-matches | Low | High | `lib/log.ts:54` — `/([a-f0-9]{40})/g` redacts any 40-char hex string, including git SHAs and SHA-1 digests | Degrades incident diagnosis by redacting the commit identifiers responders need. Anchor on context: `/(?:token|key|secret)[=:]\s*([a-f0-9]{40})/gi` |
| DD-35 | Crypto | Customer-Managed Keys is metadata with no cryptography | Low | High | `lib/cmk.ts` defines `{ teamId, keyId, algorithm: 'AES-256-GCM', rotatedAt, status }` — no key material, no wrapping, no encryption. `routes/forensics.ts:48-51` serves it to admins | **Credit where due:** `src/pages/Pricing.tsx:294` and `Privacy.tsx:233` correctly list CMK as a *roadmap* item, and `check:compliance-claims` guards that. The internal endpoint is the problem: it reports an algorithm for a control that does not exist, which is a finding in any SOC 2 or customer audit. Rename to `CmkIntentDeclaration`, or return `{"status":"not_implemented"}` |
| DD-36 | Auth | Password policy has no breach check | Low | High | `routes/auth/schemas.ts:6` — `z.string().min(8).max(128)`, no compromised-credential check | NIST SP 800-63B §5.1.1.2 requires screening against known-breached passwords. Add a HIBP k-anonymity range query (privacy-preserving: only a 5-char SHA-1 prefix leaves the Worker) or ship a top-10k denylist |
| DD-37 | Cost | `purge_everything` on every deploy | Low | High | `ci.yml` — `curl ... /purge_cache -d '{"purge_everything":true}'` | Global cold cache on every release: a latency spike and an origin-load spike per deploy, unnecessary given content-hashed asset filenames. Purge only the HTML shell by URL, or rely on hashing |
| DD-38 | Privacy | Third-party image host allowed for QR codes | Low | High | `public/_headers` `img-src` permits `https://api.qrserver.com`, while `react-qr-code` renders locally | If any path uses the remote service, session join codes leave to a third party. Remove from CSP and confirm local rendering everywhere |
| DD-39 | SAML | Assertion parser lacks every validation besides signature | Med | High | `lib/saml.ts` `parseAssertion()` checks Audience and extracts NameID/email by regex. It does **not** validate `Conditions/@NotBefore`, `@NotOnOrAfter`, `InResponseTo`, `Destination`, or replay-protect `Assertion/@ID` — in addition to the absent XML-DSig | Correctly dual-flagged off (`SAML_SSO_ENABLED` and `SAML_SIGNATURE_VERIFY_ENABLED` both `"false"`) and honestly documented, so not exploitable today. But it is one `wrangler.toml` line from full authentication bypass with nothing mechanical preventing that flip, and regex XML parsing remains vulnerable to XML Signature Wrapping even after DSig lands. Add a test that fails if the flags are true without a `verifyAssertionSignature` implementation; use a real parser with C14N; consider moving the module out of `main` until it ships |
| DD-40 | Data | Only 3 uses of `DB.batch()` repository-wide | Med | High | D1 has no interactive transactions — `batch()` is the only atomicity primitive. It appears in `session-room-townhall-handler.ts:415`, `sessions/wizard-questions.ts:209`, `gamification.ts:195` | Multi-statement writes elsewhere are non-atomic: a mid-sequence failure leaves partial state. Beyond DD-12, audit every multi-write sequence (team member add + role grant + audit row; Stripe plan set + entitlement write) and wrap each in `batch()` |

---

## What is verifiably sound

Recorded so a refactor does not destroy it. Each item was tested, not assumed.

- **SQL injection: zero instances.** All 19 dynamic-SQL sites interpolate *structure only* (column lists, `SET` fragments, placeholder ordinals) built from fixed field names; every value passes through `.bind()`. Consistently applied across 36 tables and 395 routes.
- **XSS: zero sinks.** No `dangerouslySetInnerHTML`, `innerHTML =`, `eval`, or `new Function` anywhere in `src/` or `functions/`.
- **Password storage is exemplary.** PBKDF2-SHA256 at 600k iterations (OWASP 2023 minimum), 16-byte salt, self-describing hash format, transparent upgrade-on-login for legacy hashes.
- **SSRF filtering is above market standard.** `lib/webhook-url.ts` `normalizeIpv4()` handles decimal, hex, octal and short-form IPv4 plus IPv4-mapped IPv6, correctly blocking `169.254.169.254`. Most implementations check dotted-quad only.
- **Stripe webhook verification is correct.** Multiple `v1` signatures during rotation, bidirectional tolerance window, event-ID idempotency in D1.
- **The Durable Object trust boundary is not spoofable.** `routes/sessions/public.ts:136-145` constructs a *fresh* header object for the DO fetch rather than forwarding the client request, so `x-qesto-role`, `x-qesto-voter` and `x-qesto-permissions` cannot be injected. The explicit revocation re-check on the presenter path (lines 104-110) shows deliberate reasoning.
- **JWT implementation resists algorithm confusion.** The header is pre-computed and compared byte-for-byte (`jwt.ts:HEADER_B64`), so `alg: none` and `alg` substitution are structurally impossible. Constant-time signature comparison; dual-secret rotation support.
- **Analytics consent is correctly gated.** Microsoft Clarity loads only after explicit acceptance (`useCookieConsent` → `loadClarity`); no tag in `index.html`.
- **GitHub Actions hygiene is strong.** Every action pinned to a full commit SHA; `permissions: contents: read` at workflow level throughout; **no `pull_request_target`** anywhere.
- **E2E genuinely gates merges.** `playwright.yml` runs the smoke lane on PRs and the full suite on `main` — a real gate, unlike the security lanes.
- **Architecture ratchets work and do block.** `check-kv-access`, `check-d1-access`, `check-ai-gateway`, `check-error-response`, `check-no-any`, `check-test-traceability` count anti-patterns and fail on growth. The mechanism is sound; it is simply not applied to security.
- **Code hygiene is top decile.** 2 TODOs, 0 `@ts-ignore`, 26 `any`, 10 `as unknown as` across 104k lines; `tsc --noEmit` clean; 2,706/2,706 tests green.
- **No license risk.** 472 packages: 402 MIT, 28 Apache-2.0, 28 ISC. All copyleft (2 LGPL-3.0 via `sharp`, 4 MPL-2.0 via `lightningcss`/`axe-core`) is confined to devDependencies and is not distributed. `UNLICENSED` is the project itself, correct for private code.
- **No committed secrets.** Pattern sweep across all tracked files found only documentation examples and the redaction patterns themselves.
- **Documentation is unusually self-critical.** Comments actively flag the codebase's own weaknesses — the vitest threshold bug, the CSRF residual risk, the SAML vulnerability, the July D1 incident. This is rare and materially accelerated this audit.

---

# PART II — ASSESSMENT

# Executive Summary

Qesto is a well-crafted application sitting inside an ungoverned delivery process. The distinction matters, because the two require entirely different remediation.

The **craft** is genuinely good and better than most codebases at this stage: zero SQL injection across 19 dynamic-query sites, zero XSS sinks, exemplary password storage, an SSRF filter that beats the market standard, a JWT implementation structurally immune to algorithm confusion, and a Durable Object trust boundary that correctly refuses to forward client headers. TypeScript is clean, 2,706 tests pass, and the codebase carries 2 TODOs and zero `@ts-ignore` across 104k lines. This is not a team that does not know how to build software.

The **governance** is where this fails due diligence. Not one security control in CI can fail a build: `npm audit || true`, gitleaks with `--exit-code 0`, CodeQL with `continue-on-error` on a private repo without the licence that would make it function, and a "provenance check" that is mathematically incapable of passing. Production deploys bypass GitHub Actions entirely through Cloudflare Git integrations that exist only as dashboard state — demonstrated during this audit, when a documentation-only commit deployed the production API with zero tests executed. And the remediation that *does* get proposed sits unmerged: the Hono security bump has been open **fifteen days**, blocked behind a single human reviewer who is simultaneously the bottleneck for sixteen Dependabot PRs.

Three findings would individually stop an enterprise procurement. **DD-03**: the "anonymous" voter identifier is an unsalted, 32-bit-truncated SHA-256 of the client IP, persisted with every vote in every anonymity mode including `zero_knowledge` — exhaustively reversible, and the schema comment asserting it is "never PII" is simply wrong. **DD-04**: there is no MFA anywhere, while the single-factor 14-day session guards user impersonation, audit export and cross-tenant forensics. **DD-07**: the RBAC matrix is computed and then discarded for everything except platform-admin routes, leaving forty entries that assert protection that does not exist.

Underlying all of it is scope. 395 routes across 84 modules — SCIM, LDAP, SAML, federation, multi-region, sovereign, marketplace payouts, XR — in a product at `version 0.1.0` with 30% branch coverage and one maintainer. The surface area has outrun the capacity to secure, test, review and operate it, and every finding in this report is made worse by that ratio.

**Verdict: not production-ready for enterprise sale.** The engineering foundation is sound and the remediation path is short — most Critical findings are configuration changes, not rewrites. The organisational constraint (single maintainer, single reviewer, unbounded scope) is the harder problem and will not be solved by code.

---

# Top Critical Risks

| # | Risk | Finding | Why it ranks here |
|---|---|---|---|
| 1 | **Security fixes cannot reach production** | DD-01 | Detection works; remediation is deadlocked on one reviewer for 15+ days. Unbounded MTTR. Makes every other finding permanent by default. |
| 2 | **"Anonymous" votes are reversible to IP** | DD-03 | Breaks the core product promise, contradicts the code's own documentation, and creates direct GDPR Art. 5/25/32 exposure on the most sensitive use cases the product invites. |
| 3 | **No security gate can fail a build** | DD-02 | Elaborate tooling that cannot block anything. Worse than no tooling — it converts a control gap into a control *misrepresentation*. |
| 4 | **Production deploys bypass all gates** | DD-08 | No enforceable change control; untested code ships; production cannot report its own commit. Demonstrated live during this audit. |
| 5 | **Single-factor access to the admin plane** | DD-04 | One password protects impersonation, audit export and cross-tenant forensics for 14 days. Enterprise-blocking and breach-enabling. |
| 6 | **Authorization asserted but not enforced** | DD-07 | 40 matrix entries provide false assurance to every future author. The canonical setup for a post-review breach. |

---

# Scores

Scored as an external auditor against enterprise pre-production expectations, not against startup norms. 100 = no material findings.

| Dimension | Score | Rationale |
|---|---:|---|
| **Security** | **52 / 100** | Excellent primitives (crypto, SQL, XSS, SSRF, JWT) heavily offset by systemic enforcement failure: no MFA, dead RBAC, fail-open rate limiting, reversible "anonymous" identifiers, session persistence after password reset. The building blocks score ~85; their governance scores ~25. |
| **Architecture** | **58 / 100** | Edge-first design is correct and the DO model is sound. Undermined by security-significant middleware ordering with nothing enforcing it, 8 circular dependencies including one inverting the authz layer, no pagination strategy, and scope far beyond what the team can sustain. |
| **Code Quality** | **74 / 100** | The strongest dimension and genuinely above market: clean types, negligible `any`, almost no dead code or TODOs, disciplined error envelopes, working architecture ratchets. Held back by route-layer duplication, large modules, and coverage that does not match the test count. |
| **DevOps Maturity** | **38 / 100** | Actions are SHA-pinned with least-privilege permissions and E2E genuinely gates merges — real strengths. But zero blocking security gates, a permanently-failing post-deploy health check, deploys outside the pipeline, no environment separation, and infrastructure existing only as dashboard clickops. |
| **Operational Readiness** | **41 / 100** | Good tracing and Analytics Engine instrumentation. Against that: production cannot report its running commit, the health check is broken in both directions, the cron ceiling is already hit, no documented rollback, no DR for the control plane, and no load/stress testing in CI. |
| **Technical Debt** | **55 / 100** | (100 = debt-free.) Debt is unusually *well-documented* — the team knows and records it, which is worth real credit. But it is accumulating faster than it is retired: 395 routes at 30% branch coverage, 27 open PRs, ARCH-HONO-01/02 open since a July incident. |

**Composite: 53 / 100** — *Conditional pass contingent on the 30-day plan.* The technical foundation supports remediation; the process does not currently support sustaining it.

---

# Top Quick Wins (< 1 day)

Highest risk reduction per hour. All are configuration or single-file changes.

| # | Action | Finding | Effort | Effect |
|---|---|---|---:|---|
| 1 | Merge PRs #839, #862, #861 | DD-01, DD-19 | 15 min | Closes every open production advisory |
| 2 | `RATE_LIMIT_FAIL_CLOSED = "true"` | DD-06 | 5 min | Removes the PBKDF2 CPU-DoS amplifier |
| 3 | `sourcemap: 'hidden'` | DD-15 | 5 min | Stops publishing full application source |
| 4 | Remove `|| true` and set `--exit-code 1` in `supply-chain.sh` | DD-02 | 30 min | Security scanners become capable of failing |
| 5 | Fix the health-check contract (handler + `jq` paths) | DD-08 | 1 h | Post-deploy verification stops failing on every release |
| 6 | Rate-limit `/password/reset-request` + `waitUntil` the email | DD-11 | 1 h | Closes the mail-bomb and timing-enumeration oracle |
| 7 | `ATOMIC_RATE_LIMIT_ENABLED = "true"` | DD-06 | 15 min | Activates the 11 already-provisioned limiter bindings |
| 8 | Add `base-uri 'self'; object-src 'none'` to the SPA CSP | DD-27 | 5 min | Defense-in-depth parity with the API CSP |
| 9 | Move `jankurai-workspace` to `devDependencies`; drop 3 unused Capacitor packages | DD-29 | 15 min | Shrinks the production install surface |
| 10 | Enable Dependabot **security** updates; delete branches on merge | DD-01, DD-30 | 10 min | Security bumps stop competing with routine version bumps |

**Total: under one working day for six of the twelve highest-severity findings.**

---

# 30-Day Improvement Plan

**Objective: make the pipeline capable of enforcing, and close the auth-integrity gaps.**

*Week 1 — Restore enforcement*
1. All ten Quick Wins above.
2. Dependabot auto-merge for patch/minor with green CI (DD-01) — removes the human bottleneck permanently.
3. Register `ci`, `playwright`, and the supply-chain lane as **required status checks** in branch protection; publish the actual ruleset and reconcile the stale CODEOWNERS claim (DD-02, DD-31).
4. Replace CodeQL with Semgrep OSS or enable GHAS; drop `continue-on-error` (DD-02).

*Week 2 — One governed deploy path*
5. Disable both Cloudflare Git integrations; deploy from Actions, API before frontend, under `environment: production` (DD-08).
6. Commit real `COMMIT_SHA`; make `/api/version` truthful and `verify-deploy.mjs` satisfiable (DD-08).
7. Add `[env.staging]` / `[env.dev]`; delete the `apiIsLocal` CSRF heuristic (DD-20).
8. Document the Cloudflare dashboard state as reviewed configuration (DD-20).

*Week 3 — Authentication integrity*
9. `sessions_valid_from` epoch; invalidate on password reset, password change, email change (DD-09).
10. Email verification with a scoped pre-verification session (DD-10).
11. TOTP for `platform_admin` and team `owner`; reduce JWT TTL to 24 h with refresh rotation (DD-04).
12. Separate `IMPERSONATION_SECRET`, 30-minute cap, server-side impersonation registry (DD-23).
13. Deploy-time gate making SAML activation impossible without DSig verification (DD-39).

*Week 4 — Privacy remediation*
14. Per-session HMAC salt for voter identity; full-length digest; no linkable identifier in `zero_knowledge` (DD-03).
15. Migration decision and execution for existing `votes.voter_id` rows.
16. Correct `schema.sql:176` and all privacy documentation.
17. Batch the vote flush; add a 500-voter load test (DD-12).

**Exit criteria:** every Critical closed; no security scanner can pass while failing; one auditable deploy path; production reports its commit; MFA on all privileged roles.

---

# 90-Day Improvement Plan

**Objective: make the architecture sustainable at the chosen scope.**

*Days 31-60 — Structural correctness*
18. Resolve DD-07: make RBAC honest (rename to `platformAdminGuard`, drop the 40 inert entries) and add the route-authorization coverage test that fails when a new route lacks a gate.
19. Resolve DD-22: hoist auth/plan to a single `/api/*` registration with an explicit public allowlist, removing order-dependence.
20. Replace the email-based `SEED_ADMIN_EMAIL` / `SUPERUSER_EMAIL` backdoors with real `user_roles` rows carrying an audit trail.
21. Break the 8 circular dependencies; add `madge --circular` as a ratchet at 8 (DD-13).
22. Cache plan/roles (JWT claims or 60 s KV) — eliminates 2 of 3 per-request lookups (DD-16).
23. Throttle `lastUsedAt`; move API usage metering to Analytics Engine (DD-17).

*Days 61-90 — API governance and assurance*
24. Generate OpenAPI from routes via `@hono/zod-openapi`; replace the tautological drift check with a route-coverage gate; document all 25 public endpoints (DD-05).
25. Shared keyset pagination helper applied across list endpoints; ratchet unbounded `.all<>()` down from 117 (DD-14).
26. Per-glob coverage thresholds at 90% branches on middleware and security-critical libs (DD-18).
27. Nightly stress + k6 load lanes in CI with the DD-12 assertion (DD-18).
28. Move background jobs to Cloudflare Queues; clear the cron ceiling (DD-32).
29. Audit every multi-statement write for `DB.batch()` atomicity (DD-40).
30. Document rollback, DR and the control-plane recovery procedure; test a restore.

---

# Strategic Recommendations

**1. Fix the constraint before the code.** Every technical finding here is tractable; the binding constraint is a single maintainer who is also the single reviewer of 27 open PRs. No remediation plan survives that. Either add a second reviewer with merge rights, or automate the classes of change that do not need human judgment (dependency patches, generated files) — and accept that these are the only two options. Adding more code to an already-deadlocked queue makes things worse.

**2. Cut scope deliberately; it is the root cause.** 395 routes across 84 modules at `version 0.1.0` with 30% branch coverage. SCIM, LDAP, SAML, federation, multi-region, sovereign, marketplace payouts, XR and three public API versions exist for a product that has not shipped v1. Every finding here is amplified by that ratio: more attack surface than can be reviewed, more code than can be tested, more routes than the RBAC layer covers. Gate every module without a paying customer behind the existing `EPIC-VALID` mechanism (ADR-0064), remove them from `app.ts`, and exclude them from the RC gate. The work is not lost; the production surface shrinks immediately.

**3. Decide C-1's migration on legal advice, not engineering preference.** Existing `votes.voter_id` rows carry the reversible hash. Three options with materially different exposure: (a) rewrite in place with a per-session salt — preserves analytics, costs a migration; (b) null the column on closed sessions — cheapest, loses historical dedupe; (c) accept and document — requires a DPIA and likely a customer disclosure. This is a legal and product decision. Engineering should present the options, not choose.

**4. Treat "no MFA" as a revenue blocker, not a backlog item.** It is a hard fail in essentially every enterprise questionnaire and a prerequisite for SOC 2 CC6.1. At ~80 lines of dependency-free WebCrypto (DD-04), it is among the highest revenue-per-line changes available.

**5. Make infrastructure reviewable.** The Cloudflare Git integration was invisible to every prior audit in this directory — including the first pass of this one — and surfaced only because this engagement opened a PR and watched the deploy bot. Branch protection, Environment reviewers, Dependabot settings, WAF rules and the build command are all in the same category. Whatever cannot be moved to Terraform must at minimum be documented as PR-reviewed configuration, or the repository will keep disagreeing with reality.

**6. Preserve what works.** The architecture ratchets (`check-kv-access`, `check-no-any`, `check-test-traceability`) are a genuinely good mechanism that already blocks merges. The gap is that this mechanism was never applied to security. Extend it rather than inventing something new: ratchet circular dependencies, unbounded queries, undocumented routes and missing auth gates exactly as the existing anti-pattern counters work.

**7. Keep writing honest comments.** The self-critical documentation — the vitest threshold bug, the CSRF residual risk, the SAML caveat, the July D1 incident — measurably accelerated this audit and is a real cultural asset. The failure mode to avoid is documenting a risk *instead of* fixing it; SAML (DD-39) is the clearest instance, where an excellent write-up sits next to an unmitigated one-line path to authentication bypass.

---

# Prioritized Remediation Roadmap

| Pri | Finding | Severity | Effort | Risk reduction | Window |
|---:|---|---|---|---|---|
| **P0** | DD-01 Remediation deadlock | Critical | S | Very High | Week 1 |
| **P0** | DD-02 No blocking security gates | Critical | S | Very High | Week 1 |
| **P0** | DD-19 Merge Hono/js-yaml/sharp bumps | Medium | XS | High | Day 1 |
| **P0** | DD-06 Fail-open rate limiting | High | XS | High | Day 1 |
| **P0** | DD-15 Public source maps | Medium | XS | Medium | Day 1 |
| **P1** | DD-08 Ungated deploy path | High | M | Very High | Week 2 |
| **P1** | DD-09 Reset does not revoke sessions | High | S | High | Week 3 |
| **P1** | DD-11 Unlimited reset requests | High | XS | Medium | Day 1 |
| **P1** | DD-10 No email verification | High | M | High | Week 3 |
| **P1** | DD-04 No MFA | High | M | Very High | Week 3 |
| **P1** | DD-03 Reversible voter identity | Critical | L | Very High | Week 4 |
| **P1** | DD-39 SAML activation guard | Medium | S | High (latent) | Week 3 |
| **P2** | DD-07 Dead RBAC enforcement | High | M | High | Days 31-45 |
| **P2** | DD-22 Order-dependent auth | Medium | M | Medium | Days 31-45 |
| **P2** | DD-23 Impersonation key separation | Medium | S | Medium | Days 31-45 |
| **P2** | DD-12 Vote flush batching | High | S | High | Week 4 |
| **P2** | DD-16 Per-request DB lookups | Medium | M | Medium | Days 46-60 |
| **P2** | DD-17 KV write per API request | Medium | XS | Medium | Days 46-60 |
| **P2** | DD-13 Circular dependencies | Medium | M | Medium | Days 46-60 |
| **P3** | DD-05 Empty OpenAPI contract | High | L | Medium | Days 61-90 |
| **P3** | DD-14 No pagination | Medium | L | Medium | Days 61-90 |
| **P3** | DD-18 Coverage floors | Medium | L | Medium | Days 61-90 |
| **P3** | DD-20 Undocumented infrastructure | Medium | M | Medium | Week 2 + ongoing |
| **P3** | DD-25 Preview origins trusted | Medium | S | Medium | Days 61-90 |
| **P3** | DD-32 Cron ceiling | Low | M | Low | Days 61-90 |
| **P3** | DD-40 Missing write atomicity | Medium | M | Medium | Days 61-90 |
| **P4** | DD-24, 26, 27, 28, 29, 30, 31, 33-38 | Low-Med | XS-S | Low | Opportunistic |

*Effort: XS < 1 h · S < 1 day · M 1-3 days · L 1-2 weeks*

---

## Auditor's note on evidence and revisions

Every finding cites a file path with line numbers, a command and its output, or a GitHub API response captured during this engagement. Nothing is asserted from pattern-matching against common failure modes.

Three findings changed materially from the first pass and are flagged in place:

- **DD-08** originally read "the API deploy is manual." That was **wrong**. The Cloudflare Workers Builds Git integration disproved it — discovered only because this audit's own PR triggered the deploy bot. The corrected finding is more serious than the original.
- **DD-19** originally treated three Hono advisories as live risk. Applicability testing against actual imports shows **one of four** applies. Stated precisely rather than inflated.
- **DD-31** records that `main` **is** protected per the GitHub API, contradicting both the repository's own CODEOWNERS comment and the July 2026 infrastructure audit. The repository's documentation is stale; the rule detail remains unverifiable without dashboard access.

Findings dependent on configuration this engagement could not read — branch-protection rule detail, Environment reviewers, Dependabot security-update state, WAF configuration, the Workers Builds command, and the secret inventory — are marked **Confidence: Medium** and state their assumption explicitly. They should be confirmed in the respective dashboards before triage.
