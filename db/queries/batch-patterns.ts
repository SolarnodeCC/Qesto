/**
 * Batch read patterns for D1 — parameterized SQL templates (db layer only).
 */

const inClause = (count: number) => Array.from({ length: count }, () => '?').join(',')

export const batchQueryPatterns = {
  fetchQuestionsBatch: (sessionIds: string[]) =>
    `SELECT * FROM questions WHERE session_id IN (${inClause(sessionIds.length)}) ORDER BY position`,

  aggregateVotesBatch: (questionIds: string[]) =>
    `SELECT question_id, option_id, COUNT(*) as count
     FROM votes WHERE question_id IN (${inClause(questionIds.length)})
     GROUP BY question_id, option_id`,

  countParticipantsBatch: (sessionIds: string[]) =>
    `SELECT session_id, COUNT(DISTINCT voter_id) as participant_count
     FROM votes WHERE session_id IN (${inClause(sessionIds.length)})
     GROUP BY session_id`,
}
