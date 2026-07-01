// Standalone verify view for DELIBERATE ballot receipts (ADR-0049).
//
// Renders the full verification result with:
//   - Clear verified / commitment-mismatch states (accessible: roles, color + text)
//   - Individual check rows (commitmentValid, inLedger, ledgerCommitmentMatch)
//   - Merkle root + leaf index for manual audit
//
// Accessible per WCAG 2.1 AA: status conveyed via text+icon (not color alone),
// role="status" live region, focus management handled by parent.

import { Check, CircleCheckBig, CircleX, X } from 'lucide-react'
import type { DeliberateVerifyResult } from '../hooks/useDeliberateSession'

type TFn = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  result: DeliberateVerifyResult
  t: TFn
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {ok ? (
        <Check
          aria-hidden="true"
          size={16}
          strokeWidth={2.5}
          className="shrink-0 text-green-600 dark:text-green-400"
        />
      ) : (
        <X
          aria-hidden="true"
          size={16}
          strokeWidth={2.5}
          className="shrink-0 text-red-600 dark:text-red-400"
        />
      )}
      <span className={ok ? 'text-pulse-800 dark:text-pulse-100' : 'text-red-700 dark:text-red-400'}>
        {label}
      </span>
    </li>
  )
}

export function DeliberateVerifyView({ result, t }: Props) {
  const allOk = result.verified

  return (
    <section
      aria-label={t('verify.sectionLabel')}
      className={`rounded-xl border-2 p-5 ${
        allOk
          ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
          : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
      }`}
    >
      {/* Primary verdict */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="mb-4 flex items-center gap-3"
      >
        {allOk ? (
          <CircleCheckBig
            aria-hidden="true"
            size={28}
            className="shrink-0 text-green-600 dark:text-green-400"
          />
        ) : (
          <CircleX
            aria-hidden="true"
            size={28}
            className="shrink-0 text-red-600 dark:text-red-400"
          />
        )}
        <div>
          <p
            className={`text-base font-bold ${
              allOk ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'
            }`}
          >
            {allOk ? t('verify.verdictOk') : t('verify.verdictFail')}
          </p>
          {!allOk && result.reason && (
            <p className="mt-0.5 text-sm text-red-700 dark:text-red-400">{result.reason}</p>
          )}
        </div>
      </div>

      {/* Check list */}
      <ul className="mb-4 space-y-2" aria-label={t('verify.checksLabel')}>
        <CheckRow ok={result.commitmentValid} label={t('verify.checkCommitment')} />
        <CheckRow ok={result.inLedger} label={t('verify.checkInLedger')} />
        <CheckRow ok={result.ledgerCommitmentMatch} label={t('verify.checkLedgerMatch')} />
      </ul>

      {/* Audit details */}
      <dl className="space-y-1 border-t border-current/10 pt-3 text-xs">
        <div className="flex items-center gap-2">
          <dt className="font-medium text-pulse-600 dark:text-pulse-400">{t('verify.merkleRoot')}</dt>
          <dd className="break-all font-mono text-pulse-800 dark:text-pulse-100">{result.merkleRoot}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="font-medium text-pulse-600 dark:text-pulse-400">{t('verify.leafIndex')}</dt>
          <dd className="font-mono text-pulse-800 dark:text-pulse-100">{result.leafIndex}</dd>
        </div>
      </dl>
    </section>
  )
}
