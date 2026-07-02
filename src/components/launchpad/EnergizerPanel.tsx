import { Zap } from 'lucide-react'
import EmojiPollEnergizerView, { type EmojiPollEnergizer } from '../EmojiPollEnergizer'
import QuickFingerEnergizerView, { type QuickFingerEnergizer } from '../QuickFingerEnergizer'
import TeamQuizEnergizerView, { type TeamQuizEnergizer } from '../TeamQuizEnergizer'
import WordCloudEnergizerView, { type WordCloudEnergizer } from '../WordCloudEnergizer'
import { Badge, type BadgeTone } from '../../ui/components'

export type AnyEnergizer = EmojiPollEnergizer | QuickFingerEnergizer | TeamQuizEnergizer | WordCloudEnergizer

type Props = {
  energizers: AnyEnergizer[]
  sessionId: string
  onEnergizerChange: () => void
}

const KIND_LABELS: Record<string, string> = {
  quick_finger: 'Quick Finger',
  team_quiz: 'Team Quiz',
  emoji_poll: 'Emoji Poll',
  word_cloud: 'Word Cloud',
}

/** Energizer state → shared Badge tone (DESIGN_SYSTEM_AUDIT_2026-07-01). */
const STATE_TONE: Record<string, BadgeTone> = {
  draft: 'neutral',
  active: 'brand',
  completed: 'success',
}

export default function EnergizerPanel({ energizers, sessionId, onEnergizerChange }: Props) {
  if (energizers.length === 0) return null

  return (
    <section className="space-y-3" aria-label="Energizers">
      {/* Compact summary cards */}
      {energizers.map((energizer) => (
        <div
          key={energizer.id}
          className="flex items-center gap-4 rounded-xl border border-[var(--color-border,#E5E5E5)] dark:border-[var(--color-border)] bg-white dark:bg-[var(--color-surface)] px-4 py-3.5 shadow-card"
        >
          {/* Violet icon well */}
          <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
            <Zap size={20} aria-hidden="true" />
          </span>

          {/* Meta */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary,var(--color-bg-subtle))] dark:text-[var(--text-primary)] truncate">
              Energizer · {KIND_LABELS[energizer.kind] ?? energizer.kind}
            </p>
            <p className="text-xs text-[var(--text-muted,#737373)] dark:text-[var(--text-muted)] mt-0.5 truncate">
              {energizer.prompt || 'Warms up the room before questions start'}
            </p>
          </div>

          {/* State badge */}
          <Badge tone={STATE_TONE[energizer.state] ?? 'neutral'} className="shrink-0">
            {energizer.state.charAt(0).toUpperCase() + energizer.state.slice(1)}
          </Badge>
        </div>
      ))}

      {/* Host detail / interactive views */}
      <section aria-label="Energizer controls" className="space-y-3">
        {energizers.map((energizer) => {
          const sharedProps = {
            key: energizer.id,
            sessionId,
            role: 'host' as const,
            onActivate: onEnergizerChange,
            onComplete: onEnergizerChange,
          }
          if (energizer.kind === 'emoji_poll')   return <EmojiPollEnergizerView    {...sharedProps} energizer={energizer as EmojiPollEnergizer} />
          if (energizer.kind === 'quick_finger') return <QuickFingerEnergizerView  {...sharedProps} energizer={energizer as QuickFingerEnergizer} />
          if (energizer.kind === 'team_quiz')    return <TeamQuizEnergizerView     {...sharedProps} energizer={energizer as TeamQuizEnergizer} />
          if (energizer.kind === 'word_cloud')   return <WordCloudEnergizerView    {...sharedProps} energizer={energizer as WordCloudEnergizer} />
          return null
        })}
      </section>
    </section>
  )
}
