import { useEffect, useState, type FormEvent } from 'react'
import QRCode from 'react-qr-code'
import { ShieldCheck } from 'lucide-react'
import { api, setAuthToken } from '../../api/client'
import { useT } from '../../i18n'

// DD-04 (#877): two-factor enrolment. Setup shows the otpauth QR + secret; the
// first valid code turns MFA on and returns recovery codes exactly once.

type View =
  | { kind: 'loading' }
  | { kind: 'off' }
  | { kind: 'enrolling'; secret: string; uri: string }
  | { kind: 'codes'; codes: string[] }
  | { kind: 'on'; remaining: number }

const BTN =
  'inline-flex items-center rounded-lg border border-pulse-200 dark:border-[#2A3858] px-4 py-2 text-sm font-medium text-pulse-700 dark:text-[#A8B3CC] hover:bg-pulse-50 dark:hover:bg-white/5 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const INPUT =
  'w-40 rounded-lg border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-[#0F1525] px-3 py-2 text-sm tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

export default function MfaSettings() {
  const t = useT('settings')
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Bumped to re-read status after enrolment finishes.
  const [statusVersion, setStatusVersion] = useState(0)

  useEffect(() => {
    let alive = true
    void api<{ enabled: boolean; recoveryCodesRemaining: number }>('/api/auth/mfa/status').then((res) => {
      if (!alive) return
      setView(res.ok && res.data.enabled ? { kind: 'on', remaining: res.data.recoveryCodesRemaining } : { kind: 'off' })
    })
    return () => {
      alive = false
    }
  }, [statusVersion])

  async function start() {
    setBusy(true)
    setError(null)
    const res = await api<{ secret: string; otpauthUri: string }>('/api/auth/mfa/setup', { method: 'POST' })
    setBusy(false)
    if (res.ok) setView({ kind: 'enrolling', secret: res.data.secret, uri: res.data.otpauthUri })
    else setError(t('mfa.error'))
  }

  async function enable(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await api<{ recoveryCodes: string[]; token: string }>('/api/auth/mfa/enable', {
      method: 'POST',
      body: { code: code.replace(/\s+/g, '') },
    })
    setBusy(false)
    setCode('')
    if (res.ok) {
      setAuthToken(res.data.token)
      setView({ kind: 'codes', codes: res.data.recoveryCodes })
    } else setError(t('mfa.invalidCode'))
  }

  async function disable(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const res = await api('/api/auth/mfa/disable', { method: 'POST', body: { code: code.replace(/\s+/g, '') } })
    setBusy(false)
    setCode('')
    if (res.ok) setView({ kind: 'off' })
    else setError(t('mfa.invalidCode'))
  }

  return (
    <div className="space-y-3 border-t border-pulse-100 dark:border-[#1E2A45] pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-pulse-800 dark:text-[#F0F2F8]">
        <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
        {t('mfa.title')}
      </h3>

      {view.kind === 'loading' && (
        <div className="h-10 rounded-lg bg-pulse-100 dark:bg-pulse-800/60 skeleton-shimmer" aria-hidden="true" />
      )}

      {view.kind === 'off' && (
        <>
          <p className="text-sm text-pulse-500 dark:text-[#8A96B0]">{t('mfa.offDescription')}</p>
          <button type="button" className={BTN} disabled={busy} onClick={() => void start()}>
            {t('mfa.setUp')}
          </button>
        </>
      )}

      {view.kind === 'enrolling' && (
        <form onSubmit={enable} className="space-y-3">
          <p className="text-sm text-pulse-500 dark:text-[#8A96B0]">{t('mfa.scan')}</p>
          <div className="inline-block rounded-lg bg-white p-3">
            <QRCode value={view.uri} size={160} aria-label={t('mfa.qrLabel')} />
          </div>
          <p className="text-xs text-pulse-500 dark:text-[#8A96B0]">
            {t('mfa.manualKey')} <code className="break-all font-mono">{view.secret}</code>
          </p>
          <label htmlFor="mfa-enable-code" className="block text-sm font-medium">
            {t('mfa.codeLabel')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="mfa-enable-code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={INPUT}
            />
            <button type="submit" className={BTN} disabled={busy}>
              {t('mfa.enable')}
            </button>
          </div>
        </form>
      )}

      {view.kind === 'codes' && (
        <div className="space-y-2">
          <p role="status" className="text-sm text-teal-700 dark:text-teal-300">{t('mfa.enabledNow')}</p>
          <p className="text-sm text-pulse-500 dark:text-[#8A96B0]">{t('mfa.recoveryIntro')}</p>
          <ul className="grid grid-cols-2 gap-1 rounded-lg border border-pulse-200 dark:border-[#1E2A45] p-3 font-mono text-sm">
            {view.codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button type="button" className={BTN} onClick={() => setStatusVersion((v) => v + 1)}>
            {t('mfa.savedCodes')}
          </button>
        </div>
      )}

      {view.kind === 'on' && (
        <form onSubmit={disable} className="space-y-2">
          <p className="text-sm text-pulse-500 dark:text-[#8A96B0]">
            {t('mfa.onDescription', { count: view.remaining })}
          </p>
          <label htmlFor="mfa-disable-code" className="block text-sm font-medium">
            {t('mfa.disableLabel')}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="mfa-disable-code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={INPUT}
            />
            <button type="submit" className={BTN} disabled={busy}>
              {t('mfa.disable')}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
