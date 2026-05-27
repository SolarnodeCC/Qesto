/**
 * FE-AAA-CONTRAST-01 — high contrast mode toggle (S78).
 */
import { useEffect, useState } from 'react'

const KEY = 'qesto:high-contrast'

export function HighContrastToggle() {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && localStorage.getItem(KEY) === '1')

  useEffect(() => {
    document.documentElement.dataset.highContrast = on ? 'true' : 'false'
    localStorage.setItem(KEY, on ? '1' : '0')
  }, [on])

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setOn((v) => !v)}
      className="rounded-lg border border-pulse-200 dark:border-[#2A3858] px-4 py-2 text-sm min-h-[44px]"
    >
      High contrast {on ? 'on' : 'off'}
    </button>
  )
}
