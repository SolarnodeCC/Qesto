// Wordcloud rendering utilities for the presenter stage.
export const WORDCLOUD_COLORS = [
  'text-teal-600 dark:text-teal-400',
  'text-violet-600 dark:text-violet-400',
  'text-orange-500 dark:text-orange-400',
  'text-pink-500 dark:text-pink-400',
  'text-blue-600 dark:text-blue-400',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-500 dark:text-rose-400',
]

export function hashWordColor(word: string): string {
  let h = 0
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) & 0xffff
  return WORDCLOUD_COLORS[h % WORDCLOUD_COLORS.length]
}

export function getWordFontSize(count: number, maxCount: number): number {
  const ratio = maxCount > 1 ? (count - 1) / (maxCount - 1) : 0
  return Math.round(28 + ratio * 56)
}

export function getTopWords(counts: Record<string, number>, limit: number = 25): Array<[string, number]> {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}
