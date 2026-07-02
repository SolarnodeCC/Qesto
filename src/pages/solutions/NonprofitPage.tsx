import { Link } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'

const NONPROFIT_APPLY_MAILTO =
  'mailto:support@qesto.cc?subject=Nonprofit%20pricing%20application&body=Organization%20name%3A%0ARegistration%20number%3A%0ACountry%3A%0AContact%20email%3A'
import PageSeo from '../../components/PageSeo'

const btnPrimary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const btnSecondary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-pulse-900 dark:text-[#F0F2F8] text-sm border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-[#1C2540] hover:border-pulse-500 dark:hover:border-[#3A4870] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }

const checklist = [
  { title: 'Quorum tracking.', desc: 'Live count of present vs. required, surfaced to the chair.' },
  { title: 'Proxy support.', desc: "Pre-load proxy votes against absent directors' names, with delegate on record." },
  { title: 'Roll-call mode.', desc: 'Each vote logged by name, in order, for bylaw compliance.' },
  { title: 'Secret ballot mode.', desc: 'Tally without identities — useful for officer elections and sensitive motions.' },
  { title: 'Conflict disclosure.', desc: 'Directors flag conflicts per motion; noted in minutes automatically.' },
  { title: 'Consent log.', desc: "Every director's visibility choice stamped to the meeting — auditable by your secretary." },
  { title: 'Exportable vote record.', desc: 'Download CSV tallies for your minutes. Signed PDF minutes are roadmap work.' },
  { title: 'Bylaw templates.', desc: 'Starter templates for 501(c)(3), UK CIO, Stichting, Verein structures.' },
]

export default function NonprofitPage() {
  return (
    <MainLayout>
      <PageSeo
        title="Qesto for Nonprofit Boards — Motions on the record"
        description="Roll-call votes, secret ballots, and chair-called polls — run inside your board meeting, exported as the minutes themselves."
        canonicalPath="/nonprofit"
        ogImage="/images/solutions/photo-1681949103006-70066fb25dfe.avif"
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">
                Qesto for Nonprofit Boards
              </div>
              <h1 className="font-bold text-5xl tracking-tight mb-5 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
                Motions on the record.{' '}
                <span className="bg-gradient-to-br from-teal-400 to-violet-500 bg-clip-text text-transparent">
                  Minutes before the meeting ends.
                </span>
              </h1>
              <p className="text-lg text-pulse-500 dark:text-[#8A96B0] leading-relaxed mb-8">
                Roll-call votes, secret ballots, and chair-called polls — run inside your board meeting, exported as
                the minutes themselves. Identity logged where bylaws require it; anonymized where they don't.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <Link to="/pricing" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
                  Book a board demo
                </Link>
                <Link to="/pricing" className={btnSecondary + ' text-base px-7 py-3.5 dark:bg-[#1C2540] dark:border-[#2A3858] dark:text-[#F0F2F8]'}>
                  See exported minutes
                </Link>
                <span className="text-xs text-pulse-500" style={monoFont}>
                  Bylaw templates included
                </span>
              </div>
            </div>

            {/* Minutes mockup */}
            <div
              className="bg-white dark:bg-[#1C2540] rounded-[20px] p-8 relative"
              style={{ ...shadowElevated, fontFamily: 'var(--font-family-mono)', fontSize: 13, lineHeight: 1.8, color: '#262626' }}
            >
              <div
                className="absolute top-3 right-4 text-[11px] font-bold uppercase tracking-widest text-pulse-500 dark:text-[#8A96B0]"
                style={{ fontFamily: 'var(--font-family-body)' }}
              >
                Minutes · 2026-03-14
              </div>
              <div className="font-bold text-[20px] mb-4 text-pulse-900 dark:text-[#F0F2F8] tracking-tight" style={{ fontFamily: 'var(--font-family-display)' }}>
                Q1 Board Meeting
              </div>
              <div>ATTENDANCE: 9 of 11 directors present (quorum met).</div>
              <div
                className="my-3.5 p-3 pl-4 rounded-r-lg"
                style={{ background: '#FAFAFA', borderLeft: '3px solid #14B8A6' }}
              >
                <strong className="block text-sm text-pulse-900" style={{ fontFamily: 'var(--font-family-body)' }}>
                  Motion 2026-03-14.02
                </strong>
                Approve operating budget of €2.14M for fiscal year 2026.
              </div>
              <div
                className="flex gap-5 py-2 text-[12px] border-t border-dashed border-pulse-200"
              >
                Identified vote · For:{' '}
                <strong className="text-teal-700 ml-1">7</strong> · Against:{' '}
                <strong className="text-teal-700 ml-1">1</strong> · Abstain:{' '}
                <strong className="text-teal-700 ml-1">1</strong>
              </div>
              <div
                className="my-3.5 p-3 pl-4 rounded-r-lg"
                style={{ background: '#FAFAFA', borderLeft: '3px solid #14B8A6' }}
              >
                <strong className="block text-sm text-pulse-900" style={{ fontFamily: 'var(--font-family-body)' }}>
                  Motion 2026-03-14.03
                </strong>
                Appoint S. Okafor as Treasurer, term expiring 2028.
              </div>
              <div className="flex gap-5 py-2 text-[12px] border-t border-dashed border-pulse-200">
                Secret ballot · For:{' '}
                <strong className="text-teal-700 ml-1">8</strong> · Against:{' '}
                <strong className="text-teal-700 ml-1">1</strong> · Abstain:{' '}
                <strong className="text-teal-700 ml-1">0</strong>
              </div>
              <div className="mt-5 pt-3.5 border-t border-pulse-200 dark:border-[#1E2A45] flex justify-between text-[11px] text-pulse-500 dark:text-[#8A96B0]" style={{ fontFamily: 'var(--font-family-body)' }}>
                <span>Signed: M. Holloway, Secretary</span>
                <span>Qesto session QSTO-8H3P</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 bg-pulse-50 dark:bg-[#0F1525]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">How a motion moves</div>
          <h2 className="font-bold text-4xl tracking-tight mb-8 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Four steps from "any objections?" to signed minutes.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-pulse-200 dark:divide-[#1E2A45] bg-white dark:bg-[#151C2E] rounded-2xl overflow-hidden">
            {[
              { num: '01', title: 'Chair calls the vote', desc: 'Pick the motion from the agenda, set identified or secret, and launch. Every director\'s device lights up.' },
              { num: '02', title: 'Directors cast', desc: 'For, against, abstain. Quorum tracked live. Proxy votes pre-loaded against the director\'s name.' },
              { num: '03', title: 'Tally locked', desc: 'Chair seals the vote. Tally freezes on the projected screen. Changes require re-opening with a new motion.' },
              { num: '04', title: 'Vote record exported', desc: 'CSV tallies are available for the secretary to attach to the minutes. Signed PDF minutes are roadmap work.' },
            ].map(({ num, title, desc }) => (
              <div key={num} className="p-7">
                <div className="text-teal-700 dark:text-teal-400 font-semibold text-[12px] mb-2.5" style={monoFont}>Step {num}</div>
                <h3 className="font-semibold text-[17px] mb-2 text-pulse-900 dark:text-[#F0F2F8]">{title}</h3>
                <p className="text-[13.5px] text-pulse-500 dark:text-[#8A96B0] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Checklist */}
      <section className="py-16 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">What you get on every meeting</div>
          <h2 className="font-bold text-4xl tracking-tight mb-8 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            A governance tool, not a polling gimmick.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 gap-x-8">
            {checklist.map(({ title, desc }) => (
              <div key={title} className="flex gap-3 items-start">
                <span className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5">
                  <CheckCircle size={18} />
                </span>
                <span className="text-sm text-pulse-600 dark:text-[#A8B3CC]">
                  <strong className="text-pulse-900 dark:text-[#F0F2F8] font-semibold">{title}</strong> {desc}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-16 bg-pulse-50 dark:bg-[#0F1525]">
        <div className="max-w-6xl mx-auto px-6">
          <blockquote className="max-w-3xl mx-auto text-center">
            <p className="text-[20px] leading-relaxed text-pulse-900 dark:text-[#F0F2F8] mb-6 italic">
              "Our board meetings used to run 40 minutes long because the secretary was transcribing. Now we adjourn
              on time, and the minutes are in my inbox before I reach the elevator."
            </p>
            <footer className="text-sm text-pulse-500 dark:text-[#8A96B0]">
              <strong className="text-pulse-900 dark:text-[#F0F2F8]">Teodora Marin</strong> · Board Chair, regional arts foundation
            </footer>
          </blockquote>
        </div>
      </section>

      {/* Nonprofit pricing */}
      <section className="py-16 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Pricing for nonprofits</div>
          <h2 className="font-bold text-4xl tracking-tight mb-4 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Chorus at 40% off. Because mission-first means budget-second.
          </h2>
          <p className="text-pulse-500 dark:text-[#8A96B0] mb-6 text-lg leading-relaxed max-w-3xl">
            Registered 501(c)(3), UK charity, and EU nonprofit entities get Chorus pricing discounted across SSO,
            custom retention, and bylaw-templated motions. No seat caps.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={NONPROFIT_APPLY_MAILTO} className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
              Apply for nonprofit pricing
            </a>
            <Link to="/pricing" className={btnSecondary + ' text-base px-7 py-3.5 dark:bg-[#1C2540] dark:border-[#2A3858] dark:text-[#F0F2F8]'}>
              See full plan matrix
            </Link>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <div className="py-10 px-6">
        <div className="max-w-6xl mx-auto bg-pulse-900 rounded-[2rem] text-white text-center py-16 px-8">
          <h2 className="font-bold text-4xl tracking-tight mb-3" style={displayFont}>
            Your board deserves a receipt.
          </h2>
          <p className="text-slate-400 mb-8">
            Signed minutes, before the meeting ends. Try Qesto free for your next board session.
          </p>
          <Link to="/pricing" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
            Book a board demo
          </Link>
        </div>
      </div>
    </MainLayout>
  )
}
