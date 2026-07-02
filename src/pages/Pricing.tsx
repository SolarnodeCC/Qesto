import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import {
  enrichPricingMatrix,
  PRICING_MATRIX_BASE,
  type MatrixRowSource,
  type MatrixVal,
} from '../config/pricing-matrix'
import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'
import Reveal from '../components/Reveal'
import { usePlanCatalog } from '../hooks/usePlanCatalog'

const btnPrimary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const btnSecondary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-pulse-900 dark:text-[var(--text-primary)] text-sm border border-pulse-300 dark:border-[var(--color-border-strong)] bg-white dark:bg-[var(--color-surface-elevated)] hover:border-pulse-500 dark:hover:border-[var(--color-border-strong)] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }

function formatEuro(cents: number | null): string | null {
  if (cents === null) return null
  const amount = cents / 100
  return Number.isInteger(amount) ? `€${amount}` : `€${amount.toFixed(2)}`
}

function SourceBadge({ source }: { source: MatrixRowSource }) {
  if (source === 'quota') return null
  const label = source === 'roadmap' ? 'Roadmap' : 'Static copy'
  return (
    <span className="ml-2 inline-flex align-middle text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-pulse-100 text-pulse-700 dark:bg-white/10 dark:text-[var(--text-secondary)]">
      {label}
    </span>
  )
}

const faqs = [
  {
    q: 'What counts as a "session"?',
    a: "A session is one room — one join code, one set of participants, one retention window. Questions inside that room are free. Rooms don't expire until you close them or retention kicks in.",
  },
  {
    q: 'Do participants pay?',
    a: 'Never. Qesto charges the host only—audience sizes still respect each tier’s participant cap listed above.',
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
    a: 'Yes — Pulse stays free within the session and participant limits shown in the feature matrix below. Beyond that, apply for expanded access via the .edu program.',
  },
]

export default function Pricing() {
  const { plans } = usePlanCatalog()
  const free = plans.find((p) => p.id === 'free')
  const starter = plans.find((p) => p.id === 'starter')
  const team = plans.find((p) => p.id === 'team')

  const matrixCategories = useMemo(() => {
    if (!free || !starter || !team) return PRICING_MATRIX_BASE
    return enrichPricingMatrix(PRICING_MATRIX_BASE, free, starter, team)
  }, [free, starter, team])

  const starterAnnual = formatEuro(starter?.pricing.annual_cents ?? 2400)
  const starterMonthly = formatEuro(starter?.pricing.monthly_cents ?? 2900)
  const starterPriceIds = [starter?.pricing.annual_price_id, starter?.pricing.monthly_price_id].filter(Boolean)

  return (
    <MainLayout>
      <PageSeo
        title="Pricing — Qesto"
        description="Start free. Edge inference and consent tooling on every tier; monthly session and per-room caps match in-app enforcement—see the matrix below."
        canonicalPath="/pricing"
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-white dark:bg-[var(--color-bg-subtle)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3 inline-block">Pricing</div>
          <h1
            className="font-bold text-5xl md:text-6xl tracking-tight mb-5 text-pulse-900 dark:text-[var(--text-primary)]"
            style={displayFont}
          >
            Start free. Pay when a room{' '}
            <span className="bg-gradient-to-br from-teal-400 to-violet-500 bg-clip-text text-transparent">
              depends on it.
            </span>
          </h1>
          <p className="text-lg text-pulse-500 dark:text-[var(--text-muted)] leading-relaxed">
            Every plan includes edge inference and consent-aware flows. Session and room-size limits are published per
            tier and match what the product enforces—you don’t get surprise hard-stops after you’ve committed to a
            room.
          </p>
        </div>
      </section>

      {/* Plans */}
      <Reveal as="section" className="pb-16 bg-white dark:bg-[var(--color-bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {/* Pulse */}
            <div className="bg-white dark:bg-[var(--color-surface)] rounded-[20px] p-8 flex flex-col relative" style={shadowCard}>
              <h3 className="font-bold text-2xl tracking-tight mb-2 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
                Pulse
              </h3>
              <p className="text-sm text-pulse-500 dark:text-[var(--text-muted)] mb-6 min-h-[40px]">
                For one-off team pulses and workshop tests. Always free.
              </p>
              <div className="mb-1 leading-none">
                <span className="font-bold text-5xl tracking-tight text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
                  €0
                </span>
                <span className="text-sm font-medium text-pulse-500 dark:text-[var(--text-muted)] ml-1.5">/ host / month</span>
              </div>
              <p className="text-xs text-pulse-500 dark:text-[var(--text-muted)] mb-6 mt-1">
                No credit card.{' '}
                {free
                  ? `Up to ${free.features.sessionsPerMonth} new sessions / month · up to ${free.features.participantsPerSession} participants per session.`
                  : null}
              </p>
              <ul className="space-y-3 text-sm flex-1 mb-7">
                {[
                  free
                    ? `Up to ${free.features.sessionsPerMonth} new sessions per month (monthly reset)`
                    : 'Monthly session allowance',
                  '30-day retention',
                  'Full & cohort anonymity',
                  'AI-powered insights on Chorus',
                  free?.features.resultsExport ? 'CSV exports' : 'CSV exports on paid tiers',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-pulse-700 dark:text-[var(--text-secondary)]">
                    <span className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5">
                      <Check size={18} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/login" className={btnSecondary + ' w-full justify-center dark:bg-[var(--color-surface-elevated)] dark:border-[var(--color-border-strong)] dark:text-[var(--text-primary)]'}>
                Start free
              </Link>
            </div>

            {/* Signal — featured */}
            <div
              className="bg-pulse-900 text-white rounded-[20px] p-8 flex flex-col relative lg:-translate-y-2 dark:ring-1 dark:ring-teal-500/50"
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
                  {starterAnnual ?? '€24'}
                </span>
                <span className="text-sm font-medium text-slate-400 ml-1.5">/ host / month</span>
              </div>
              <p className="text-xs text-slate-400 mb-6 mt-1">
                Billed annually · {starterMonthly ?? '€29'}/mo month-to-month
                {starter
                  ? ` · Up to ${starter.features.sessionsPerMonth} new sessions/mo · ${starter.features.participantsPerSession} participants/room`
                  : ''}
              </p>
              {starterPriceIds.length > 0 ? (
                <p className="text-[11px] text-slate-500 mb-6 -mt-4" style={monoFont}>
                  Stripe prices: {starterPriceIds.join(' / ')}
                </p>
              ) : null}
              <ul className="space-y-3 text-sm flex-1 mb-7">
                {[
                  starter
                    ? `Up to ${starter.features.sessionsPerMonth} new sessions per month`
                    : 'Higher session allowance',
                  '365-day retention, audit exports',
                  'Identified mode + consent logs',
                  starter?.features.insightsAI
                    ? 'Same-day evidence-anchored recap'
                    : 'Evidence-anchored recap (AI insights on Chorus)',
                  starter?.features.semanticSearch
                    ? 'Semantic decision search — find past sessions by meaning, not just keywords'
                    : 'Decision search (Signal and up)',
                  'Webhook integrations on the roadmap',
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
            <div className="bg-white dark:bg-[var(--color-surface)] rounded-[20px] p-8 flex flex-col relative" style={shadowCard}>
              <h3 className="font-bold text-2xl tracking-tight mb-2 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
                Chorus
              </h3>
              <p className="text-sm text-pulse-500 dark:text-[var(--text-muted)] mb-6 min-h-[40px]">
                For HR, events, and compliance-heavy org-wide rollouts.
              </p>
              <div className="mb-1 leading-none">
                <span className="font-bold text-4xl tracking-tight text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
                  Talk to us
                </span>
              </div>
              <p className="text-xs text-pulse-500 dark:text-[var(--text-muted)] mb-6 mt-1">
                Annual contract · custom scope
                {team
                  ? ` · Up to ${team.features.sessionsPerMonth} new sessions/mo · ${team.features.participantsPerSession} participants/room`
                  : ''}
              </p>
              <ul className="space-y-3 text-sm flex-1 mb-7">
                {[
                  team?.features.townhallQA ? 'Townhall Q&A board (Beta — moderated, up to 5 000 participants)' : 'Townhall Q&A (Team tier)',
                  team?.features.samlSso ? 'SAML SSO and role scopes' : 'SSO roadmap — contact sales',
                  'Extended data retention & exports (residency on roadmap)',
                  team?.features.insightsAI ? 'Private Workers AI endpoints' : 'AI insights',
                  'Customer-managed keys on the roadmap',
                  'Dedicated onboarding + SLA',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-pulse-700 dark:text-[var(--text-secondary)]">
                    <span className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5">
                      <Check size={18} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/pricing" className={btnSecondary + ' w-full justify-center dark:bg-[var(--color-surface-elevated)] dark:border-[var(--color-border-strong)] dark:text-[var(--text-primary)]'}>
                Book a walkthrough
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Feature matrix */}
      <Reveal as="section" id="feature-matrix" className="py-16 bg-pulse-50 dark:bg-[var(--color-border)] scroll-mt-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Feature matrix</div>
          <h2 className="font-bold text-4xl tracking-tight mb-2 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
            What's in each plan — line by line.
          </h2>
          <p className="text-pulse-500 dark:text-[var(--text-muted)] mb-8">
            Pulse, Signal, and Chorus are Qesto&apos;s three subscription plans. Rows that tie to quotas or plan flags{' '}
            <span className="font-medium text-pulse-600 dark:text-[var(--text-muted)]">
              hydrate from the same source as billing enforcement
            </span>
            ; other rows describe roadmap or packaging details.
          </p>
          <div className="bg-white dark:bg-[var(--color-surface)] rounded-xl overflow-hidden" style={shadowCard}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-6 py-5 bg-pulse-50 dark:bg-[var(--color-border)] text-xs font-bold uppercase tracking-widest text-pulse-500 dark:text-[var(--text-muted)] border-b border-pulse-200 dark:border-white/5 w-[38%]">
                    Capability
                  </th>
                  {(['Pulse', 'Signal', 'Chorus'] as const).map((p, i) => (
                    <th
                      key={p}
                      className={`px-6 py-5 bg-pulse-50 dark:bg-[var(--color-border)] border-b border-pulse-200 dark:border-white/5 text-center text-[15px] font-bold tracking-tight ${
                        i === 1 ? 'text-teal-700 dark:text-teal-400' : 'text-pulse-900 dark:text-[var(--text-primary)]'
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
                      <tr key={row[0]} className="border-b border-pulse-100 dark:border-white/5 last:border-b-0">
                        <td className="px-6 py-4 font-semibold text-pulse-900 dark:text-[var(--text-primary)] text-sm">
                          {row[0]}
                          <SourceBadge source={row[4]} />
                        </td>
                        {([row[1], row[2], row[3]] as MatrixVal[]).map((v, i) => (
                          <td key={i} className="px-6 py-4 text-center text-pulse-600 dark:text-[var(--text-secondary)] text-[13px]" style={monoFont}>
                            {typeof v === 'boolean' ? (
                              v ? (
                                <span className="text-teal-600 dark:text-teal-400 inline-flex justify-center">
                                  <Check size={18} />
                                </span>
                              ) : (
                                <span className="text-pulse-500 inline-flex justify-center">
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
          <p className="text-sm text-pulse-500 dark:text-[var(--text-muted)] mt-6 max-w-3xl">
            Numeric limits and quota-backed feature flags mirror{' '}
            <code className="text-xs text-pulse-700 dark:text-[var(--text-secondary)] bg-pulse-100 dark:bg-white/10 px-1 rounded">PLAN_QUOTAS</code> via{' '}
            <code className="text-xs text-pulse-700 dark:text-[var(--text-secondary)] bg-pulse-100 dark:bg-white/10 px-1 rounded">GET /api/plans/catalog</code>.
            Rows tagged static copy or roadmap are packaging claims to review against product/commerce plans before
            launch.
          </p>
        </div>
      </Reveal>

      {/* Nonprofit */}
      <Reveal as="section" className="py-16 bg-white dark:bg-[var(--color-bg-subtle)]">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">
            Nonprofit & education
          </div>
          <h2 className="font-bold text-4xl tracking-tight mb-4 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
            Mission-first means budget-second.
          </h2>
          <p className="text-pulse-500 dark:text-[var(--text-muted)] mb-6 leading-relaxed">
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
      </Reveal>

      {/* FAQ */}
      <Reveal as="section" className="py-16 bg-pulse-50 dark:bg-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Pricing questions</div>
          <h2 className="font-bold text-4xl tracking-tight mb-8 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
            Answers to what you're about to ask.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {faqs.map(({ q, a }) => (
              <div key={q}>
                <h3 className="font-semibold text-[17px] mb-2 text-pulse-900 dark:text-[var(--text-primary)]">{q}</h3>
                <p className="text-sm text-pulse-500 dark:text-[var(--text-muted)] leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* CTA band */}
      <Reveal className="py-10 px-6">
        <div className="max-w-6xl mx-auto bg-pulse-900 rounded-[2rem] text-white text-center py-16 px-8">
          <h2 className="font-bold text-4xl tracking-tight mb-3" style={displayFont}>
            Start with Pulse. Scale when the room does.
          </h2>
          <p className="text-slate-400 mb-8">
            Pulse stays within published monthly and room limits. Upgrade when you need longer retention, consent
            logs, or richer exports.
          </p>
          <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
            Create your workspace
          </Link>
        </div>
      </Reveal>
    </MainLayout>
  )
}
