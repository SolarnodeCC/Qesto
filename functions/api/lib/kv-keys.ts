// Central KV key builders — audit workstream PR-C / F-05 (avoid scattered string literals).

/** User preferences blob in USERS_KV. */
export function userPrefsKey(userId: string): string {
  return `prefs:${userId}`
}

/** Monthly session-create quota record in SESSIONS_KV (see lib/quota.ts). */
export function quotaSessionsKey(userId: string, monthYYYYMM: string): string {
  return `quota:sessions:${userId}:${monthYYYYMM}`
}

/** Team JSON document in TEAMS_KV. */
export function teamDocumentKey(teamId: string): string {
  return `team:${teamId}`
}

/** Reverse index: team IDs for a user (TEAMS_KV). */
export function userTeamsIndexKey(userId: string): string {
  return `user-teams:${userId}`
}

/** Pending invite payload keyed by hashed token (TEAMS_KV, TTL). */
export function teamInviteKey(tokenHash: string): string {
  return `team-invite:${tokenHash}`
}

// ─── Ephemeral HTTP-layer caches (see middleware/kv-cache.ts) ───────────────

export function cachePlanUsageKey(userId: string): string {
  return `cache:plan:${userId}`
}

export function cacheTeamMetadataKey(teamId: string): string {
  return `cache:team:${teamId}`
}

export function cacheUserRolesKey(userId: string): string {
  return `cache:roles:${userId}`
}

export function cacheLeaderboardKey(sessionId: string): string {
  return `cache:leaderboard:${sessionId}`
}
