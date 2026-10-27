import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useT } from '../../i18n'
import { Button } from '../../ui/components'
import { LOGIN_FIELD_CLASS } from '../../ui/input-field-class'

// DD-04 (#877): second step of sign-in when two-factor authentication is on.
// The first factor (password, magic link or Google) produced `mfaToken`; this
// exchanges it plus a TOTP or recovery code for the session.

type Status = 'idle' | 'submitting' | 'invalid' | 'expired' | 'error'

export default function MfaChallenge({ mfaToken, onDone }: { mfaToken: string; onDone: () => void }) {
  const { verifyMfa } = useAuth()
  const t = useT('auth')
  const [useRecovery, setUseRecovery] = useState(false)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    const result = await verifyMfa(mfaToken, useRecovery ? { recoveryCode: value } : { code: value.replace(/\s+/g, '') })
    if (result === 'ok') {
      onDone()
      return
    }
    setStatus(result)
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-labelledby="mfa-title">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
        <h2 id="mfa-title" className="text-lg font-semibold">
          {t('mfaTitle')}
        </h2>
      </div>
      <p className="text-sm text-pulse-600 dark:text-pulse-400">
        {useRecovery ? t('mfaRecoveryHint') : t('mfaCodeHint')}
      </p>
      <div className="space-y-1.5">
        <label htmlFor="mfa-input" className="block text-sm font-medium">
          {useRecovery ? t('mfaRecoveryLabel') : t('mfaCodeLabel')}
        </label>
        <input
          id="mfa-input"
          autoFocus
          required
          autoComplete="one-time-code"
          inputMode={useRecovery ? 'text' : 'numeric'}
          pattern={useRecovery ? undefined : '[0-9 ]{6,7}'}
          maxLength={useRecovery ? 32 : 7}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (status !== 'submitting') setStatus('idle')
          }}
          aria-invalid={status === 'invalid'}
          className={LOGIN_FIELD_CLASS}
        />
      </div>
      {status === 'invalid' && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('mfaInvalid')}</p>
      )}
      {status === 'expired' && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('mfaExpired')}</p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('genericError')}</p>
      )}
      <Button type="submit" disabled={status === 'submitting'} className="w-full">
        {status === 'submitting' ? t('loggingIn') : t('mfaVerify')}
      </Button>
      <button
        type="button"
        className="w-full text-sm text-teal-600 dark:text-teal-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
        onClick={() => {
          setUseRecovery((v) => !v)
          setValue('')
          setStatus('idle')
        }}
      >
        {useRecovery ? t('mfaUseCode') : t('mfaUseRecovery')}
      </button>
    </form>
  )
}
