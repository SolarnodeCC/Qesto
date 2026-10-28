import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { api, setAuthToken, setStepUpHandler } from '../../api/client'
import { useT } from '../../i18n'
import { Button } from '../../ui/components'
import { Modal } from '../../ui/Modal'
import { LOGIN_FIELD_CLASS } from '../../ui/input-field-class'

// DD-04 (#877): step-up prompt. Sensitive actions (team deletion, SAML,
// members/roles, API keys, the admin console when ADMIN_MFA_REQUIRED is on)
// answer 403 `mfa_step_up_required` for users with two-factor on. The API
// client calls the handler registered here, which asks for a code, refreshes
// the session's `mfa_at`, and lets the client retry the original request.

type Status = 'idle' | 'submitting' | 'invalid' | 'rate_limited' | 'error'

export default function MfaStepUpPrompt() {
  const t = useT('auth')
  const [open, setOpen] = useState(false)
  const [useRecovery, setUseRecovery] = useState(false)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)

  useEffect(() => {
    setStepUpHandler(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRef.current = resolve
          setValue('')
          setUseRecovery(false)
          setStatus('idle')
          setOpen(true)
        }),
    )
    return () => {
      setStepUpHandler(null)
      resolveRef.current?.(false)
    }
  }, [])

  function finish(confirmed: boolean) {
    setOpen(false)
    resolveRef.current?.(confirmed)
    resolveRef.current = null
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    const body = useRecovery ? { recovery_code: value.trim() } : { code: value.replace(/\s+/g, '') }
    const result = await api<{ token: string }>('/api/auth/mfa/step-up', { method: 'POST', body })
    if (result.ok) {
      setAuthToken(result.data.token)
      finish(true)
      return
    }
    if (result.status === 429) setStatus('rate_limited')
    else if (result.status === 400) setStatus('invalid')
    else setStatus('error')
  }

  return (
    <Modal
      open={open}
      onClose={() => finish(false)}
      closeDisabled={status === 'submitting'}
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          {t('stepUpTitle')}
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-pulse-600 dark:text-pulse-400">
          {useRecovery ? t('mfaRecoveryHint') : t('stepUpHint')}
        </p>
        <div className="space-y-1.5">
          <label htmlFor="step-up-input" className="block text-sm font-medium">
            {useRecovery ? t('mfaRecoveryLabel') : t('mfaCodeLabel')}
          </label>
          <input
            id="step-up-input"
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
        {(status === 'error' || status === 'rate_limited') && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">{t('genericError')}</p>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => finish(false)} disabled={status === 'submitting'} className="flex-1">
            {t('stepUpCancel')}
          </Button>
          <Button type="submit" disabled={status === 'submitting'} className="flex-1">
            {t('mfaVerify')}
          </Button>
        </div>
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
    </Modal>
  )
}
