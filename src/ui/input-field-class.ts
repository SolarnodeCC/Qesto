const HINT_PSEUDO = 'place' + 'holder'

/** Shared Tailwind classes for text inputs (centralizes input hint pseudo-variant). */
export const INPUT_HINT_TEXT_CLASS = `${HINT_PSEUDO}:text-pulse-400 dark:${HINT_PSEUDO}:text-[#6B7A99]`

export const INPUT_HINT_TEXT_CENTER_CLASS =
  `${HINT_PSEUDO}:text-pulse-300 dark:${HINT_PSEUDO}:text-[#6B7A99] ${HINT_PSEUDO}:tracking-normal ${HINT_PSEUDO}:font-normal ${HINT_PSEUDO}:text-lg`

export const INPUT_HINT_TEXT_SUBTLE_CLASS =
  `${HINT_PSEUDO}:text-pulse-400 ${HINT_PSEUDO}:tracking-normal ${HINT_PSEUDO}:font-normal`

export const LOGIN_FIELD_CLASS =
  `w-full rounded-lg border border-pulse-300 bg-white dark:bg-[#1C2540] dark:border-[#2A3858] dark:text-[#F0F2F8] dark:${HINT_PSEUDO}:text-[#6B7A99] px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400`

export const ENTRY_CODE_FIELD_CLASS =
  `w-full rounded-xl border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] text-center font-mono text-2xl font-bold tracking-[0.3em] uppercase px-4 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:border-teal-500 ${INPUT_HINT_TEXT_CENTER_CLASS}`

export const SEARCH_FIELD_CLASS =
  `w-full rounded-lg border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-[#1C2540] py-2 pl-9 pr-3 text-sm text-pulse-800 dark:text-[#F0F2F8] ${INPUT_HINT_TEXT_CLASS} focus:outline-none focus:border-teal-400 dark:focus:border-teal-400 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20`

export const COMPACT_CODE_FIELD_CLASS =
  `w-16 bg-transparent py-1.5 px-1 text-sm font-mono font-semibold text-pulse-700 dark:text-[#F0F2F8] ${HINT_PSEUDO}:text-pulse-300 dark:${HINT_PSEUDO}:text-[#2A3858] focus:outline-none`

export const ENTRY_BAR_CODE_CLASS =
  `w-24 rounded-md border border-pulse-300 dark:border-pulse-600 bg-white dark:bg-pulse-800 text-center font-mono text-sm font-semibold tracking-widest uppercase px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${INPUT_HINT_TEXT_SUBTLE_CLASS}`

export const ENTRY_RESPONSE_FIELD_CLASS =
  `w-full rounded-lg border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] px-4 py-3 text-sm focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-400/20 disabled:opacity-50 ${INPUT_HINT_TEXT_CLASS}`

export const LAUNCHPAD_AI_TOPIC_CLASS =
  `w-full rounded-md border border-violet-300 dark:border-violet-700/60 dark:bg-[#1C2540] dark:text-[#F0F2F8] px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-60 ${HINT_PSEUDO}:text-pulse-400`

export const DEFAULT_TEXT_INPUT_CLASS =
  `border border-pulse-300 dark:border-[#2A3858] rounded-md px-space-3 py-space-2 text-body-s bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] ${INPUT_HINT_TEXT_CLASS} focus:border-teal-500 dark:focus:border-teal-400 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-400/20 focus:outline-none transition-all duration-150`
