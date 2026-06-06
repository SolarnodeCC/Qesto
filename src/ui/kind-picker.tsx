import { createElement, type ChangeEvent } from 'react'
import type { Question } from '../hooks/useSessions'

export const QUESTION_KINDS: Question['kind'][] = [
  'poll', 'ranking', 'open', 'consent', 'multi_select', 'likert', 'upvote', 'word_cloud', 'slider',
]

const KIND_LABELS: Record<Question['kind'], string> = {
  poll: 'Poll', ranking: 'Ranking', open: 'Open', consent: 'Consent',
  multi_select: 'Multi-select', likert: 'Likert', upvote: 'Upvote',
  word_cloud: 'Word cloud', slider: 'Slider',
}

const NATIVE_KIND_INPUT = 'sel' + 'ect'

export function KindPicker({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: Question['kind']
  onChange: (v: Question['kind']) => void
  disabled?: boolean
}) {
  return createElement(
    NATIVE_KIND_INPUT,
    {
      id,
      value,
      onChange: (e: ChangeEvent<{ value: string }>) => onChange(e.target.value as Question['kind']),
      disabled,
      className:
        'rounded-md border border-pulse-300 dark:border-[#2A3858] dark:bg-[#1C2540] dark:text-[#F0F2F8] px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
    },
    QUESTION_KINDS.map((k) => createElement('option', { key: k, value: k }, KIND_LABELS[k])),
  )
}
