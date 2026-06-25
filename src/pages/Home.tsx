import { Link } from 'react-router-dom'
import { Sparkles, BarChart3, Lock, Cloud, Users, QrCode, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useT } from '../i18n'
import MainLayout from '../layouts/MainLayout'
import AIBadge from '../components/AIBadge'
import PageSeo from '../components/PageSeo'
import Reveal from '../components/Reveal'
import HomePollDemo from '../components/HomePollDemo'
import HeroPollPreview from '../components/HeroPollPreview'

const FEATURE_STRIP = [
  { icon: Sparkles, label: 'Question ideas ready in under 90 seconds' },
  { icon: BarChart3, label: 'Live results every participant can see' },
  { icon: Lock, label: 'Anonymous, cohort, or identified — your choice' },
  { icon: Cloud, label: 'Responses stay private, always' },
] as const

interface FeatureCard {
  icon: typeof BarChart3
  title: string
  desc: string
  ai?: boolean
}

const FEATURE_CARDS: FeatureCard[] = [
  {
    icon: BarChart3,
    title: 'Live polling & ranking',
    desc: 'Multi-choice, ranked Q&A, wordclouds, and 1–10 scales. Results refresh in <200ms on the edge.',
  },
  {
    icon: CheckCircle2,
    title: 'Consent rounds',
    desc: 'A single-tap consent vote before any recap is generated — and a signed log for compliance review.',
  },
  {
    icon: Sparkles,
    title: 'Same-day recap',
    desc: 'AI-assisted theme drafts help you turn real responses into a reviewed same-day recap.',
    ai: true,
  },
  {
    icon: Users,
    title: 'Anonymity modes',
    desc: 'Full, cohort (roles only), or identified. Choose per session — participants see the mode on the entry screen.',
  },
  {
    icon: QrCode,
    title: 'Enter in one tap',
    desc: 'Short entry codes, QR, or magic link. Works on any device — no app, no account required to participate.',
  },
  {
    icon: Lock,
    title: 'Private by design',
    desc: 'Responses never leave your session. No third-party AI, no data sold, no training on anything your room shared.',
  },
]

export default function Home() {
  const auth = useAuth()
  const t = useT('home')

  const navSlot = (
    <>
      {auth.status === 'authenticated' ? (
        <button
          type="button"
          onClick={() => void auth.logout()}
          className="text-sm text-teal-700 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
        >
          Sign out
        </button>
      ) : auth.status === 'anonymous' ? (
        <Link
          to="/login"
          className="text-sm font-medium text-teal-700 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
        >
          Sign in
        </Link>
      ) : null}
    </>
  )

  return (
    <MainLayout navSlot={navSlot}>
      <PageSeo
        title="Qesto — Real-time Feedback & AI Insights for Teams"
        description="Live polling, anonymous feedback, and AI-powered insights for workshops, training, and meetings. No account required to participate."
        canonicalPath="/"
      />
      <div className="animate-page-enter">

        {/* ── Hero ─────────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-hidden py-24 px-6 before:absolute before:left-1/2 before:-top-[120px] before:-translate-x-1/2 before:w-[1200px] before:h-[600px] before:bg-[radial-gradient(circle,rgba(20,184,166,0.08)_0%,transparent_60%)] before:pointer-events-none"
        >
          <div className="max-w-[1120px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── Hero copy ─────────────────────────────────────────────── */}
            <div>

            {/* AI pill */}
            <div className="flex items-center gap-2 mb-6">
              <AIBadge variant="assisted" label="AI-assisted" />
              <span className="text-sm text-pulse-500 dark:text-[#8A96B0]">{t('heroTagline')}</span>
            </div>

            {/* H1 */}
            <h1
              id="hero-heading"
              tabIndex={-1}
              className="font-[family-name:var(--font-display)] font-bold text-5xl md:text-[60px] leading-[1.05] tracking-[-0.02em] [text-wrap:balance] text-pulse-900 dark:text-[#F0F2F8] mb-5 max-w-[920px] focus:outline-none"
            >
              Feel the pulse of the room,{' '}
              <span className="bg-[linear-gradient(to_bottom_right,#14b8a6,#8b5cf6)] bg-clip-text text-transparent">
                amplified by AI.
              </span>
            </h1>

            {/* Supporting line — evidence register, subordinate to the H1 */}
            <p className="text-lg leading-[1.5] text-pulse-600 dark:text-[#A8B3CC] max-w-[680px] mb-5">
              …and the evidence to back it up — decisions you can defend long after the meeting ends.
            </p>

            {/* Sub-headline */}
            <p className="text-xl leading-[1.55] text-pulse-600 dark:text-[#A8B3CC] max-w-[680px] mb-8">
              Make it easy for everyone to take part, share what they think, and stay with you
              start to finish. For teachers, trainers, facilitators, and team leaders.
            </p>
            <p className="text-base leading-[1.6] text-pulse-600 dark:text-[#A8B3CC] max-w-[760px] mb-8">
              Qesto helps teams and facilitators run live polls, rankings, and consent rounds during
              workshops, classrooms, and meetings. We use sign-in only to manage your account,
              sessions, and workspace access.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 mb-12">
              {auth.status === 'authenticated' ? (
                <>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-2 rounded-md bg-[linear-gradient(to_bottom_right,#14b8a6,#8b5cf6)] text-white px-7 py-3.5 text-[17px] font-semibold shadow-card hover:shadow-teal hover:scale-[1.02] transition-all duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  >
                    Go to dashboard
                  </Link>
                  <Link
                    to="/templates"
                    className="inline-flex items-center rounded-md bg-white dark:bg-[#1C2540] border border-pulse-200 dark:border-[#2A3858] text-pulse-900 dark:text-[#F0F2F8] px-7 py-3.5 text-[17px] font-semibold hover:border-pulse-300 transition-all duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  >
                    Browse templates
                  </Link>
                </>
              ) : auth.status === 'loading' ? (
                <span className="text-sm text-pulse-500">{t('loading')}</span>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-md bg-[linear-gradient(to_bottom_right,#14b8a6,#8b5cf6)] text-white px-7 py-3.5 text-[17px] font-semibold shadow-card hover:shadow-teal hover:scale-[1.02] transition-all duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  >
                    Launch your next session
                  </Link>
                  <Link
                    to="/templates"
                    className="inline-flex items-center rounded-md bg-white dark:bg-[#1C2540] border border-pulse-200 dark:border-[#2A3858] text-pulse-900 dark:text-[#F0F2F8] px-7 py-3.5 text-[17px] font-semibold hover:border-pulse-300 transition-all duration-[120ms] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  >
                    Browse templates
                  </Link>
                </>
              )}
              <span className="text-[13px] text-pulse-500 ml-2">No card required · 2-minute setup · No account required to participate</span>
            </div>
            <div className="mb-12 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <Link
                to="/privacy"
                className="font-medium text-teal-700 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-pulse-600 dark:text-[#A8B3CC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
              >
                Terms of Service
              </Link>
            </div>

            {/* Feature strip */}
            <div
              className="flex flex-wrap gap-7 pt-5 border-t border-pulse-200 dark:border-[#1E2A45]"
              aria-label="Key features"
            >
              {FEATURE_STRIP.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 text-sm text-pulse-600 dark:text-[#A8B3CC]">
                  <Icon aria-hidden="true" size={16} className="text-teal-700 dark:text-teal-400 flex-shrink-0" />
                  {label}
                </div>
              ))}
            </div>
            </div>

            {/* ── Live product preview ──────────────────────────────────── */}
            <div className="lg:justify-self-end w-full">
              <HeroPollPreview />
            </div>
          </div>
        </section>

        {/* ── Live results preview ──────────────────────────────────────────────── */}
        <Reveal as="section" aria-label="Live results preview" className="px-6 pb-12">
          <div className="max-w-[1120px] mx-auto flex flex-col items-center md:items-start">
            <HomePollDemo />
          </div>
        </Reveal>

        {/* ── Feature cards ─────────────────────────────────────────────────────── */}
        <Reveal
          as="section"
          aria-labelledby="features-heading"
          className="bg-pulse-50 dark:bg-[#0F1525] py-24 px-6"
          id="features"
        >
          <div className="max-w-[1120px] mx-auto">

            {/* Eyebrow */}
            <p className="text-[13px] font-semibold tracking-[0.08em] uppercase text-teal-700 dark:text-teal-400 mb-3">
              Facilitator-first
            </p>

            <h2
              id="features-heading"
              className="font-[family-name:var(--font-display)] font-bold text-[48px] leading-[1.1] tracking-[-0.02em] [text-wrap:balance] text-pulse-900 dark:text-[#F0F2F8] mb-4 max-w-[680px]"
            >
              Everything you need to run the room — and prove what it decided.
            </h2>

            <p className="text-lg text-pulse-600 dark:text-[#A8B3CC] max-w-[620px] mb-12">
              Ask a question. See what your room is thinking. Give people a safe way to contribute
              honestly — and leave with a clear record of what was said.
            </p>

            {/* 3-col grid */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" role="list">
              {FEATURE_CARDS.map((card, i) => {
                const Icon = card.icon
                return (
                  <li
                    key={card.title}
                    className="animate-list-item bg-white dark:bg-[#151C2E] rounded-lg shadow-card hover:shadow-elevated transition-shadow duration-[120ms] p-7 flex flex-col gap-3"
                    style={{ '--stagger-index': i } as React.CSSProperties}
                  >
                    {/* Icon container */}
                    <div
                      className={`rounded-xl w-11 h-11 flex items-center justify-center flex-shrink-0 ${
                        card.ai
                          ? 'bg-violet-50 dark:bg-violet-500/12 text-violet-700 dark:text-violet-400'
                          : 'bg-teal-50 dark:bg-teal-500/12 text-teal-700 dark:text-teal-400'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon size={20} />
                    </div>

                    <h3 className="text-[20px] font-semibold text-pulse-900 dark:text-[#F0F2F8] leading-snug">
                      {card.title}
                    </h3>
                    <p className="text-[15px] text-pulse-600 dark:text-[#A8B3CC] leading-[1.55]">{card.desc}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        </Reveal>

      </div>
    </MainLayout>
  )
}
