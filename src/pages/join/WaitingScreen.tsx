import { useState } from 'react'
import { Clock } from 'lucide-react'
import { useT } from '../../i18n'

type WaitingLookup = { status: 'waiting'; sessionId: string; title: string }

export function WaitingScreen({ code, lookup }: { code?: string; lookup: WaitingLookup }) {
  const t = useT('join')
  const [clickCount, setClickCount] = useState(0)
  const emojis = ['👍', '🎉', '👏', '⭐', '🚀', '💫', '🌟', '🎊', '🎈', '👌']
  const currentEmoji = emojis[Math.floor(clickCount / 10) % emojis.length]
  const shouldAnimate = clickCount > 0

  return (
    <main id="main" className="min-h-screen flex flex-col">
      <div className="h-1 bg-gradient-brand" aria-hidden="true" />
      <div className="border-b border-pulse-100 dark:border-[var(--color-border)] px-5 py-3">
        <span className="font-[family-name:var(--font-display)] font-bold text-[18px] tracking-[-0.02em] text-pulse-900 dark:text-[var(--text-primary)]">Qesto</span>
      </div>
      <div className="flex-1 max-w-lg w-full mx-auto px-5 py-12 flex flex-col items-center justify-center gap-8 text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-brand flex items-center justify-center shadow-lg" aria-hidden="true">
          <Clock size={28} stroke="white" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-pulse-900 dark:text-[var(--text-primary)]">{lookup.title}</h1>
          <p className="text-sm text-pulse-500 dark:text-[var(--text-secondary)] max-w-xs">{t('waiting_intro')}</p>
        </div>
        <div className="rounded-xl border border-pulse-200 dark:border-[var(--color-border)] bg-pulse-50 dark:bg-[var(--color-bg-subtle)] px-6 py-5 w-full max-w-sm space-y-3">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-pulse-700 dark:text-[var(--text-secondary)]" role="status" aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" aria-hidden="true" />
            {t('waiting_status')}
          </div>
          <p className="text-xs text-pulse-500 dark:text-[var(--text-muted)]">{t('waiting_auto_update')}</p>
        </div>
        {/* Decorative-only flourish — hidden from assistive tech and kept out of
            the tab order so the waiting screen isn't cluttered with AT noise. */}
        <div
          className="cursor-pointer mt-2 transition-transform hover:scale-110 active:scale-95"
          onClick={() => setClickCount((c) => c + 1)}
          aria-hidden="true"
        >
          <span className={`text-6xl block ${shouldAnimate ? 'animate-bounce' : ''}`}>
            {currentEmoji}
          </span>
        </div>
        <p className="text-xs text-pulse-500 dark:text-[var(--text-muted)]">
          {t('join_code_label')} <span className="font-mono font-semibold text-pulse-600 dark:text-[var(--text-secondary)]">{code?.toUpperCase()}</span>
        </p>
      </div>
    </main>
  )
}
