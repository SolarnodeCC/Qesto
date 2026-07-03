---
id: RUNBOOK-SESSION_ROOM_RECOVERY
type: runbook
category: incident
status: active
version: 1.0
created: 2026-07-03
updated: 2026-07-03
tags:
  - incident-response
  - operations
  - durable-objects
  - cloudflare-pages
relates_to:
  - SPEC_DEPLOYMENT
---

# Runbook: SESSION_ROOM Durable Object Binding Recovery

**Scope:** Every `POST /api/sessions/:id/start` fails deterministically for
every session and every mode, and the client stops retrying after one attempt
(the failure is correctly classified as non-retryable).

**Severity:** Critical — no session can go live. This is a total outage of the
core product loop, not a degraded-mode issue.

**First occurred / diagnosed:** INCIDENT-2026-07-03. See PRs #679, #680 for the
application-level hardening that makes this failure mode self-diagnosing
(before that work, it surfaced as an opaque, retried `do_init_failed`).

---

## 1. Identifying this incident

Symptoms:
- `POST /api/sessions/:id/start` returns **503** with `error.code = "do_unavailable"`
  and message *"The realtime service is currently unavailable. Please contact
  support if this persists."*
- The browser makes exactly **one** attempt — this code is intentionally absent
  from the client's `RETRYABLE_CODES` set (`src/api/client.ts`), so there is no
  retry storm. If you see 3x retries instead, the failure is a different,
  retryable `do_init_failed` — see §5.
- Every session ID and every session mode fails identically. This is the
  signature of a missing/broken **binding**, not a per-session data problem.

## 2. Diagnosis — confirm from logs, don't guess

```bash
npx wrangler pages deployment tail --project-name qesto
```

(Unset `CLOUDFLARE_API_TOKEN` first if you get an OAuth-login error — the
token blocks browser login. Use `--project-name`, not `--project`.)

Start a session while the tail is running. Look for this exact event:

```json
{"event":"do.binding_unavailable","session_id":"...","path":"/init",
 "errorClass":"DOBindingUnavailableError",
 "errorMessage":"SESSION_ROOM Durable Object binding is not available in this runtime"}
```

followed by:

```json
{"event":"session.start.do_network_error","deterministic":true,
 "errorClass":"DOBindingUnavailableError", ...}
{"level":"error","status":503,"error_code":"do_unavailable", ...}
```

**This confirms the root cause: `env.SESSION_ROOM` is not bound in the Pages
Functions runtime.** No further log digging is needed — proceed to §3.

If instead you see `session.start.do_failure` with a real `do_error_code` (not
a binding error), that's a different failure inside `SessionRoom.handleInit` —
not this runbook; check the DO's own logs for that code.

## 3. Why this happens — the binding is dashboard-only, not in git

- The `SessionRoom` **class** lives in the `qesto-api` **Worker**
  (`worker/index.ts` → `export { SessionRoom } from '../functions/api/SessionRoom'`),
  bound in that Worker's own `wrangler.toml` (repo root, `durable_objects.bindings`,
  no `script_name` needed — it's co-located).
- The code that actually calls it (`functions/api/routes/sessions/*`) runs in
  the **separate Cloudflare Pages project** `qesto`, deployed via a bare
  `wrangler pages deploy dist --project-name=qesto` CLI call
  (`.github/workflows/ci.yml`) with **no config file** — Pages picks up zero
  binding config from this repository.
- For a Pages project to reach a Durable Object class hosted in a different
  Worker, Cloudflare requires a **cross-script binding** with an explicit
  `script_name`. That binding can currently only be set in the **Cloudflare
  dashboard** for the Pages project — there is no wrangler.toml checked into
  this repo that governs it. If it's ever removed, unset, or never applied to
  a given environment, this exact outage recurs with no code change involved.

## 4. The fix

**Cloudflare Dashboard → Workers & Pages → `qesto` (the Pages project) →
Settings → Functions → Durable Object bindings → Add binding:**

| Field | Value |
|---|---|
| Variable name | `SESSION_ROOM` |
| Durable Object class | `SessionRoom` |
| Service (script_name) | `qesto-api` |
| Environment | Production |

Values must match `functions/api/types.ts` (`Env.SESSION_ROOM: DurableObjectNamespace`)
and the deployed Worker name (`wrangler.toml:1`, `name = "qesto-api"`) exactly.

**This requires a new Pages deployment to take effect** — bindings are baked
in at deploy time. Re-run the latest "build · deploy" GitHub Action, or:

```bash
npx wrangler pages deploy dist --project-name=qesto
```

For staging, the equivalent binding uses `script_name = "qesto-staging"`
against the `qesto-staging` Pages project.

## 5. Verify recovery

Re-run the tail command from §2 and start a session. A healthy request looks
like:

```json
{"event":"session.start.attempt", ...}
{"ts":"...","level":"info","method":"POST","path":"/api/sessions/.../start","status":200, ...}
```

with **no** `do.binding_unavailable` line at all.

## 6. Related, but different, failure modes

- **Retryable `do_init_failed` (500), 3x retries observed:** a transient
  `stub.fetch` rejection (e.g. Cloudflare-flagged `retryable: true`
  overload) — not this runbook. See `tests/unit/session-start-do-failure.test.ts`
  for the exact retry contract.
- **`do_init_error` (500) with a real `do_error_code`:** the DO was reachable
  and responded, but refused the init (e.g. `do_internal_error`) — a bug
  inside `SessionRoom.handleInit`, not a binding problem.
- **D1 errors (`D1_ERROR: ... object to be reset`, `plan lookup timed out`):**
  a separate infrastructure fault in the D1 layer, unrelated to this binding.
  See the 2026-07-03 incident PRs (#680, #681) for the D1-amplification fix
  and its regression test.
