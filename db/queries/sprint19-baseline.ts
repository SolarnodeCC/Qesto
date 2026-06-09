import type { D1Database } from '@cloudflare/workers-types'

export type Sprint19Range = { startMs: number | null; endMs: number }

function bindRange(db: D1Database, sql: string, range: Sprint19Range) {
  const stmt = db.prepare(sql)
  return range.startMs === null ? stmt : stmt.bind(range.startMs, range.endMs)
}

export async function fetchSprint19BaselineRows(db: D1Database, range: Sprint19Range) {
  const where = range.startMs === null ? '' : 'WHERE created_at >= ?1 AND created_at <= ?2'
  const journeyWhere = range.startMs === null ? '' : 'WHERE created_at >= ?1 AND created_at <= ?2'
  const andOrWhere = where ? ' AND' : ' WHERE'

  const [
    totalRes,
    aiGeneratedRes,
    aiConsentRes,
    aiGroundingRes,
    startedRes,
    draftRes,
    aiSuggestionRes,
    journeyRes,
  ] = await Promise.all([
    bindRange(db, `SELECT COUNT(*) as n FROM sessions ${where}`, range).first<{ n: number }>(),
    bindRange(db, `SELECT COUNT(*) as n FROM sessions ${where}${andOrWhere} ai_generated = 1`, range).first<{ n: number }>(),
    bindRange(db, `SELECT COUNT(*) as n FROM sessions ${where}${andOrWhere} ai_consent_at IS NOT NULL`, range).first<{ n: number }>(),
    bindRange(db, `SELECT COUNT(*) as n FROM sessions ${where}${andOrWhere} ai_grounding_hash IS NOT NULL`, range).first<{ n: number }>(),
    bindRange(db, `SELECT COUNT(*) as n FROM sessions ${where}${andOrWhere} status IN ('live','closed','archived')`, range).first<{ n: number }>(),
    bindRange(db, `SELECT COUNT(*) as n FROM sessions ${where}${andOrWhere} status = 'draft'`, range).first<{ n: number }>(),
    bindRange(
      db,
      `SELECT COALESCE(SUM(ai_accepted_count), 0) as accepted, COALESCE(SUM(ai_dismissed_count), 0) as dismissed FROM sessions ${where}${andOrWhere} ai_generated = 1`,
      range,
    ).first<{ accepted: number; dismissed: number }>(),
    bindRange(db, `SELECT event_name, COUNT(*) as n FROM sprint19_events ${journeyWhere} GROUP BY event_name`, range).all<{
      event_name: string
      n: number
    }>(),
  ])

  return {
    totalRes,
    aiGeneratedRes,
    aiConsentRes,
    aiGroundingRes,
    startedRes,
    draftRes,
    aiSuggestionRes,
    journeyRes,
  }
}
