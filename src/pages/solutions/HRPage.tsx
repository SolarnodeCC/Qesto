import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, MapPin, Trash2 } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import PageSeo from '../../components/PageSeo'

const btnPrimary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const btnSecondary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-pulse-900 dark:text-[#F0F2F8] text-sm border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-[#1C2540] hover:border-pulse-500 dark:hover:border-[#3A4870] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }

const useCases = [
  {
    tag: 'Quarterly pulse',
    title: 'Climate check across the org',
    desc: 'Ship a 6-question pulse to everyone who shows up to the all-hands. Results anchored to the meeting, not a dashboard people ignore.',
    items: [
      'Full anonymity by default',
      'Per-team breakdowns with min-tally gating',
      'AI recap of open comments, deduplicated by theme',
    ],
  },
  {
    tag: 'Manager 360',
    title: 'Upward feedback with a floor',
    desc: 'Direct reports rate a manager anonymously; results unlock only if at least five reports voted. Below that, the session ends with no data shown.',
    items: [
      'Cohort-visible mode (HR sees, manager sees aggregate only)',
      'Free-text themes, never raw quotes',
      'Identity deleted 30 days after close',
    ],
  },
  {
    tag: 'DEIB listening',
    title: "Sessions that don't chill the room",
    desc: 'Run ERG listening circles where the host sets the right visibility posture for the session before sensitive questions open.',
    items: [
      'Session-level visibility posture',
      'Consent log attached to every export',
      'CSV export today; HRIS/webhook integrations on roadmap',
    ],
  },
  {
    tag: 'Exit & onboarding',
    title: 'First 90 / last 90',
    desc: 'A short, standard cadence that runs itself. Same instrument every cycle means trends you can actually compare across quarters.',
    items: [
      'Scheduled sessions with auto-reminders',
      'Benchmark mode (compare cohort to rolling org average)',
      'Reviewed recap source for employee files',
    ],
  },
]

type Mode = 'anon' | 'cohort' | 'ident'

export default function HRPage() {
  const [mode, setMode] = useState<Mode>('anon')

  return (
    <MainLayout>
      <PageSeo
        title="Qesto for HR — Honest pulse without a witch hunt"
        description="Run quarterly climate checks, manager 360s, and open-comment sessions where people actually speak. Consent rounds protect every voice."
        canonicalPath="/hr"
        ogImage="/images/solutions/photo-1543269865-cbf427effbad.avif"
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Qesto for HR</div>
              <h1 className="font-bold text-5xl tracking-tight mb-5 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
                Honest pulse.{' '}
                <span className="bg-gradient-to-br from-teal-400 to-violet-500 bg-clip-text text-transparent">
                  Without a witch hunt.
                </span>
              </h1>
              <p className="text-lg text-pulse-500 dark:text-[#6B7A99] leading-relaxed mb-8">
                Run quarterly climate checks, manager 360s, and open-comment sessions where people actually speak.
                Consent rounds mean every attendee picks their visibility before the first vote — and no result is
                shown until the floor is large enough to protect them.
              </p>
              <div className="flex flex-wrap gap-3 items-center">
                <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
                  Start a pulse
                </Link>
                <Link to="/pricing" className={btnSecondary + ' text-base px-7 py-3.5 dark:bg-[#1C2540] dark:border-[#2A3858] dark:text-[#F0F2F8]'}>
                  Book a walkthrough
                </Link>
                <span className="text-xs text-pulse-500" style={{ fontFamily: 'var(--font-family-mono)' }}>
                  Access controls · DPA request · enterprise security roadmap
                </span>
              </div>
            </div>

            {/* Mode card */}
            <div className="bg-white dark:bg-[#151C2E] rounded-[20px] p-6" style={shadowElevated}>
              {/* Tabs */}
              <div className="flex gap-1.5 p-1 bg-pulse-100 dark:bg-[#1E2A45] rounded-xl mb-5">
                {([['anon', 'Anonymous'], ['cohort', 'Cohort-visible'], ['ident', 'Identified']] as [Mode, string][]).map(
                  ([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setMode(key)}
                      className={`flex-1 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                        mode === key
                          ? 'bg-white dark:bg-[#151C2E] text-pulse-900 dark:text-[#F0F2F8] shadow-[var(--shadow-card)]'
                          : 'text-pulse-500 dark:text-[#6B7A99]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                )}
              </div>

              {/* Rows */}
              <div className="space-y-2.5 mb-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-pulse-50 dark:bg-[#0F1525]">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${
                        mode === 'ident'
                          ? 'text-white'
                          : 'bg-pulse-300 text-pulse-600'
                      }`}
                      style={mode === 'ident' ? gradientBrand : {}}
                    >
                      {mode === 'ident' ? (i === 1 ? 'AK' : 'PR') : '?'}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-pulse-900 dark:text-[#F0F2F8]">
                        {mode === 'ident' ? (i === 1 ? 'Alex Kim' : 'Priya Rao') : 'Participant'}
                      </div>
                      <div className="text-[13px] text-pulse-500 dark:text-[#6B7A99]">
                        {mode === 'anon' && 'Vote recorded · No identity linked'}
                        {mode === 'cohort' && `Vote recorded · ${i === 1 ? 'Engineering' : 'Design'} team`}
                        {mode === 'ident' && (
                          <>
                            Vote recorded ·{' '}
                            <span className="text-teal-700 dark:text-teal-400 font-medium">Strongly agree</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tally */}
              <div className="p-4 rounded-xl bg-pulse-50 dark:bg-[#0F1525] space-y-2">
                {[
                  { lbl: 'Strongly agree', pct: 62, n: 29 },
                  { lbl: 'Agree', pct: 26, n: 12 },
                  { lbl: 'Disagree', pct: 12, n: 6 },
                ].map(({ lbl, pct, n }) => (
                  <div key={lbl} className="flex items-center gap-2.5 text-[13px]">
                    <span className="w-[90px] font-medium text-pulse-700 dark:text-[#A8B3CC]">{lbl}</span>
                    <div className="flex-1 h-2.5 bg-white dark:bg-[#1E2A45] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, ...gradientBrand }} />
                    </div>
                    <span className="w-8 text-right text-pulse-500" style={{ fontFamily: 'var(--font-family-mono)', fontVariantNumeric: 'tabular-nums' }}>
                      {n}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof stats */}
      <section className="py-16 bg-pulse-50 dark:bg-[#0F1525]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Proof</div>
          <h2 className="font-bold text-4xl tracking-tight mb-8 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            HR teams run Qesto when results have to be defensible.
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { label: 'Consent opt-in rate', value: '94%', note: 'Avg across deployed pulses — measured at the start of every session.' },
              { label: 'Free-text response rate', value: '3.1×', note: 'vs. identified surveys among the same cohorts.' },
              { label: 'Minimum tally threshold', value: '5', note: 'Results stay hidden until five voices are in. No single-voter exposure.' },
              { label: 'Recap source readiness', value: 'Same day', note: 'Session exports and reviewed themes support the follow-up package.' },
            ].map(({ label, value, note }) => (
              <div key={label} className="bg-white dark:bg-[#151C2E] rounded-2xl p-6" style={shadowCard}>
                <div className="text-[13px] text-pulse-500 dark:text-[#6B7A99] mb-2">{label}</div>
                <div className="font-bold text-4xl tracking-tight text-pulse-900 dark:text-[#F0F2F8] mb-2" style={displayFont}>{value}</div>
                <div className="text-[13px] text-pulse-500 dark:text-[#6B7A99] leading-snug">{note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Where it fits</div>
          <h2 className="font-bold text-4xl tracking-tight mb-3 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Four HR moments Qesto was built for.
          </h2>
          <p className="text-pulse-500 dark:text-[#6B7A99] mb-8 text-lg">
            Each one demands a different consent posture. Qesto is the only tool that lets the room choose.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {useCases.map(({ tag, title, desc, items }) => (
              <div key={title} className="bg-white dark:bg-[#151C2E] rounded-2xl p-7" style={shadowCard}>
                <div className="text-[11px] font-bold uppercase tracking-widest text-teal-700 dark:text-teal-400 mb-2">{tag}</div>
                <h3 className="font-semibold text-[20px] mb-2.5 text-pulse-900 dark:text-[#F0F2F8]">{title}</h3>
                <p className="text-pulse-500 dark:text-[#6B7A99] text-sm leading-relaxed mb-4">{desc}</p>
                <ul className="list-disc pl-4 space-y-1 text-sm text-pulse-500 dark:text-[#6B7A99]">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
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
              "We used to spend two weeks arguing about whether the engagement survey was honest. Now we run the
              pulse in the room, see the tally, and the argument is about what to do about it."
            </p>
            <footer className="text-sm text-pulse-500 dark:text-[#6B7A99]">
              <strong className="text-pulse-900 dark:text-[#F0F2F8]">Priya Ramanathan</strong> · Chief People Officer, mid-market SaaS
              (pilot customer)
            </footer>
          </blockquote>
        </div>
      </section>

      {/* Compliance */}
      <section className="py-16 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Compliance posture</div>
          <h2 className="font-bold text-4xl tracking-tight mb-8 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Built to survive your legal team.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: <ShieldCheck size={22} />,
                title: 'Consent logged, not assumed',
                desc: "Every participant's visibility choice is timestamped and stored with the session. Exports include the log so a works council can verify.",
              },
              {
                icon: <MapPin size={22} />,
                title: 'EU residency by default',
                desc: 'Qesto runs on Cloudflare Workers, Durable Objects, and Workers AI. Formal residency guarantees and procurement packets are enterprise roadmap items.',
              },
              {
                icon: <Trash2 size={22} />,
                title: 'Retention you pick',
                desc: 'Identity rows purge on your schedule — 30 days, 90, custom. Aggregate tallies live longer for trend reporting, with no link back.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white dark:bg-[#151C2E] rounded-2xl p-7" style={shadowCard}>
                <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-500/12 text-teal-700 dark:text-teal-400 flex items-center justify-center mb-4">
                  {icon}
                </div>
                <h3 className="font-semibold text-[18px] mb-2 text-pulse-900 dark:text-[#F0F2F8]">{title}</h3>
                <p className="text-sm leading-relaxed text-pulse-500 dark:text-[#6B7A99]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <div className="py-10 px-6">
        <div className="max-w-6xl mx-auto bg-pulse-900 rounded-[2rem] text-white text-center py-16 px-8">
          <h2 className="font-bold text-4xl tracking-tight mb-3" style={displayFont}>
            Pilot one pulse. Keep it if the room does.
          </h2>
          <p className="text-slate-400 mb-8">
            Run your next climate check on Qesto. If the response rate doesn't beat your last survey, we'll refund
            the quarter.
          </p>
          <Link to="/pricing" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
            Book an HR walkthrough
          </Link>
        </div>
      </div>
    </MainLayout>
  )
}
