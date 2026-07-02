import { useState } from 'react'
import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'
import { Link } from 'react-router-dom'

const displayFont = { fontFamily: 'var(--font-family-display)' }

const ILLEGALITY_TYPES = [
  'Child sexual abuse material (CSAM)',
  'Terrorist or violent extremist content',
  'Incitement to violence or hatred (Art. 137c Sr)',
  'Non-consensual intimate imagery (NCII)',
  'Illegal discrimination',
  'Intellectual property infringement',
  'Fraudulent or deceptive content',
  'Other illegal content (describe below)',
]

type FormState = 'idle' | 'submitting' | 'success' | 'error'

export default function ReportContent() {
  const [contentLocation, setContentLocation] = useState('')
  const [illegalityType, setIllegalityType] = useState('')
  const [description, setDescription] = useState('')
  const [notifierEmail, setNotifierEmail] = useState('')
  const [formState, setFormState] = useState<FormState>('idle')
  const [referenceId, setReferenceId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormState('submitting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/report-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentLocation, illegalityType, description, notifierEmail }),
      })
      const data = (await res.json()) as { ok: boolean; referenceId?: string; error?: { code?: string; message?: string } }
      if (!res.ok || !data.ok) {
        const msg = data.error?.message
        setErrorMessage(msg ?? 'Submission failed. Please try again or email abuse@qesto.cc.')
        setFormState('error')
      } else {
        setReferenceId(data.referenceId ?? '')
        setFormState('success')
      }
    } catch {
      setErrorMessage('Network error. Please try again or email abuse@qesto.cc.')
      setFormState('error')
    }
  }

  return (
    <MainLayout>
      <PageSeo
        title="Report Illegal Content — Qesto"
        description="Submit a notice of alleged illegal content hosted on Qesto under Art. 16 of the Digital Services Act (EU 2022/2065)."
        canonicalPath="/legal/report"
      />

      {/* Hero */}
      <div className="border-b border-pulse-200 pb-6 pt-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Legal</div>
          <h1
            className="font-bold tracking-tight text-pulse-900 dark:text-[var(--text-primary)] mb-3"
            style={{ ...displayFont, fontSize: 44 }}
          >
            Report Illegal Content
          </h1>
          <p className="text-[15px] text-pulse-500 dark:text-[var(--text-muted)]">
            Art. 16, Regulation (EU) 2022/2065 (Digital Services Act)
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 pb-24">
        <div className="max-w-2xl">
          {formState === 'success' ? (
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <svg
                  aria-hidden="true"
                  className="flex-shrink-0 mt-0.5 text-teal-600 dark:text-teal-400"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <div>
                  <p className="font-semibold text-pulse-900 dark:text-[var(--text-primary)] mb-1">Report received</p>
                  <p className="text-[15px] text-pulse-700 dark:text-[var(--text-secondary)] mb-2">
                    Your reference ID:{' '}
                    <strong className="font-mono text-pulse-900 dark:text-[var(--text-primary)]">{referenceId}</strong>
                  </p>
                  <p className="text-[14px] text-pulse-500 dark:text-[var(--text-muted)]">
                    An acknowledgement has been sent to your email. We aim to send our decision within 5 business days.
                    If the reported content is found to be illegal, we will take appropriate action and notify you,
                    including available redress options.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-teal-200 dark:border-teal-800">
                <Link to="/legal" className="text-[14px] text-teal-600 hover:underline">
                  ← Back to Legal Information
                </Link>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-6">
                Any person or entity may use this form to notify Qesto of alleged illegal content hosted on our
                platform. We will review every notice and respond with our decision within 5 business days. You will
                receive an acknowledgement with a reference ID immediately after submission.
              </p>
              <p className="text-[14px] text-pulse-500 dark:text-[var(--text-muted)] mb-8">
                Alternatively, you can email{' '}
                <a href="mailto:abuse@qesto.cc" className="text-teal-600 hover:underline">
                  abuse@qesto.cc
                </a>{' '}
                directly with the same information.
              </p>

              {formState === 'error' && (
                <div
                  role="alert"
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 text-[14px] text-red-700 dark:text-red-400"
                >
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                <div>
                  <label
                    htmlFor="content-location"
                    className="block text-[14px] font-semibold text-pulse-900 dark:text-[var(--text-primary)] mb-1.5"
                  >
                    Content location <span aria-hidden="true" className="text-red-500">*</span>
                  </label>
                  <input
                    id="content-location"
                    type="text"
                    required
                    value={contentLocation}
                    onChange={(e) => setContentLocation(e.target.value)}
                    placeholder="e.g. session ID, URL, or description of where the content appears"
                    className="w-full px-3 py-2 text-[14px] rounded-lg border border-pulse-300 dark:border-white/15 bg-white dark:bg-white/5 text-pulse-900 dark:text-[var(--text-primary)] placeholder:text-pulse-400 dark:placeholder:text-[#5A6380] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="illegality-type"
                    className="block text-[14px] font-semibold text-pulse-900 dark:text-[var(--text-primary)] mb-1.5"
                  >
                    Nature of alleged illegality <span aria-hidden="true" className="text-red-500">*</span>
                  </label>
                  <select
                    id="illegality-type"
                    required
                    value={illegalityType}
                    onChange={(e) => setIllegalityType(e.target.value)}
                    className="w-full px-3 py-2 text-[14px] rounded-lg border border-pulse-300 dark:border-white/15 bg-white dark:bg-[#1A1E2E] text-pulse-900 dark:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  >
                    <option value="" disabled>Select a category…</option>
                    {ILLEGALITY_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="block text-[14px] font-semibold text-pulse-900 dark:text-[var(--text-primary)] mb-1.5"
                  >
                    Description{' '}
                    <span className="font-normal text-pulse-400 dark:text-[#5A6380]">(optional)</span>
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide additional details about the alleged illegal content and why you believe it is illegal."
                    className="w-full px-3 py-2 text-[14px] rounded-lg border border-pulse-300 dark:border-white/15 bg-white dark:bg-white/5 text-pulse-900 dark:text-[var(--text-primary)] placeholder:text-pulse-400 dark:placeholder:text-[#5A6380] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 resize-y"
                  />
                </div>

                <div>
                  <label
                    htmlFor="notifier-email"
                    className="block text-[14px] font-semibold text-pulse-900 dark:text-[var(--text-primary)] mb-1.5"
                  >
                    Your email address <span aria-hidden="true" className="text-red-500">*</span>
                  </label>
                  <input
                    id="notifier-email"
                    type="email"
                    required
                    value={notifierEmail}
                    onChange={(e) => setNotifierEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 text-[14px] rounded-lg border border-pulse-300 dark:border-white/15 bg-white dark:bg-white/5 text-pulse-900 dark:text-[var(--text-primary)] placeholder:text-pulse-400 dark:placeholder:text-[#5A6380] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  />
                  <p className="text-[13px] text-pulse-500 dark:text-[var(--text-muted)] mt-1.5">
                    Required so we can send you the acknowledgement and our decision (Art. 16(3) DSA).
                  </p>
                </div>

                <div className="bg-pulse-50 dark:bg-white/5 border border-pulse-200 dark:border-white/10 rounded-lg p-4 text-[13px] text-pulse-500 dark:text-[var(--text-muted)]">
                  By submitting this form you confirm that the information provided is accurate and complete to the
                  best of your knowledge. Submitting false or malicious notices may constitute an offence under
                  applicable law.
                </div>

                <button
                  type="submit"
                  disabled={formState === 'submitting'}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[14px] font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  {formState === 'submitting' ? 'Submitting…' : 'Submit report'}
                </button>
              </form>

              <div className="border-t border-pulse-200 dark:border-white/10 mt-10 pt-6">
                <p className="text-[13px] text-pulse-500 dark:text-[var(--text-muted)]">
                  Related:{' '}
                  <Link to="/legal" className="text-teal-600 hover:underline">Legal Information</Link>
                  {' · '}
                  <Link to="/privacy" className="text-teal-600 hover:underline">Privacy Policy</Link>
                  {' · '}
                  <Link to="/terms" className="text-teal-600 hover:underline">Terms of Service</Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  )
}
