/**
 * energizerRepository.ts
 * Repository layer (ADR-0069) for energizer rows needed by the REST↔DO sync
 * path (audit E-2): after the host PATCHes an energizer active, the route
 * re-reads the row here to build the LiveEnergizerState projection posted to
 * the SessionRoom DO.
 */

import type { EnergizerRow } from '../lib/db-row-types'

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
