import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import PageSeo from '../../components/PageSeo'
import Reveal from '../../components/Reveal'

const btnPrimary =
  'inline-flex items-center justify-center px-8 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const btnSecondary =
  'inline-flex items-center justify-center px-8 py-3 rounded-lg font-medium text-pulse-900 dark:text-[#F0F2F8] text-sm border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-[#1C2540] hover:border-pulse-500 dark:hover:border-[#3A4870] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }

type ConsentMode = 'identified' | 'cohort' | 'anonymous'

const consentOptions: { key: ConsentMode; name: string; desc: string; tag: string }[] = [
  { key: 'identified', name: 'Identified', desc: 'Your name and votes are linked. Useful for board meetings and named feedback.', tag: 'name + vote' },
  { key: 'cohort', name: 'Cohort-visible', desc: 'Your vote is attributed to your team, not you. Teams of 5+ only.', tag: 'team + vote' },
  { key: 'anonymous', name: 'Anonymous', desc: 'Votes are stored without identity or cohort labels. Hashed anti-abuse metadata may still be used to protect the session.', tag: 'vote only' },
]

const doGuarantees = [
  { title: 'We store per-session', desc: 'Every session is isolated. Data lives there until deletion. No cross-session joins, ever.' },
  { title: 'We log every consent choice', desc: "Each participant's visibility pick is timestamped. Exports include the log. Auditable by a works council." },
  { title: 'We gate results by tally', desc: 'A result is hidden until the minimum vote count is met. Default 5. No single-voter exposure, anywhere.' },
  { title: 'We purge on schedule', desc: 'Identity rows purge on the retention you pick. Aggregate tallies can live longer — without link back.' },
]

const dontGuarantees = [
  { title: "We don't sell data", desc: 'No ads network, no data broker, no telemetry pipeline to a third party. Your tallies are yours.' },
  { title: "We don't train on you", desc: "Nothing in Qesto feeds a training run — not ours, not anyone's. Analysis happens privately and is never used to train any model." },
  { title: "We don't route to third-party AI", desc: "No OpenAI, no Anthropic, no Azure. Inference runs through Cloudflare Workers AI." },
  { title: "We don't resolve identity late", desc: "Once a vote is anonymous, it stays anonymous. We can't un-anonymize — not for subpoena, not for us." },
]

const certs = [
  { name: 'GDPR', label: 'DPA request' },
  { name: 'Security', label: 'Access controls' },
  { name: 'AI', label: 'Workers AI only' },
  { name: 'Chorus', label: 'Roadmap packet' },
]

export default function PrivacyFeaturePage() {
  const [selected, setSelected] = useState<ConsentMode>('anonymous')

  return (
    <MainLayout>
      <PageSeo
        title="Privacy by Default — Qesto"
        description="Every Qesto session starts with a consent round. Participants choose whether they're identified, cohort-visible, or fully anonymous."
        canonicalPath="/features/privacy"
        ogImage="/images/solutions/photo-1543269865-cbf427effbad.avif"
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Privacy by Default</div>
              <h1 className="font-bold text-5xl tracking-tight mb-6 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
                The room{' '}
                <span className="bg-gradient-to-br from-teal-400 to-violet-500 bg-clip-text text-transparent">
                  picks its posture.
                </span>
              </h1>
              <p className="text-lg text-pulse-500 dark:text-[#8A96B0] leading-relaxed mb-12">
                Every Qesto session starts with a consent round. Participants choose whether they're identified,
                cohort-visible, or fully anonymous for the session. Results stay hidden until the minimum tally is met.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/privacy" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
                  Read the DPA
                </Link>
                <Link to="/privacy" className={btnSecondary + ' text-base px-7 py-3.5 dark:bg-[#1C2540] dark:border-[#2A3858] dark:text-[#F0F2F8]'}>
                  Full privacy policy
                </Link>
              </div>
            </div>

            {/* Consent picker */}
            <div className="bg-white dark:bg-[#151C2E] rounded-[20px] p-7" style={shadowElevated}>
              <h3 className="font-semibold text-[17px] mb-1.5 text-pulse-900 dark:text-[#F0F2F8]">How do you want to participate?</h3>
              <p className="text-[13px] text-pulse-500 dark:text-[#8A96B0] mb-6">Your host sets the session posture before sensitive questions open.</p>
              <div className="space-y-2">
                {consentOptions.map(({ key, name, desc, tag }) => (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className={`w-full text-left p-4 rounded-xl grid gap-3.5 items-center border-2 transition-all ${
                      selected === key
                        ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/12'
                        : 'border-pulse-200 dark:border-[#1E2A45] hover:border-pulse-300'
                    }`}
                    style={{ gridTemplateColumns: '24px 1fr auto' }}
                  >
                    <div
                      className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        selected === key
                          ? 'border-teal-600 bg-teal-600'
                          : 'border-pulse-300'
                      }`}
                    >
                      {selected === key && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <div className="text-[14.5px] font-semibold text-pulse-900 dark:text-[#F0F2F8]">{name}</div>
                      <div className="text-[12.5px] text-pulse-500 dark:text-[#8A96B0] leading-snug mt-0.5">{desc}</div>
                    </div>
                    <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400" style={monoFont}>{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Guarantees */}
      <Reveal as="section" className="py-16 bg-pulse-50 dark:bg-[#0F1525]">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Guarantees</div>
          <h2 className="font-bold text-4xl tracking-tight mb-12 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Four things we do. Four things we don't.
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {doGuarantees.map(({ title, desc }) => (
              <div key={title} className="bg-white dark:bg-[#151C2E] rounded-2xl p-7" style={shadowCard}>
                <div className="w-24 h-24 rounded-xl bg-teal-50 dark:bg-teal-500/12 text-teal-700 dark:text-teal-400 flex items-center justify-center mb-4">
                  <Check size={22} />
                </div>
                <h3 className="font-semibold text-[16px] mb-2 text-pulse-900 dark:text-[#F0F2F8]">{title}</h3>
                <p className="text-[13.5px] leading-relaxed text-pulse-500 dark:text-[#8A96B0]">{desc}</p>
              </div>
            ))}
            {dontGuarantees.map(({ title, desc }) => (
              <div key={title} className="bg-white dark:bg-[#151C2E] rounded-2xl p-7" style={shadowCard}>
                <div
                  className="w-24 h-24 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
                >
                  <X size={22} />
                </div>
                <h3 className="font-semibold text-[16px] mb-2" style={{ color: '#DC2626' }}>{title}</h3>
                <p className="text-[13.5px] leading-relaxed text-pulse-500 dark:text-[#8A96B0]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Data lifecycle */}
      <Reveal as="section" className="py-16 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Data lifecycle</div>
          <h2 className="font-bold text-4xl tracking-tight mb-12 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Where your data lives, and for how long.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-pulse-200 dark:divide-[#1E2A45]">
            {[
              { t: 'During the session', title: 'In secure session storage', desc: 'Votes, tallies, and consent choices are isolated to your session. No sharing across sessions, no replication.' },
              { t: 'After close', title: 'In your workspace', desc: 'Session locks. Session data remains in the configured Cloudflare data stores for the retention window.' },
              { t: 'Retention end', title: 'Purged by scheduler', desc: 'Cron job on every DO sweeps expired sessions. Identity rows go first; aggregate tallies follow on your schedule.' },
            ].map(({ t, title, desc }) => (
              <div key={t} className="px-12 py-12 first:pl-0 last:pr-0 relative">
                <div className="text-[11px] font-bold uppercase tracking-widest text-teal-700 dark:text-teal-400 mb-2">{t}</div>
                <h3 className="font-semibold text-[17px] mb-2 text-pulse-900 dark:text-[#F0F2F8]">{title}</h3>
                <p className="text-sm text-pulse-500 dark:text-[#8A96B0] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Certifications */}
      <Reveal as="section" className="py-16 bg-pulse-50 dark:bg-[#0F1525]">
        <div className="max-w-6xl mx-auto px-8">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Certifications</div>
          <h2 className="font-bold text-4xl tracking-tight mb-3 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            The paperwork your procurement team needs.
          </h2>
          <p className="text-pulse-500 dark:text-[#8A96B0] mb-12">
            Qesto uses Cloudflare for compute/storage, Workers AI for inference, Stripe for payment processing, and
            Resend for transactional email. Formal compliance reports and residency guarantees are enterprise roadmap items.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {certs.map(({ name, label }) => (
              <div key={name} className="bg-white dark:bg-[#151C2E] rounded-xl p-5.5 text-center" style={shadowCard}>
                <div className="font-bold text-[18px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mb-1" style={displayFont}>
                  {name}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-pulse-500 dark:text-[#8A96B0]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* CTA band */}
      <Reveal className="py-16 px-8">
        <div className="max-w-6xl mx-auto bg-pulse-900 rounded-[2rem] text-white text-center py-16 px-12">
          <h2 className="font-bold text-4xl tracking-tight mb-3" style={displayFont}>
            Privacy your team and your participants can trust.
          </h2>
          <p className="text-slate-400 mb-12">
            See our privacy policy, request the compliance docs, or talk through how anonymity works in your context.
          </p>
          <Link to="/pricing" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
            Read the privacy policy
          </Link>
        </div>
      </Reveal>
    </MainLayout>
  )
}
