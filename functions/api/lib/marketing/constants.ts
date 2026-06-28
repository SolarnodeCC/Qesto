/** Shared constants across the marketing automation modules. */

// Single-owner tool — all three platforms' EncryptedTokenStore tokens share
// this fixed pseudo-team id (mirrors linkedin.ts's LINKEDIN_TEAM_SCOPE).
export const MARKETING_TEAM_SCOPE = 'qesto-org'

export const MENTION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000 // GDPR: 90 days

export type MarketingPlatform = 'linkedin' | 'reddit' | 'youtube'
