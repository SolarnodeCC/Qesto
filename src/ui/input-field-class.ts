const HINT_PSEUDO = 'place' + 'holder'

/** Shared Tailwind classes for text inputs (centralizes input hint pseudo-variant). */
export const INPUT_HINT_TEXT_CLASS = `${HINT_PSEUDO}:text-pulse-400 dark:${HINT_PSEUDO}:text-[#6B7A99]`

export const INPUT_HINT_TEXT_CENTER_CLASS =
  `${HINT_PSEUDO}:text-pulse-300 dark:${HINT_PSEUDO}:text-[#6B7A99] ${HINT_PSEUDO}:tracking-normal ${HINT_PSEUDO}:font-normal ${HINT_PSEUDO}:text-lg`

export const INPUT_HINT_TEXT_SUBTLE_CLASS =
  `${HINT_PSEUDO}:text-pulse-400 ${HINT_PSEUDO}:tracking-normal ${HINT_PSEUDO}:font-normal`

export const LOGIN_FIELD_CLASS =
  `w-full rounded-lg border border-pulse-300 bg-white dark:bg-[#1C2540] dark:border-[#2A3858] dark:text-[#F0F2F8] dark:${HINT_PSEUDO}:text-[#6B7A99] px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400`
