/** Shared auth timings — keep cookie `maxAge` and JWT TTL aligned. */
export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000 // 15 min
export const JWT_TTL_SECONDS = 14 * 24 * 60 * 60 // 14 days
export const PASSWORD_RESET_TTL_SECONDS = 60 * 60 // 1 hour

/** Magic-link request rate limits (abuse + cost control for Resend). */
export const MAGIC_LINK_WINDOW_SECONDS = 15 * 60
export const MAGIC_LINK_MAX_PER_IP = 10
export const MAGIC_LINK_MAX_PER_EMAIL = 5
