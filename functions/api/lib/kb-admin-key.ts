/**
 * Shared credential check for the KB sync write endpoints.
 *
 * Lives outside functions/api/routes because the error-envelope ratchet
 * (scripts/check-error-response.mjs, ADR-0069 sibling) counts inline
 * `ok: false` shapes in routes, and because this is policy rather than
 * routing — see routes/admin/kb-sync.ts for the callers.
 */
import { timingSafeEqual } from './shared/crypto'

/**
 * Minimum length for `KB_ADMIN_KEY`. The write endpoints below are the only
 * gate on a machine-to-machine credential (CI posts with `x-admin-key`, not a
 * user JWT), so a short or guessable key is the whole security boundary.
 * 32 chars ≈ 128 bits of base64/hex entropy.
 */
export const KB_ADMIN_KEY_MIN_LENGTH = 32

/**
 * Keys that were published in the repository (docs + import-vectors.ps1) and
 * must never authenticate again, regardless of length. Kept as an explicit
 * denylist so a deploy that still carries the leaked value fails closed and
 * loudly instead of silently accepting it.
 */
const KB_ADMIN_KEY_DENYLIST = new Set(['qesto-kb-admin-phase1'])

type KbAdminKeyCheck =
  | { ok: true }
  | { ok: false; status: 401 | 503; code: string; message: string }

/**
 * Validate the `x-admin-key` header against `KB_ADMIN_KEY`.
 *
 * Fails closed on misconfiguration (503) rather than on the caller (401), so a
 * deployment with a missing, too-short or previously-leaked key refuses to
 * serve instead of accepting whatever it was given. The comparison is
 * constant-time — the previous `!==` leaked the key one byte at a time to an
 * attacker who could measure response latency.
 */
export function checkKbAdminKey(provided: string | undefined, expected: string | undefined): KbAdminKeyCheck {
  if (!expected) {
    return {
      ok: false,
      status: 503,
      code: 'kb_admin_key_unset',
      message: 'KB_ADMIN_KEY is not configured — refusing to serve KB sync writes',
    }
  }
  if (expected.length < KB_ADMIN_KEY_MIN_LENGTH || KB_ADMIN_KEY_DENYLIST.has(expected)) {
    return {
      ok: false,
      status: 503,
      code: 'kb_admin_key_weak',
      message: `KB_ADMIN_KEY must be at least ${KB_ADMIN_KEY_MIN_LENGTH} characters and not a previously published value — rotate it`,
    }
  }
  if (!provided || !timingSafeEqual(provided, expected)) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'x-admin-key header required and must match KB_ADMIN_KEY',
    }
  }
  return { ok: true }
}
