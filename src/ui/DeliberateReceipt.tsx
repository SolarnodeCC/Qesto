// Voter receipt card for DELIBERATE ballot-commit sessions (ADR-0049).
//
// Shows: ballot nonce, commitment hash, session fingerprint, voter's choice.
// Affordances: verify button, download as JSON, print (browser native print dialog).
// QR: encodes the verify URL path using react-qr-code (already in dependencies).
// No additional deps required.

import { useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import type { DeliberateReceipt as Receipt, DeliberateVerifyResult } from '../hooks/useDeliberateSession'

type TFn = (key: string, vars?: Record<string, string | number>) => string

type Props = {
  receipt: Receipt
  /** undefined = not yet verified; null = verifying in progress */
  verifyResult: DeliberateVerifyResult | null | undefined
  /** Whether a verify call is in-flight */
  verifying: boolean
  verifyError: string | null
  onVerify: () => void
  t: TFn
}

function truncate(s: string, len = 16): string {
  return s.length > len ? `${s.slice(0, len)}…` : s
}

export function DeliberateReceipt({ receipt, verifyResult, verifying, verifyError, onVerify, t }: Props) {
  const printRef = useRef<HTMLDivElement>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const verifyUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${receipt.verifyPath}`
      : receipt.verifyPath

  function handleDownload() {
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qesto-ballot-${receipt.ballotNonce.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handlePrint() {
    window.print()
  }

  async function handleCopyNonce() {
    try {
      await navigator.clipboard.writeText(receipt.ballotNonce)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      // Clipboard unavailable — silent fail
    }
  }

  const issuedDate = new Date(receipt.issuedAt).toLocaleString()

  return (
    <article
      ref={printRef}
      aria-label={t('receipt.ariaLabel')}
      className="rounded-xl border-2 border-teal-300 bg-white p-5 shadow-md dark:border-teal-700 dark:bg-pulse-900/60 print:border-gray-300 print:shadow-none"
    >
      {/* Header */}
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-pulse-900 dark:text-pulse-50">{t('receipt.title')}</h2>
          <p className="text-xs text-pulse-500 dark:text-pulse-400">{issuedDate}</p>
        </div>
        <span
          className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
          aria-label={t('receipt.choiceLabel')}
        >
          {receipt.choice}
        </span>
      </header>

      {/* Receipt fields */}
      <dl className="mb-5 space-y-3 text-sm">
        <ReceiptField label={t('receipt.ballotNonce')} value={receipt.ballotNonce} mono />
        <ReceiptField label={t('receipt.commitment')} value={truncate(receipt.commitment, 32)} mono />
        <ReceiptField label={t('receipt.fingerprint')} value={truncate(receipt.sessionFingerprint, 24)} mono />
        <ReceiptField label={t('receipt.leafIndex')} value={String(receipt.leafIndex)} />
      </dl>

      {/* Verify status */}
      {verifyResult !== undefined && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            verifyResult === null
              ? 'bg-pulse-100 text-pulse-600 dark:bg-pulse-800 dark:text-pulse-300'
              : verifyResult.verified
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}
        >
          {verifyResult === null
            ? t('receipt.verifying')
            : verifyResult.verified
              ? t('receipt.verifiedOk')
              : `${t('receipt.verifiedFail')}${verifyResult.reason ? ` — ${verifyResult.reason}` : ''}`}
        </div>
      )}

      {verifyError && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {verifyError}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          onClick={onVerify}
          disabled={verifying}
          aria-label={t('receipt.verifyAria')}
          className="min-h-[44px] min-w-[44px] rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:bg-teal-700 dark:hover:bg-teal-600"
        >
          {verifying ? t('receipt.verifying') : t('receipt.verifyButton')}
        </button>

        <button
          type="button"
          onClick={() => void handleCopyNonce()}
          aria-label={t('receipt.copyNonceAria')}
          className="min-h-[44px] min-w-[44px] rounded-lg border border-pulse-300 px-4 py-2.5 text-sm font-medium text-pulse-700 hover:border-teal-500 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-pulse-600 dark:text-pulse-300 dark:hover:border-teal-500 dark:hover:text-teal-400"
        >
          {copyState === 'copied' ? t('receipt.copied') : t('receipt.copyNonce')}
        </button>

        <button
          type="button"
          onClick={handleDownload}
          aria-label={t('receipt.downloadAria')}
          className="min-h-[44px] min-w-[44px] rounded-lg border border-pulse-300 px-4 py-2.5 text-sm font-medium text-pulse-700 hover:border-teal-500 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-pulse-600 dark:text-pulse-300"
        >
          {t('receipt.downloadJson')}
        </button>

        <button
          type="button"
          onClick={handlePrint}
          aria-label={t('receipt.printAria')}
          className="min-h-[44px] min-w-[44px] rounded-lg border border-pulse-300 px-4 py-2.5 text-sm font-medium text-pulse-700 hover:border-teal-500 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:border-pulse-600 dark:text-pulse-300"
        >
          {t('receipt.print')}
        </button>
      </div>

      {/* QR / verify URL */}
      <div className="mt-5 border-t border-pulse-100 pt-4 dark:border-pulse-700">
        <p className="mb-3 text-xs font-medium text-pulse-600 dark:text-pulse-400">{t('receipt.verifyUrlLabel')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div
            aria-label={t('receipt.qrAria')}
            className="shrink-0 rounded-lg border border-pulse-200 bg-white p-2 dark:border-pulse-700"
          >
            <QRCode value={verifyUrl} size={96} style={{ display: 'block' }} />
          </div>
          <p className="break-all font-mono text-xs text-pulse-600 dark:text-pulse-400">{verifyUrl}</p>
        </div>
      </div>
    </article>
  )
}

function ReceiptField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2">
      <dt className="font-medium text-pulse-600 dark:text-pulse-400">{label}</dt>
      <dd
        className={`break-all text-pulse-900 dark:text-pulse-100 ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </dd>
    </div>
  )
}
