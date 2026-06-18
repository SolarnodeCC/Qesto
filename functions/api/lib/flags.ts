/**
 * flags.ts — Typed feature flag helpers.
 *
 * Replaces scattered `env.FEATURE_NAME === 'true'` string comparisons with a
 * single typed accessor. Adding a new flag: (1) add it to FlagName, (2) check
 * wrangler.toml [vars] has a default, (3) call getFlag(env, 'NEW_FLAG').
 *
 * See TECH_DEBT_AUDIT_2026-05.md TD-06.
 */

import type { Env } from '../types'

/** Union of all boolean feature flags backed by string env vars. */
export type FlagName =
  | 'CIRCUIT_BREAKER_ENABLED'
  | 'INTEGRATION_ENABLED'
  | 'LIVE_ENERGIZERS_ENABLED'
  | 'MULTI_REGION_ENABLED'
  | 'MULTI_REGION_FAILOVER_ENABLED'
  | 'MULTI_REGION_WRITES_ENABLED'
  | 'RATE_LIMIT_FAIL_CLOSED'
  | 'REALTIME_TOWNHALL_ENABLED'
  | 'REALTIME_V2_DEFAULT'
  | 'REALTIME_V2_ENABLED'
  | 'REALTIME_V3_ENABLED'
  | 'SENTIMENT_ENABLED'
  // BETA_XR_ENABLED (ADR-0066): XR spatial/immersive session beta kill-switch.
  // OFF by default; additive on protocol v3 (no version bump). When off, the DO
  // ignores inbound xr_avatar_sync and omits the 'xr' init feature capability.
  | 'BETA_XR_ENABLED'
  | 'JOIN_CAPTCHA_ENABLED'
  | 'LDAP_SYNC_MOCK'
  // SEC-SAML-01 (#529): SAML SSO is OFF unless explicitly enabled. The SP does
  // not yet verify the XML-DSig signature on the assertion, so the routes must
  // remain disabled (503) in production until signature verification ships.
  | 'SAML_SSO_ENABLED'

/**
 * Read a boolean feature flag from the environment.
 * Returns true when the env var equals `'true'` (case-sensitive).
 * Returns false for `'false'`, missing, or any other value.
 */
export function getFlag(env: Env | Record<string, string | undefined>, flag: FlagName): boolean {
  return (env as Record<string, string | undefined>)[flag] === 'true'
}

/**
 * Inverse of getFlag — returns true when the flag is NOT 'true'.
 * Convenience for guard clauses: `if (flagOff(env, 'FEATURE')) return ...`
 */
export function flagOff(env: Env | Record<string, string | undefined>, flag: FlagName): boolean {
  return !getFlag(env, flag)
}
