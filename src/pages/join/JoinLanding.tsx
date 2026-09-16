import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../../i18n'
import { inputHint } from '../../ui/input-hint'
import { ENTRY_CODE_FIELD_CLASS } from '../../ui/input-field-class'
import { FormField } from '../../ui/FormField'
import { Button } from '../../ui/components'
import ParticipantShell from '../../layouts/ParticipantShell'

export function JoinLanding() {
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const t = useT('join')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length !== 6) return
    navigate(`/j/${clean}`)
  }

  return (
    <ParticipantShell title={t('heading')} subtitle={t('subtitle')} maxWidth="sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <FormField label={t('codeLabel')} labelSrOnly hint={t('code_length_hint')} controlClassName={ENTRY_CODE_FIELD_CLASS}>
          {(field) => (
            <input
              {...field}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
              {...inputHint(t('codePlaceholder'))}
              maxLength={6}
              autoFocus
              spellCheck={false}
              autoCapitalize="characters"
              className={field.className}
            />
          )}
        </FormField>
        <Button type="submit" disabled={code.trim().length !== 6} className="w-full" size="lg">
          {t('joinButton')}
        </Button>
      </form>
      <p className="text-center text-xs text-pulse-500 dark:text-[var(--text-muted)]">
        <a
          href="/"
          className="text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
        >
          {t('back')}
        </a>
      </p>
    </ParticipantShell>
  )
}
