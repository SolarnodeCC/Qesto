/** Shared constants across the marketing automation modules. */

// Single-owner tool — all three platforms' EncryptedTokenStore tokens share
// this fixed pseudo-team id (mirrors linkedin.ts's LINKEDIN_TEAM_SCOPE).
export const MARKETING_TEAM_SCOPE = 'qesto-org'

export const MENTION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000 // GDPR: 90 days

export type MarketingPlatform = 'linkedin' | 'reddit' | 'youtube'

// Manual, owner-triggered text-to-video generation for the Video Asset
// Library's 'other-recordings' category (never cron-invoked — see
// video-gen.ts). This allowlist is the injection/abuse guard: routes reject
// any model not in this set with 400 before ever invoking inference.
// Cloudflare does not publish per-video pricing for any of these models.
export const VIDEO_GEN_MODELS: { id: string; label: string }[] = [
  { id: '@cf/google/veo-3.1-fast', label: 'Google Veo 3.1 Fast' },
  { id: '@cf/google/veo-2', label: 'Google Veo 2' },
  { id: '@cf/pixverse/v6', label: 'PixVerse v6' },
  { id: '@cf/pixverse/v5.6', label: 'PixVerse v5.6' },
  { id: '@cf/minimax/hailuo-2.3', label: 'MiniMax Hailuo 2.3' },
  { id: '@cf/minimax/hailuo-2.3-fast', label: 'MiniMax Hailuo 2.3 Fast' },
  { id: '@cf/vidu/q3-pro', label: 'Vidu Q3 Pro' },
  { id: '@cf/vidu/q3-turbo', label: 'Vidu Q3 Turbo' },
]

export const VIDEO_GEN_MODEL_IDS: Set<string> = new Set(VIDEO_GEN_MODELS.map((m) => m.id))
