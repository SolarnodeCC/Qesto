import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import type { PollOption } from '@/types/session'
import { useT } from '../../i18n'
import type { LiveEnergizerState } from '../../hooks/useLiveSession'

// Live energizer voter-facing panels (slider input, quick-finger, team quiz,
// leaderboard, badge row), extracted verbatim from JoinPage.tsx (R-05). These
// were already-standalone, props-driven components; relocating them does not
// change behaviour. LiveLeaderboard and BadgeRow stay module-internal as they
// are only consumed by the panels here.

export function SliderInput({
  options,
  hasVoted,
  canVote,
  myVotes,
  onVote,
}: {
  options: PollOption[]
  hasVoted: boolean
  canVote: boolean
  myVotes: string[]
  onVote: (id: string) => void
}) {
  const t = useT('join')
  const [pos, setPos] = useState(Math.floor((options.length - 1) / 2))
  const selected = options[pos]
  const votedOption = options.find((o) => myVotes.includes(o.id))

  if (hasVoted) {
    return (
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-400">
        <Check size={16} aria-hidden="true" />
        {t('response_label')} <strong className="ml-1">{votedOption?.label ?? selected?.label}</strong>
      </p>
    )
  }
  return (
    <div className="space-y-4">
      <div className="text-center text-4xl font-bold text-teal-600 tabular-nums" aria-live="polite" aria-atomic="true">
        {selected?.label ?? pos + 1}
      </div>
      <input
        type="range"
        min={0}
        max={options.length - 1}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        disabled={!canVote}
        className="w-full accent-teal-500 cursor-pointer disabled:cursor-default"
        aria-label={t('select_value_aria')}
      />
      <div className="flex justify-between text-xs text-pulse-500">
        <span>{options[0]?.label}</span>
        <span>{options[options.length - 1]?.label}</span>
      </div>
      <button
        type="button"
        onClick={() => selected && onVote(selected.id)}
        disabled={!canVote || !selected}
        className="w-full rounded-lg bg-teal-600 text-white py-2.5 text-sm font-medium hover:brightness-110 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        {t('submit')}
      </button>
    </div>
  )
}

export function LiveQuickFingerPanel({
  energizer,
  voterId,
  onAnswer,
}: {
  energizer: LiveEnergizerState
  voterId: string | null
  onAnswer: (energizerId: string, value: string) => void
}) {
  const t = useT('join')
  const myAnswer = energizer.answers?.find((answer) => answer.voterId === voterId)
  const options = energizer.options ?? []
  const ranking = energizer.answers?.filter((answer) => answer.correct && answer.rank > 0).slice(0, 3) ?? []
  const myBadges = voterId ? energizer.badges?.[voterId] ?? [] : []

  return (
    <section className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 p-4 space-y-4" aria-labelledby="live-quick-finger-heading">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-teal-600" aria-hidden="true" />
        <h2 id="live-quick-finger-heading" className="font-semibold text-pulse-900 dark:text-[#F0F2F8]">
          {energizer.title || t('quickFinger.title')}
        </h2>
      </div>
      {energizer.prompt && <p className="text-sm text-pulse-700 dark:text-[#A8B3CC]">{energizer.prompt}</p>}

      {myAnswer ? (
        <div className="rounded-lg bg-white dark:bg-[#151C2E] border border-teal-200 dark:border-teal-800 px-3 py-2 text-sm" role="status" aria-live="polite">
          <p className="font-medium text-teal-800 dark:text-teal-300">
            {myAnswer.correct ? t('quickFinger.correct') : t('quickFinger.incorrect')}
          </p>
          <p className="text-pulse-500 dark:text-[#A8B3CC]">
            {t('quickFinger.speed', { ms: myAnswer.speedMs })}
            {myAnswer.rank > 0 ? ` · #${myAnswer.rank}` : ''}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onAnswer(energizer.id, option)}
              className="w-full rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-[#1C2540] px-4 py-3 text-left text-sm font-medium text-pulse-900 dark:text-[#F0F2F8] hover:border-teal-500 hover:bg-teal-100 dark:hover:bg-teal-900/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {option}
            </button>
          ))}
          {options.length === 0 && <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('quickFinger.waiting')}</p>}
        </div>
      )}

      {ranking.length > 0 && (
        <ol className="space-y-1 text-xs text-pulse-600" aria-label={t('quickFinger.ranking')}>
          {ranking.map((answer) => (
            <li key={answer.voterId} className="flex justify-between rounded bg-white/80 px-2 py-1">
              <span>#{answer.rank}</span>
              <span>{t('quickFinger.speed', { ms: answer.speedMs })}</span>
            </li>
          ))}
        </ol>
      )}

      <LiveLeaderboard energizer={energizer} voterId={voterId} />
      {myBadges.length > 0 && <BadgeRow badges={myBadges} />}
    </section>
  )
}

export function LiveTeamQuizPanel({
  energizer,
  voterId,
  onAnswer,
}: {
  energizer: LiveEnergizerState
  voterId: string | null
  onAnswer: (energizerId: string, value: string) => void
}) {
  const t = useT('join')
  const currentIndex = energizer.currentIndex ?? 0
  const question = energizer.questions?.[currentIndex]
  const mySubmission = energizer.submissions?.find(
    (submission) => submission.voterId === voterId && submission.questionIndex === currentIndex,
  )
  const myScore = energizer.scores?.find((score) => score.voterId === voterId)
  const myBadges = voterId ? energizer.badges?.[voterId] ?? [] : []

  return (
    <section className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4 space-y-4" aria-labelledby="live-team-quiz-heading">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-orange-600" aria-hidden="true" />
          <h2 id="live-team-quiz-heading" className="font-semibold text-pulse-900 dark:text-[#F0F2F8]">
            {energizer.title || t('teamQuiz.title')}
          </h2>
        </div>
        <span className="text-xs font-medium text-orange-700">
          {question ? t('teamQuiz.progress', { current: currentIndex + 1, total: energizer.questions?.length ?? 0 }) : t('teamQuiz.completed')}
        </span>
      </div>

      {energizer.status === 'completed' ? (
        <div className="rounded-lg bg-white dark:bg-[#151C2E] border border-orange-200 dark:border-orange-800 px-3 py-3 text-sm text-center">
          <p className="font-semibold text-pulse-900 dark:text-[#F0F2F8]">{t('teamQuiz.completed')}</p>
          <p className="text-pulse-500 dark:text-[#A8B3CC]">{t('teamQuiz.score', { score: myScore?.score ?? 0 })}</p>
        </div>
      ) : question ? (
        <>
          <p className="text-sm font-medium text-pulse-900 dark:text-[#F0F2F8]">{question.prompt}</p>
          <div className="grid gap-2">
            {question.options.map((option) => {
              const isMine = mySubmission?.value === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onAnswer(energizer.id, option)}
                  disabled={mySubmission !== undefined}
                  aria-pressed={isMine}
                  className={[
                    'w-full rounded-lg border px-4 py-3 text-left text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-default',
                    isMine
                      ? mySubmission.correct
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                        : 'border-red-400 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : mySubmission
                      ? 'border-orange-100 dark:border-orange-900 bg-white/60 text-pulse-500 dark:text-[#8A96B0]'
                      : 'border-orange-200 dark:border-orange-800 bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] hover:border-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/30',
                  ].join(' ')}
                >
                  {option}
                </button>
              )
            })}
          </div>
          {mySubmission && (
            <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]" role="status">
              {mySubmission.correct ? t('teamQuiz.correct') : t('teamQuiz.locked')}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('teamQuiz.waiting')}</p>
      )}

      <LiveLeaderboard energizer={energizer} voterId={voterId} />
      {myBadges.length > 0 && <BadgeRow badges={myBadges} />}
    </section>
  )
}

export function LiveEmojiPollPanel({
  energizer,
  voterId,
  onAnswer,
}: {
  energizer: LiveEnergizerState
  voterId: string | null
  onAnswer: (energizerId: string, value: string) => void
}) {
  const t = useT('join')
  const options = energizer.options ?? []
  const counts = energizer.optionCounts ?? {}
  const myAnswer = energizer.answers?.find((answer) => answer.voterId === voterId)
  const completed = energizer.status === 'completed'

  return (
    <section className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4 space-y-4" aria-labelledby="live-emoji-poll-heading">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-purple-600" aria-hidden="true" />
        <h2 id="live-emoji-poll-heading" className="font-semibold text-pulse-900 dark:text-[#F0F2F8]">
          {energizer.title || t('emojiPoll.title')}
        </h2>
      </div>
      {energizer.prompt && <p className="text-sm text-pulse-700 dark:text-[#A8B3CC]">{energizer.prompt}</p>}

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('emojiPoll.title')}>
        {options.map((emoji) => {
          const isMine = myAnswer?.value === emoji
          const count = counts[emoji] ?? 0
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onAnswer(energizer.id, emoji)}
              disabled={completed}
              aria-pressed={isMine}
              aria-label={t('emojiPoll.option_aria', { emoji, count })}
              className={[
                'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-default',
                isMine
                  ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40'
                  : 'border-purple-200 dark:border-purple-800 bg-white dark:bg-[#1C2540] hover:border-purple-400',
              ].join(' ')}
            >
              <span aria-hidden="true">{emoji}</span>
              <span className="text-xs font-semibold tabular-nums text-pulse-600 dark:text-[#A8B3CC]">{count}</span>
            </button>
          )
        })}
      </div>

      {myAnswer && !completed && (
        <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]" role="status">
          {t('emojiPoll.change_hint')}
        </p>
      )}
    </section>
  )
}

export function LiveWordCloudPanel({
  energizer,
  voterId,
  onAnswer,
}: {
  energizer: LiveEnergizerState
  voterId: string | null
  onAnswer: (energizerId: string, value: string) => void
}) {
  const t = useT('join')
  const [word, setWord] = useState('')
  const counts = energizer.optionCounts ?? {}
  const myAnswer = energizer.answers?.find((answer) => answer.voterId === voterId)
  const completed = energizer.status === 'completed'
  const trimmed = word.trim()
  const invalid = /\s/.test(trimmed)
  const topWords = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12)

  return (
    <section className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-4 space-y-4" aria-labelledby="live-word-cloud-heading">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-sky-600" aria-hidden="true" />
        <h2 id="live-word-cloud-heading" className="font-semibold text-pulse-900 dark:text-[#F0F2F8]">
          {energizer.title || t('wordCloud.title')}
        </h2>
      </div>
      {energizer.prompt && <p className="text-sm text-pulse-700 dark:text-[#A8B3CC]">{energizer.prompt}</p>}

      {!completed && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!trimmed || invalid) return
            onAnswer(energizer.id, trimmed)
            setWord('')
          }}
        >
          <input
            type="text"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            maxLength={60}
            placeholder={t('wordCloud.placeholder')}
            aria-label={t('wordCloud.placeholder')}
            className="flex-1 min-w-0 rounded-lg border border-sky-300 dark:border-sky-700 dark:bg-[#1C2540] dark:text-[#F0F2F8] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          />
          <button
            type="submit"
            disabled={!trimmed || invalid}
            className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium hover:brightness-110 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {t('wordCloud.submit')}
          </button>
        </form>
      )}
      {invalid && <p className="text-xs text-red-600" role="alert">{t('wordCloud.single_word_hint')}</p>}
      {myAnswer && !completed && (
        <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]" role="status">
          {t('wordCloud.submitted', { word: myAnswer.value })}
        </p>
      )}

      {topWords.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-label={t('wordCloud.top_words')}>
          {topWords.map(([value, count], i) => (
            <span
              key={value}
              className={[
                'font-semibold text-sky-800 dark:text-sky-300',
                i === 0 ? 'text-xl' : i < 4 ? 'text-base' : 'text-sm',
              ].join(' ')}
            >
              {value} <span className="text-xs font-normal text-pulse-500 tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

function LiveLeaderboard({ energizer, voterId }: { energizer: LiveEnergizerState; voterId: string | null }) {
  const t = useT('join')
  const entries = energizer.leaderboard ?? []
  if (entries.length === 0) return null
  return (
    <ol className="space-y-1 text-xs text-pulse-600" aria-label={t('leaderboard.title')}>
      {entries.slice(0, 5).map((entry) => (
        <li key={entry.voterId} className="flex items-center justify-between gap-2 rounded bg-white/80 px-2 py-1">
          <span className="truncate">
            #{entry.rank} {entry.voterId === voterId ? t('leaderboard.you') : entry.label}
          </span>
          <span className="shrink-0 font-semibold text-pulse-800">
            {t('leaderboard.points', { score: entry.score })}
          </span>
        </li>
      ))}
    </ol>
  )
}

function BadgeRow({ badges }: { badges: NonNullable<LiveEnergizerState['leaderboard']>[number]['badges'] }) {
  const t = useT('join')
  return (
    <div className="flex flex-wrap gap-1" aria-label={t('badges.earned')}>
      {badges.map((badge) => (
        <span key={badge.id} className="rounded-full bg-white dark:bg-[#1C2540] border border-pulse-200 dark:border-[#2A3858] px-2 py-1 text-[11px] font-medium text-pulse-700 dark:text-[#A8B3CC]">
          {badge.label}
        </span>
      ))}
    </div>
  )
}
