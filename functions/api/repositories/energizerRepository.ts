/**
 * energizerRepository.ts
 * Repository layer (ADR-0069) for energizer rows needed by the REST↔DO sync
 * path (audit E-2): after the host PATCHes an energizer active, the route
 * re-reads the row here to build the LiveEnergizerState projection posted to
 * the SessionRoom DO.
 */

import type { EnergizerRow } from '../lib/db-row-types'

/**
 * Resolve an energizer to its owning session.
 *
 * Authorization-only lookup: `bracket_matches` and friends key on
 * `energizer_id`, which carries no tenant, so callers walk the row back to a
 * session before running an access check. Returns null when the energizer does
 * not exist.
 */
export async function getSessionIdForEnergizer(
  db: D1Database,
  energizerId: string,
): Promise<string | null> {
  const row = await db
    .prepare(`SELECT session_id FROM energizers WHERE id = ?1`)
    .bind(energizerId)
    .first<{ session_id: string }>()
  return row?.session_id ?? null
}

/** Resolve a bracket match to its owning energizer (authorization lookup). */
export async function getEnergizerIdForBracketMatch(
  db: D1Database,
  matchId: string,
): Promise<string | null> {
  const row = await db
    .prepare(`SELECT energizer_id FROM bracket_matches WHERE id = ?1`)
    .bind(matchId)
    .first<{ energizer_id: string }>()
  return row?.energizer_id ?? null
}

export async function getEnergizerById(
  db: D1Database,
  sessionId: string,
  energizerId: string,
): Promise<EnergizerRow | null> {
  return await db
    .prepare(
      `SELECT id, session_id, kind, prompt, options_json, config_json, position, state, created_at, updated_at
         FROM energizers
        WHERE id = ?1 AND session_id = ?2`,
    )
    .bind(energizerId, sessionId)
    .first<EnergizerRow>()
}
