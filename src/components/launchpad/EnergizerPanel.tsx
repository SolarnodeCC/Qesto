import EmojiPollEnergizerView, { type EmojiPollEnergizer } from '../EmojiPollEnergizer'
import QuickFingerEnergizerView, { type QuickFingerEnergizer } from '../QuickFingerEnergizer'
import TeamQuizEnergizerView, { type TeamQuizEnergizer } from '../TeamQuizEnergizer'
import WordCloudEnergizerView, { type WordCloudEnergizer } from '../WordCloudEnergizer'

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

const STATE_CLASSES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
}

export default function EnergizerPanel({ energizers, sessionId, onEnergizerChange }: Props) {
  if (energizers.length === 0) return null

  return (
    <section className="space-y-6">
      {/* Summary list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold dark:text-[#F0F2F8]">
            Energizers ({energizers.length})
          </h2>
        </div>
        <ul className="space-y-2">
          {energizers.map((energizer, index) => (
            <li
              key={energizer.id}
              className="rounded-md border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium dark:text-[#F0F2F8]">
                    {index + 1}. {KIND_LABELS[energizer.kind] ?? energizer.kind}
                  </p>
                  <p className="text-xs text-pulse-500 mt-1 truncate">
                    {energizer.prompt || '(no prompt)'}
                  </p>
                </div>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${STATE_CLASSES[energizer.state] ?? STATE_CLASSES.draft}`}>
                  {energizer.state}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Host detail views */}
      <section aria-labelledby="energizer-heading" className="space-y-3">
        <h2 id="energizer-heading" className="text-lg font-semibold dark:text-[#F0F2F8]">
          Energizer
        </h2>
        {energizers.map((energizer) => {
          const sharedProps = {
            key: energizer.id,
            sessionId,
            role: 'host' as const,
            onActivate: onEnergizerChange,
            onComplete: onEnergizerChange,
          }
          if (energizer.kind === 'emoji_poll') {
            return <EmojiPollEnergizerView {...sharedProps} energizer={energizer as EmojiPollEnergizer} />
          }
          if (energizer.kind === 'quick_finger') {
            return <QuickFingerEnergizerView {...sharedProps} energizer={energizer as QuickFingerEnergizer} />
          }
          if (energizer.kind === 'team_quiz') {
            return <TeamQuizEnergizerView {...sharedProps} energizer={energizer as TeamQuizEnergizer} />
          }
          if (energizer.kind === 'word_cloud') {
            return <WordCloudEnergizerView {...sharedProps} energizer={energizer as WordCloudEnergizer} />
          }
          return null
        })}
      </section>
    </section>
  )
}
