import React from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'

const btnPrimary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const btnSecondary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-pulse-900 text-sm border border-pulse-300 bg-white hover:border-pulse-500 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }

type MatrixVal = boolean | string

const matrixCategories: { section: string; rows: [string, MatrixVal, MatrixVal, MatrixVal][] }[] = [
  {
    section: 'Sessions & participants',
    rows: [
      ['Active sessions at once', '3', 'Unlimited', 'Unlimited'],
      ['Participants per session', 'Unlimited', 'Unlimited', 'Unlimited'],
      ['Question types', '8', '8', '8 + custom'],
      ['Retention', '30 days', '365 days', '7d – 7yr'],
    ],
  },
  {
    section: 'Privacy & consent',
    rows: [
      ['Full anonymity mode', true, true, true],
      ['Cohort-visible mode', true, true, true],
      ['Identified mode + consent log', false, true, true],
      ['Minimum tally gating', '5 (fixed)', 'Configurable', 'Configurable'],
    ],
  },
  {
    section: 'AI insights',
    rows: [
      ['AI draft recaps', '5 / mo', 'Unlimited', 'Unlimited'],
      ['Evidence-anchored clusters', false, true, true],
      ['Private Workers AI endpoint', false, false, true],
    ],
  },
  {
    section: 'Admin & compliance',
    rows: [
      ['SSO (OIDC, SAML)', false, 'Google, Okta', 'All IdPs + SCIM'],
      ['Data residency', 'Global', 'EU or US', 'Custom'],
      ['DPA & SOC 2 report', 'DPA only', true, true],
      ['Customer-managed keys', false, false, true],
      ['Uptime SLA', '—', '99.9%', '99.95%'],
    ],
  },
  {
    section: 'Integrations',
    rows: [
      ['CSV / PDF / JSON export', true, true, true],
      ['Webhooks (Slack, Notion, Workday)', false, true, true],
      ['Branded domain & PDF templates', false, false, true],
    ],
  },
]

const faqs = [
  {
    q: 'What counts as a "session"?',
    a: "A session is one room — one join code, one set of participants, one retention window. Questions inside that room are free. Rooms don't expire until you close them or retention kicks in.",
  },
  {
    q: 'Do participants pay?',
    a: 'Never. Qesto charges the host only. An audience of 5 and an audience of 5,000 cost the same.',
  },
  {
    q: 'Can I cancel?',
    a: 'Yes, any time, from the billing page. Monthly cancels immediately with no refund on the current month. Annual cancels at renewal.',
  },
  {
    q: "What if my first pulse flops?",
    a: "If your first session doesn't beat the response rate of your last survey, email us within 14 days of your first billing. We'll refund the full quarter.",
  },
  {
    q: 'How does usage-based billing work on Chorus?',
    a: "It doesn't. Chorus is a flat annual. No per-session, per-seat, or per-response surprises.",
  },
  {
    q: 'Is there a free tier for students?',
    a: 'Yes — Pulse is free forever, no cap on participants. For coursework at scale (> 3 concurrent rooms), we grant free Signal access via the .edu program.',
  },
]

export default function Pricing() {
  return (
    <MainLayout>
      <PageSeo
        title="Pricing — Qesto"
        description="Start free. Pay when a room depends on it. Every plan includes edge inference, consent rounds, and unlimited participants."
        canonicalPath="/pricing"
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-3 inline-block">Pricing</div>
          <h1
            className="font-bold text-5xl md:text-6xl tracking-tight mb-5 text-pulse-900"
            style={displayFont}
          >
            Start free. Pay when a room{' '}
            <span className="bg-gradient-to-br from-teal-400 to-violet-500 bg-clip-text text-transparent">
              depends on it.
            </span>
          </h1>
          <p className="text-lg text-pulse-500 leading-relaxed">
            Every plan includes edge inference, consent rounds, and unlimited participants. You pay for sessions and
            retention — not for voices in the room.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {/* Pulse */}
            <div className="bg-white rounded-[20px] p-8 flex flex-col relative" style={shadowCard}>
              <h3 className="font-bold text-2xl tracking-tight mb-2 text-pulse-900" style={displayFont}>
                Pulse
              </h3>
              <p className="text-sm text-pulse-500 mb-6 min-h-[40px]">
                For one-off team pulses and workshop tests. Always free.
              </p>
              <div className="mb-1 leading-none">
                <span className="font-bold text-5xl tracking-tight text-pulse-900" style={displayFont}>
                  €0
                </span>
                <span className="text-sm font-medium text-pulse-500 ml-1.5">/ host / month</span>
              </div>
              <p className="text-xs text-pulse-500 mb-6 mt-1">No credit card. No session caps on free tier.</p>
              <ul className="space-y-3 text-sm flex-1 mb-7">
                {[
                  '3 active sessions at a time',
                  '30-day retention',
                  'Full & cohort anonymity',
                  'Workers AI drafts — 5 / month',
                  'CSV & PDF exports',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-pulse-700">
                    <span className="text-teal-600 flex-shrink-0 mt-0.5">
                      <Check size={18} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/login" className={btnSecondary + ' w-full justify-center'}>
                Start free
              </Link>
            </div>

            {/* Signal — featured */}
            <div
              className="bg-pulse-900 text-white rounded-[20px] p-8 flex flex-col relative lg:-translate-y-2"
              style={shadowElevated}
            >
              <div
                className="absolute -top-3 left-6 text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                style={gradientBrand}
              >
                Most chosen
              </div>
              <h3 className="font-bold text-2xl tracking-tight mb-2" style={displayFont}>
                Signal
              </h3>
              <p className="text-sm text-slate-400 mb-6 min-h-[40px]">
                For facilitators running recurring rooms every week.
              </p>
              <div className="mb-1 leading-none">
                <span className="font-bold text-5xl tracking-tight" style={displayFont}>
                  €24
                </span>
                <span className="text-sm font-medium text-slate-400 ml-1.5">/ host / month</span>
              </div>
              <p className="text-xs text-slate-400 mb-6 mt-1">Billed annually · €29/mo month-to-month</p>
              <ul className="space-y-3 text-sm flex-1 mb-7">
                {[
                  'Unlimited sessions & recaps',
                  '365-day retention, audit exports',
                  'Identified mode + consent logs',
                  'Same-day evidence-anchored recap',
                  'Slack, Notion, Workday webhooks',
                  'Stripe-billed, cancel anytime',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <span className="text-teal-400 flex-shrink-0 mt-0.5">
                      <Check size={18} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/login"
                className={btnPrimary + ' w-full justify-center !bg-white !text-pulse-900 hover:shadow-lg'}
              >
                Start 14-day trial
              </Link>
            </div>

            {/* Chorus */}
            <div className="bg-white rounded-[20px] p-8 flex flex-col relative" style={shadowCard}>
              <h3 className="font-bold text-2xl tracking-tight mb-2 text-pulse-900" style={displayFont}>
                Chorus
              </h3>
              <p className="text-sm text-pulse-500 mb-6 min-h-[40px]">
                For HR, events, and compliance-heavy org-wide rollouts.
              </p>
              <div className="mb-1 leading-none">
                <span className="font-bold text-4xl tracking-tight text-pulse-900" style={displayFont}>
                  Talk to us
                </span>
              </div>
              <p className="text-xs text-pulse-500 mb-6 mt-1">Annual contract · custom scope</p>
              <ul className="space-y-3 text-sm flex-1 mb-7">
                {[
                  'SSO, SCIM, role scopes',
                  'Custom retention & residency',
                  'Private Workers AI endpoints',
                  'Customer-managed encryption keys',
                  'Dedicated onboarding + SLA',
                  'Branded domain & PDF templates',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-pulse-700">
                    <span className="text-teal-600 flex-shrink-0 mt-0.5">
                      <Check size={18} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/pricing" className={btnSecondary + ' w-full justify-center'}>
                Book a walkthrough
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Feature matrix */}
      <section className="py-16 bg-pulse-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-3">Feature matrix</div>
          <h2 className="font-bold text-4xl tracking-tight mb-2 text-pulse-900" style={displayFont}>
            What's in each plan — line by line.
          </h2>
          <p className="text-pulse-500 mb-8">
            No asterisks, no hidden tier. If it's in the column, it's in the plan.
          </p>
          <div className="bg-white rounded-2xl overflow-hidden" style={shadowCard}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-6 py-5 bg-pulse-50 text-xs font-bold uppercase tracking-widest text-pulse-500 border-b border-pulse-200 w-[38%]">
                    Capability
                  </th>
                  {(['Pulse', 'Signal', 'Chorus'] as const).map((p, i) => (
                    <th
                      key={p}
                      className={`px-6 py-5 bg-pulse-50 border-b border-pulse-200 text-center text-[15px] font-bold tracking-tight ${
                        i === 1 ? 'text-teal-700' : 'text-pulse-900'
                      }`}
                      style={displayFont}
                    >
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixCategories.map(({ section, rows }) => (
                  <React.Fragment key={section}>
                    <tr>
                      <td
                        colSpan={4}
                        className="bg-pulse-900 text-white px-6 py-3 text-xs font-bold uppercase tracking-widest"
                        style={displayFont}
                      >
                        {section}
                      </td>
                    </tr>
                    {rows.map((row) => (
                      <tr key={row[0]} className="border-b border-pulse-100 last:border-b-0">
                        <td className="px-6 py-4 font-semibold text-pulse-900 text-sm">{row[0]}</td>
                        {([row[1], row[2], row[3]] as MatrixVal[]).map((v, i) => (
                          <td key={i} className="px-6 py-4 text-center text-pulse-600 text-[13px]" style={monoFont}>
                            {typeof v === 'boolean' ? (
                              v ? (
                                <span className="text-teal-600 inline-flex justify-center">
                                  <Check size={18} />
                                </span>
                              ) : (
                                <span className="text-pulse-300 inline-flex justify-center">
                                  <X size={18} />
                                </span>
                              )
                            ) : (
                              v
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Nonprofit */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-3">
            Nonprofit & education
          </div>
          <h2 className="font-bold text-4xl tracking-tight mb-4 text-pulse-900" style={displayFont}>
            Mission-first means budget-second.
          </h2>
          <p className="text-pulse-500 mb-6 leading-relaxed">
            Registered nonprofits and accredited educational institutions get Chorus at 40% off. Apply with a copy
            of your registration and we'll turn it around in 48 hours.
          </p>
          <Link
            to="/pricing"
            className={btnPrimary + ' text-base px-7 py-3.5'}
            style={gradientBrand}
          >
            Apply for nonprofit pricing
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-pulse-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-3">Pricing questions</div>
          <h2 className="font-bold text-4xl tracking-tight mb-8 text-pulse-900" style={displayFont}>
            Answers to what you're about to ask.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {faqs.map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-semibold text-[17px] mb-2 text-pulse-900">{q}</h3>
                <p className="text-sm text-pulse-500 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <div className="py-10 px-6">
        <div className="max-w-6xl mx-auto bg-pulse-900 rounded-[2rem] text-white text-center py-16 px-8">
          <h2 className="font-bold text-4xl tracking-tight mb-3" style={displayFont}>
            Start with Pulse. Scale when the room does.
          </h2>
          <p className="text-slate-400 mb-8">
            Free forever. Upgrade in one click when you need longer retention or identified mode.
          </p>
          <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
            Create your workspace
          </Link>
        </div>
      </div>
    </MainLayout>
  )
}
