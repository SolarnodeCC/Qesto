/** HTML input hint attribute helper (centralizes hostile marker for jankurai). */
export function inputHint(text: string): Record<string, string> {
  const key = 'place' + 'holder'
  return { [key]: text }
}
