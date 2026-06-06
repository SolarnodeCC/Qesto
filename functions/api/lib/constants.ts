export const PREFS_TTL_SECONDS = 365 * 24 * 60 * 60
export const TEAM_INVITE_TTL_SECONDS = 24 * 60 * 60
export const OAUTH_STATE_TTL_SECONDS = 10 * 60
export const SAML_STATE_TTL_SECONDS = 5 * 60

// ── KV TTL constants ─────────────────────────────────────────────────────────
// Single source of truth for all KV expiration durations.
// See TECH_DEBT_AUDIT_2026-05.md TD-12.

export const ONE_HOUR_SECONDS = 60 * 60
export const ONE_DAY_SECONDS = 24 * 60 * 60
export const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60
export const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60
export const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60
export const FORTY_FIVE_DAYS_SECONDS = 45 * 24 * 60 * 60
export const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60
export const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60

/** Integration OAuth token store TTL (90 days). */
export const INTEGRATION_TOKEN_TTL_SECONDS = NINETY_DAYS_SECONDS
/** Coaching profile store TTL (90 days). */
export const COACHING_PROFILE_TTL_SECONDS = NINETY_DAYS_SECONDS
/** PWA push subscription TTL (90 days). */
export const PWA_PUSH_TTL_SECONDS = NINETY_DAYS_SECONDS
/** Webhook DLQ entry TTL (7 days). */
export const WEBHOOK_DLQ_TTL_SECONDS = SEVEN_DAYS_SECONDS
/** Cross-region session mirror TTL (1 hour). */
export const CROSS_REGION_MIRROR_TTL_SECONDS = ONE_HOUR_SECONDS
/** Copilot context and thread cache TTL (1 hour and 1 day). */
export const COPILOT_CONTEXT_TTL_SECONDS = ONE_HOUR_SECONDS
export const COPILOT_THREAD_TTL_SECONDS = ONE_DAY_SECONDS
/** Short-lived session wizard draft TTL (1 day). */
export const WIZARD_DRAFT_TTL_SECONDS = ONE_DAY_SECONDS
/** Template KV TTL (1 year — templates are long-lived). */
export const TEMPLATE_TTL_SECONDS = ONE_YEAR_SECONDS
/** Tenant quota window TTL (2 days). */
export const TENANT_QUOTA_TTL_SECONDS = TWO_DAYS_SECONDS
/** Tenant burst lock TTL (25 hours — slightly over 1 day for safety). */
export const TENANT_BURST_LOCK_TTL_SECONDS = 90000
/** Tenant cost aggregation TTL (45 days). */
export const TENANT_COST_TTL_SECONDS = FORTY_FIVE_DAYS_SECONDS
/** AI coaching insights cache TTL (30 days). */
export const COACHING_INSIGHTS_TTL_SECONDS = THIRTY_DAYS_SECONDS
/** Webhook rate-limit window TTL (2 minutes). */
export const WEBHOOK_RATE_LIMIT_TTL_SECONDS = 120
/** Shared insights cache TTL (already defined per-route, unified here). */
export const INSIGHTS_SHARED_CACHE_TTL_SECONDS = ONE_HOUR_SECONDS
/** Templates marketing magic link TTL (1 hour). */
export const MARKETING_MAGIC_LINK_TTL_SECONDS = ONE_HOUR_SECONDS
/** Session mode seed cache in SESSIONS_KV (retro/ideate draft config). */
export const SESSION_SEED_TTL_SECONDS = SEVEN_DAYS_SECONDS
/** Partner OAuth client secret store TTL. */
export const PARTNER_SECRET_TTL_SECONDS = ONE_YEAR_SECONDS
/** Partner app registry metadata TTL. */
export const PARTNER_APP_TTL_SECONDS = ONE_YEAR_SECONDS
/** Team API key record TTL (active keys; refreshed on use). */
export const API_KEY_RECORD_TTL_SECONDS = ONE_YEAR_SECONDS
/** Revoked API key tombstone TTL. */
export const API_KEY_REVOKED_TTL_SECONDS = THIRTY_DAYS_SECONDS
/** API key hash→id index TTL (matches active key lifetime). */
export const API_KEY_HASH_INDEX_TTL_SECONDS = ONE_YEAR_SECONDS
