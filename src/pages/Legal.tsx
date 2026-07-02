import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'
import { Link } from 'react-router-dom'

const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }

const toc = [
  { id: 'l1', label: 'Company details' },
  { id: 'l2', label: 'Contact — authorities' },
  { id: 'l3', label: 'Contact — users' },
  { id: 'l4', label: 'Report illegal content' },
  { id: 'l5', label: 'Transparency statement' },
  { id: 'l6', label: 'Monthly active recipients' },
  { id: 'l7', label: 'Data Processing Agreement' },
]

export default function Legal() {
  return (
    <MainLayout>
      <PageSeo
        title="Legal Information — Qesto"
        description="Company registration, DSA contact points, content reporting, and compliance transparency for Qesto."
        canonicalPath="/legal"
      />

      {/* Hero */}
      <div className="border-b border-pulse-200 pb-6 pt-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Legal</div>
          <h1
            className="font-bold tracking-tight text-pulse-900 dark:text-[var(--text-primary)] mb-3"
            style={{ ...displayFont, fontSize: 44 }}
          >
            Legal Information
          </h1>
          <div className="flex gap-5 text-[13px] text-pulse-500 dark:text-[var(--text-muted)]" style={monoFont}>
            <span>
              <strong className="text-pulse-600 dark:text-[var(--text-secondary)] font-semibold" style={{ fontFamily: 'var(--font-family-body)' }}>
                Updated:
              </strong>{' '}
              2026-06-30
            </span>
            <span>
              <strong className="text-pulse-600 dark:text-[var(--text-secondary)] font-semibold" style={{ fontFamily: 'var(--font-family-body)' }}>
                Jurisdiction:
              </strong>{' '}
              Netherlands (ACM)
            </span>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid gap-16 py-12 pb-24" style={{ gridTemplateColumns: '200px 1fr' }}>
          {/* TOC */}
          <aside className="hidden md:block" style={{ position: 'sticky', top: 80, height: 'fit-content' }}>
            <h5 className="text-[13px] font-bold text-pulse-900 dark:text-[var(--text-primary)] mb-3">On this page</h5>
            <ol className="space-y-1.5 list-decimal list-inside">
              {toc.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="text-[13px] text-pulse-500 dark:text-[var(--text-muted)] hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          {/* Prose */}
          <main className="min-w-0">
            <p className="text-[17px] text-pulse-900 dark:text-[var(--text-primary)] leading-relaxed mb-8">
              This page fulfils Qesto's disclosure obligations under Art. 11 and Art. 15 of the Digital Services Act
              (EU 2022/2065), Art. 5 of the eCommerce Directive (2000/31/EC), and related Dutch law.
            </p>

            {/* 1. Company details */}
            <h2
              id="l1"
              className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[var(--text-primary)] mt-10 mb-4"
              style={displayFont}
            >
              1. Company details
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-2">
              <strong>Legal name:</strong> Qesto B.V.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-2">
              {/* TODO before go-live: replace with actual registered street address from KvK 88214503 */}
              <strong>Registered address:</strong> Amsterdam, the Netherlands{' '}
              <span className="text-xs text-pulse-400 dark:text-[var(--text-muted)]">(full address available from KvK 88214503)</span>
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-2">
              <strong>KvK (Chamber of Commerce):</strong> 88214503
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-4">
              <strong>General contact:</strong>{' '}
              <a href="mailto:legal@qesto.cc" className="text-teal-600 hover:underline">
                legal@qesto.cc
              </a>
            </p>

            {/* 2. Contact — authorities */}
            <h2
              id="l2"
              className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[var(--text-primary)] mt-10 mb-4"
              style={displayFont}
            >
              2. Contact for competent authorities
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-4">
              In accordance with Art. 11(1)(a) of the Digital Services Act (EU 2022/2065), the following contact
              point is designated for direct communication with competent authorities including the ACM (Autoriteit
              Consument & Markt), law enforcement bodies, and the European Commission:
            </p>
            <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-4 mb-6">
              <p className="text-[15px] font-semibold text-pulse-900 dark:text-[var(--text-primary)] mb-1">
                DSA Authority Contact
              </p>
              <p className="text-[15px] text-pulse-700 dark:text-[var(--text-secondary)]">
                <a href="mailto:legal@qesto.cc" className="text-teal-600 hover:underline font-medium">
                  legal@qesto.cc
                </a>
              </p>
              <p className="text-[13px] text-pulse-500 dark:text-[var(--text-muted)] mt-1">
                No prior registration required. Emails acknowledged within 2 business days.
              </p>
            </div>

            {/* 3. Contact — users */}
            <h2
              id="l3"
              className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[var(--text-primary)] mt-10 mb-4"
              style={displayFont}
            >
              3. Contact for users
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-4">
              In accordance with Art. 11(1)(b) DSA, the following contact point is available for service recipients
              (hosts and participants) who need to contact Qesto directly:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-pulse-700 dark:text-[var(--text-secondary)] mb-6">
              <li>
                <strong>General support:</strong>{' '}
                <a href="mailto:support@qesto.cc" className="text-teal-600 hover:underline">
                  support@qesto.cc
                </a>
              </li>
              <li>
                <strong>Privacy &amp; data rights:</strong>{' '}
                <a href="mailto:dpo@qesto.cc" className="text-teal-600 hover:underline">
                  dpo@qesto.cc
                </a>
              </li>
              <li>
                <strong>Legal &amp; account disputes:</strong>{' '}
                <a href="mailto:legal@qesto.cc" className="text-teal-600 hover:underline">
                  legal@qesto.cc
                </a>
              </li>
              <li>
                <strong>Security disclosures:</strong>{' '}
                <a href="mailto:security@qesto.cc" className="text-teal-600 hover:underline">
                  security@qesto.cc
                </a>
              </li>
            </ul>

            {/* 4. Report illegal content */}
            <h2
              id="l4"
              className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[var(--text-primary)] mt-10 mb-4"
              style={displayFont}
            >
              4. Report illegal content
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-4">
              In accordance with Art. 16 DSA, any person or entity may notify Qesto of alleged illegal content
              hosted on our platform. We will review every notice and respond with our decision.
            </p>
            <div className="flex gap-3 flex-wrap mb-6">
              <Link
                to="/legal/report"
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-[14px] font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                Submit a content report →
              </Link>
              <a
                href="mailto:abuse@qesto.cc"
                className="inline-flex items-center gap-2 px-4 py-2 border border-pulse-300 dark:border-white/10 text-pulse-700 dark:text-[var(--text-secondary)] text-[14px] font-medium rounded-lg hover:bg-pulse-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                Email abuse@qesto.cc
              </a>
            </div>
            <p className="text-[14px] text-pulse-500 dark:text-[var(--text-muted)] mb-4">
              You will receive an acknowledgement with a reference ID within minutes. We aim to send our decision
              within 5 business days.
            </p>

            {/* 5. Transparency statement */}
            <h2
              id="l5"
              className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[var(--text-primary)] mt-10 mb-4"
              style={displayFont}
            >
              5. Transparency statement
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-4">
              In accordance with Art. 15 DSA, Qesto publishes the following transparency information covering the
              period 1 January 2026 – 30 June 2026:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-pulse-700 dark:text-[var(--text-secondary)] mb-4">
              <li>
                <strong>Government orders under Art. 9 DSA</strong> (orders to act against illegal content):{' '}
                <strong>0 received</strong>
              </li>
              <li>
                <strong>Government orders under Art. 10 DSA</strong> (orders to provide information):{' '}
                <strong>0 received</strong>
              </li>
              <li>
                <strong>Account suspensions under Art. 17 DSA:</strong> <strong>0 issued</strong>
              </li>
              <li>
                <strong>Content notices under Art. 16 DSA:</strong> <strong>0 received</strong>
              </li>
            </ul>
            <p className="text-[13px] text-pulse-500 dark:text-[var(--text-muted)] mb-4">
              This statement is updated every 6 months. Next update: 31 December 2026.
            </p>

            {/* 6. Monthly active recipients */}
            <h2
              id="l6"
              className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[var(--text-primary)] mt-10 mb-4"
              style={displayFont}
            >
              6. Monthly active recipients (EU)
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-4">
              In accordance with Art. 23 DSA, Qesto discloses the following estimate of average monthly active
              recipients of the service in the European Union:
            </p>
            <div className="bg-pulse-50 dark:bg-white/5 border border-pulse-200 dark:border-white/10 rounded-lg p-4 mb-4">
              <p className="text-[15px] font-semibold text-pulse-900 dark:text-[var(--text-primary)]">
                Fewer than 10,000 average monthly active recipients (EU)
              </p>
              <p className="text-[13px] text-pulse-500 dark:text-[var(--text-muted)] mt-1">
                Reporting period: January–June 2026. Includes hosts and session participants who interacted with the
                service at least once during the period. Updated every 6 months.
              </p>
            </div>

            {/* 7. Data Processing Agreement */}
            <h2
              id="l7"
              className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[var(--text-primary)] mt-10 mb-4"
              style={displayFont}
            >
              7. Data Processing Agreement
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-4">
              Hosts who process personal data through Qesto sessions act as data controllers. Qesto acts as
              processor under a Data Processing Agreement (DPA) incorporated into the Terms of Service at account
              creation.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[var(--text-secondary)] mb-4">
              Enterprise customers requiring a separately signed DPA, Standard Contractual Clauses (SCCs), or a
              record of processing activities can request these from{' '}
              <a href="mailto:privacy@qesto.cc" className="text-teal-600 hover:underline">
                privacy@qesto.cc
              </a>
              . We aim to respond within 5 business days.
            </p>

            <div className="border-t border-pulse-200 dark:border-white/10 mt-12 pt-8">
              <p className="text-[13px] text-pulse-500 dark:text-[var(--text-muted)]">
                Related documents:{' '}
                <Link to="/privacy" className="text-teal-600 hover:underline">Privacy Policy</Link>
                {' · '}
                <Link to="/terms" className="text-teal-600 hover:underline">Terms of Service</Link>
                {' · '}
                <Link to="/trust/gdpr" className="text-teal-600 hover:underline">GDPR Trust Centre</Link>
                {' · '}
                <Link to="/legal/report" className="text-teal-600 hover:underline">Report illegal content</Link>
              </p>
            </div>
          </main>
        </div>
      </div>
    </MainLayout>
  )
}
