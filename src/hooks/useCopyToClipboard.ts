import { useCallback, useState } from 'react'

/** Copies text to the clipboard and tracks a transient "copied" flag for UI feedback. */
export function useCopyToClipboard(resetDelayMs = 2000): {
  copied: boolean
  copy: (text: string) => Promise<boolean>
} {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), resetDelayMs)
        return true
      } catch {
        return false
      }
    },
    [resetDelayMs],
  )

  return { copied, copy }
}
