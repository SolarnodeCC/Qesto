/**
 * GAM-06 — CSV export for admin engagement analytics.
 */
import { csvRow } from './csv'

export type EngagementCsvInput = {
  engagement: {
    energizer_activations: number
    energizer_participants: number
    energizer_completions: number
    energizer_dropouts: number
    leaderboard_participants: number
    badges_awarded: number
    ws_error_rate: number
    reconnect_rate: number
  }
  badge_breakdown: Array<{ kind: string; count: number }>
}

export function buildEngagementCsv(data: EngagementCsvInput): string {
  const lines: string[] = []
  lines.push(csvRow(['metric', 'value']))
  const e = data.engagement
  lines.push(csvRow(['energizer_activations', e.energizer_activations]))
  lines.push(csvRow(['energizer_participants', e.energizer_participants]))
  lines.push(csvRow(['energizer_completions', e.energizer_completions]))
  lines.push(csvRow(['energizer_dropouts', e.energizer_dropouts]))
  lines.push(csvRow(['leaderboard_participants', e.leaderboard_participants]))
  lines.push(csvRow(['badges_awarded', e.badges_awarded]))
  lines.push(csvRow(['ws_error_rate', e.ws_error_rate]))
  lines.push(csvRow(['reconnect_rate', e.reconnect_rate]))
  lines.push('')
  lines.push(csvRow(['badge_kind', 'count']))
  for (const row of data.badge_breakdown) {
    lines.push(csvRow([row.kind, row.count]))
  }
  return lines.join('\n') + '\n'
}
