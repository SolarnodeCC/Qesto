/**
 * energizer-live-projection.ts
 * Maps a D1 energizer row (host-managed config, snake_case) to the
 * LiveEnergizerState shape the SessionRoom DO broadcasts (audit E-2: the DO
 * WebSocket is the single participant-facing energizer plane; the REST layer
 * posts this projection to `/energizer-sync` on host activation).
 *
 * Only the four lobby kinds are projected — bracket / battle_royale are
 * WS-native tournament features with their own activation path.
 */

import type { LiveEnergizerState } from '../realtime'
import type { EnergizerRow } from './db-row-types'
import {
  validateData,
  EmojiPollConfigSchema,
  QuickFingerConfigSchema,
  TeamQuizConfigSchema,
  WordCloudConfigSchema,
} from './protocol-schemas'

export function buildLiveEnergizerFromRow(row: EnergizerRow): LiveEnergizerState | null {
  let config: unknown
  try {
    config = JSON.parse(row.config_json)
  } catch {
    return null
  }

  const base = { id: row.id, title: row.prompt, prompt: row.prompt, status: 'active' as const }

  if (row.kind === 'emoji_poll') {
    const parsed = validateData(config, EmojiPollConfigSchema)
    if (!parsed || parsed.emojis.length === 0) return null
    return { ...base, kind: 'emoji_poll', options: parsed.emojis }
  }
  if (row.kind === 'quick_finger') {
    const parsed = validateData(config, QuickFingerConfigSchema)
    if (!parsed || parsed.options.length < 2) return null
    return { ...base, kind: 'quick_finger', options: parsed.options, correctIndex: parsed.correct_index }
  }
  if (row.kind === 'team_quiz') {
    const parsed = validateData(config, TeamQuizConfigSchema)
    if (!parsed || parsed.questions.length === 0) return null
    return {
      ...base,
      kind: 'team_quiz',
      questions: parsed.questions.map((q) => ({
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correct_index,
      })),
      currentIndex: Math.max(0, parsed.current_index),
    }
  }
  if (row.kind === 'word_cloud') {
    const parsed = validateData(config, WordCloudConfigSchema)
    if (!parsed) return null
    return { ...base, kind: 'word_cloud' }
  }
  return null
}
