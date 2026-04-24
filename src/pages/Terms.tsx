import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'

const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }

const toc = [
  { id: 't1', label: 'The deal' },
  { id: 't2', label: 'Your account' },
  { id: 't3', label: 'Acceptable use' },
  { id: 't4', label: 'Your content' },
  { id: 't5', label: 'Payment & plans' },
  { id: 't6', label: 'Service levels' },
  { id: 't7', label: 'Termination' },
  { id: 't8', label: 'Warranties' },
  { id: 't9', label: 'Liability' },
  { id: 't10', label: 'Disputes' },
  { id: 't11', label: 'Misc' },
]

export default function Terms() {
  return (
    <MainLayout>
      <PageSeo
        title="Terms of Service — Qesto"
        description="Review Qesto terms covering service use, plan limits, billing, prohibited use, and legal conditions."
        canonicalPath="/terms"
      />

      {/* Legal hero */}
      <div className="border-b border-pulse-200 pb-6 pt-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-3">Legal</div>
          <h1 className="font-bold tracking-tight text-pulse-900 mb-3" style={{ ...displayFont, fontSize: 44 }}>
            Terms of Service
          </h1>
          <div className="flex gap-5 text-[13px] text-pulse-500" style={monoFont}>
            <span><strong className="text-pulse-600 font-semibold" style={{ fontFamily: 'var(--font-family-body)' }}>Version:</strong> 3.0.0</span>
            <span><strong className="text-pulse-600 font-semibold" style={{ fontFamily: 'var(--font-family-body)' }}>Effective:</strong> 2026-01-15</span>
            <span><strong className="text-pulse-600 font-semibold" style={{ fontFamily: 'var(--font-family-body)' }}>Governing law:</strong> Netherlands</span>
          </div>
        </div>
      </div>

      {/* Legal layout */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid gap-16 py-12 pb-24" style={{ gridTemplateColumns: '200px 1fr' }}>

          {/* TOC */}
          <aside className="hidden md:block" style={{ position: 'sticky', top: 80, height: 'fit-content' }}>
            <h5 className="text-[13px] font-bold text-pulse-900 mb-3">On this page</h5>
            <ol className="space-y-1.5 list-decimal list-inside">
              {toc.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="text-[13px] text-pulse-500 hover:text-teal-700 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          {/* Prose */}
          <main className="min-w-0">
            <p className="text-[17px] text-pulse-900 leading-relaxed mb-8">
              These terms govern your use of Qesto. They're short because our product is. If something here
              contradicts your master services agreement with us, the MSA wins.
            </p>

            <h2 id="t1" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              1. The deal
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              We provide a real-time polling and session platform. You pay for it (or use the free tier), run
              sessions on it, and keep ownership of everything you put in. We keep ownership of the platform itself.
            </p>

            <h2 id="t2" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              2. Your account
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              You must be 16 or older to create an account. You're responsible for what happens on it — keep
              credentials safe, use SSO if your org offers it. If your account is compromised, tell us within 72
              hours.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              One human, one account. Don't share logins. Teams scale with the Chorus plan, not by rotating a
              single seat.
            </p>

            <h2 id="t3" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              3. Acceptable use
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-3">Don't use Qesto to:</p>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-pulse-700 mb-4">
              <li>Run sessions that violate local law or published terms of a venue.</li>
              <li>Collect responses from children under 13 (or your jurisdiction's equivalent) without verified parental consent.</li>
              <li>Attempt to re-identify anonymous participants. Doing so terminates your account immediately.</li>
              <li>Scrape, probe, or reverse-engineer the platform. Security research is welcome via our responsible disclosure program — see <a href="https://qesto.app/security" className="text-teal-600 hover:underline">qesto.app/security</a>.</li>
              <li>Impersonate another host or organization.</li>
            </ul>

            <h2 id="t4" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              4. Your content
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              You own the session data you collect — questions, responses, recaps. We hold it as processor, under
              our DPA. We do not train models on it, do not share it, do not sell it.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              You grant us a minimum license to run the platform: we need to store, process, and transmit your
              content to you and your participants. Nothing more.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              Exports are yours, always. We provide CSV, JSON, and PDF exports for every session. If you cancel, you
              have 30 days to pull your data before we purge.
            </p>

            <h2 id="t5" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              5. Payment &amp; plans
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              Plans are monthly or annual. Prepaid, non-refundable except as required by law — but:{' '}
              <em>
                if your first pulse doesn't beat your previous survey's response rate, email us within 14 days and
                we'll refund the quarter.
              </em>{' '}
              We believe in the tool.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              Overage billing is per-session, at the rate on your plan page when the session was created. You'll see
              every charge itemized.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              Price changes affect your next renewal, not the current term. We give 60 days' notice.
            </p>

            <h2 id="t6" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              6. Service levels
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              Signal and Chorus plans have a 99.9% monthly uptime SLA. Pulse is best-effort — free tier, no SLA,
              but historically runs at the same availability.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              Credits for downtime are capped at the prior month's fees, processed within the next invoice cycle.
            </p>

            <h2 id="t7" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              7. Termination
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              You can cancel any time from the billing page. We can terminate for breach, non-payment, or use that
              threatens the platform's integrity (malware, fraud, abuse). Egregious violations — re-identifying
              participants, attacking the platform — terminate without warning.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              On termination, you have 30 days to export. After that, data is purged on the schedule in the privacy
              policy.
            </p>

            <h2 id="t8" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              8. Warranties
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              We warrant that Qesto operates as documented. We do <strong>not</strong> warrant that it's fit for any
              particular purpose beyond "running polling sessions." Don't use it for medical triage, legal evidence
              preservation, or anything life-critical.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              The platform is provided "as is" beyond the above. All other warranties, express or implied, are
              disclaimed to the extent the law allows.
            </p>

            <h2 id="t9" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              9. Liability
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              Our aggregate liability for any claim is capped at the fees you paid in the 12 months before the
              claim arose. We're not liable for indirect, consequential, or punitive damages — lost profits, lost
              opportunity, reputational harm — even if we knew they were possible.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              This cap doesn't apply to gross negligence, willful misconduct, or liability the law says we can't cap.
            </p>

            <h2 id="t10" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              10. Disputes
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              Governing law: Netherlands. Courts of Amsterdam have exclusive jurisdiction. Before filing, notify us
              at{' '}
              <a href="mailto:legal@qesto.app" className="text-teal-600 hover:underline">legal@qesto.app</a>; we'll
              engage within 30 days.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              EU consumers retain their local forum rights. Nothing here waives them.
            </p>

            <h2 id="t11" className="font-bold text-[26px] tracking-tight text-pulse-900 mt-10 mb-4" style={displayFont}>
              11. Misc
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-2">
              <strong>Assignment.</strong> You can't assign these terms; we can, on notice, to a successor in
              interest.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-2">
              <strong>Severability.</strong> If a clause is unenforceable, the rest stands.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-2">
              <strong>No waiver.</strong> If we don't enforce a right, we haven't waived it.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 mb-4">
              <strong>Entire agreement.</strong> These terms + the DPA + any signed MSA = the whole deal. Nothing else.
            </p>
            <p className="text-[13px] text-pulse-400 mt-8">
              Questions?{' '}
              <a href="mailto:legal@qesto.app" className="text-teal-600 hover:underline">legal@qesto.app</a>
            </p>
          </main>
        </div>
      </div>
    </MainLayout>
  )
}
