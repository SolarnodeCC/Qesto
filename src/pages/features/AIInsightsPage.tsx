import { Link } from 'react-router-dom'
import { Sparkles, Layers, FileText, Search, Cpu, Shield, Trash2, Check } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import PageSeo from '../../components/PageSeo'
import Reveal from '../../components/Reveal'

const btnPrimary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const btnSecondary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-pulse-900 dark:text-[var(--text-primary)] text-sm border border-pulse-300 dark:border-[var(--color-border-strong)] bg-white dark:bg-[var(--color-surface-elevated)] hover:border-pulse-500 dark:hover:border-[#3A4870] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const gradientAI = { background: 'linear-gradient(135deg, #8B5CF6 0%, #2DD4BF 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }

const clusters = [
  { title: 'Theme 01 · Hiring velocity', count: 58, quote: '"Every backfill takes six weeks longer than last year." · "Senior pipeline is dry." · "Recruiter handoffs fall through."' },
  { title: 'Theme 02 · Cross-team rituals', count: 34, quote: '"Nobody knows what design is shipping until it ships." · "Stand-up doesn\'t scale past 8." · "PM and eng are on different roadmaps."' },
  { title: 'Theme 03 · Tooling debt', count: 22, quote: '"Build takes 14 minutes." · "Three different logging stacks." · "Staging drift is a monthly fire."' },
]

const antiSlop = [
  { title: 'Minimum evidence threshold', desc: 'A theme needs 5+ linked responses to appear. Below that, it\'s an outlier — shown as a list, not a cluster.' },
  { title: 'No inferred sentiment', desc: 'We cluster by topic, not by mood. If a host wants a valence score, they add a scale question.' },
  { title: 'Quotes are never paraphrased', desc: 'Exemplar lines in a cluster are verbatim. Edits by the host are visible in the audit log.' },
  { title: 'Refusal is a feature', desc: 'Asked to "summarize tone," the model returns "no tone model deployed." Better than pretending.' },
]

export default function AIInsightsPage() {
  return (
    <MainLayout>
      <PageSeo
        title="AI Insights for Live Sessions — Qesto"
        description="See what your audience is thinking. Get themes from open responses in seconds, each backed by real answers from your room."
        canonicalPath="/features/ai-insights"
        ogImage="/images/solutions/photo-1521737604893-d14cc237f11d.avif"
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-white dark:bg-[var(--color-bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <div
                className="text-xs font-bold tracking-widest uppercase text-violet-700 dark:text-violet-400 mb-3 inline-flex items-center gap-1.5"
              >
                <Sparkles size={12} />
                AI Insights
              </div>
              <h1 className="font-bold text-5xl tracking-tight mb-5 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
                See what your audience is{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={gradientAI}
                >
                  thinking, in real time.
                </span>
              </h1>
              <p className="text-lg text-pulse-500 dark:text-[var(--text-muted)] leading-relaxed mb-8">
                Ask an open question. Get themes in seconds — each one backed by real responses from your room.
                Understand what people actually think without reading every answer, so you can adapt while the
                moment still matters.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
                  See a sample recap
                </Link>
                <Link to="/features/privacy" className={btnSecondary + ' text-base px-7 py-3.5 dark:bg-[var(--color-surface-elevated)] dark:border-[var(--color-border-strong)] dark:text-[var(--text-primary)]'}>
                  How we handle AI data
                </Link>
              </div>
            </div>

            {/* AI shot card */}
            <div className="bg-white dark:bg-[var(--color-surface)] rounded-[20px] p-7" style={shadowElevated}>
              <div className="flex justify-between items-center mb-4">
                <div
                  className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/12 px-2.5 py-1 rounded"
                >
                  <Sparkles size={12} />
                  AI-generated
                </div>
                <span className="text-[12px] text-pulse-500 dark:text-[var(--text-muted)]" style={monoFont}>Generated in 11.4s · 142 responses</span>
              </div>
              <h3 className="font-bold text-[20px] tracking-tight mb-4 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
                What's blocking your team this quarter?
              </h3>
              <div className="space-y-2.5">
                {clusters.map(({ title, count, quote }) => (
                  <div
                    key={title}
                    className="pl-4 py-3.5 pr-4 rounded-r-lg"
                    style={{ borderLeft: '3px solid #7C3AED', background: '#F5F3FF' }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <strong className="text-[14.5px] font-semibold text-pulse-900 dark:text-[var(--text-primary)]">{title}</strong>
                      <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-400" style={monoFont}>
                        {count} evidence
                      </span>
                    </div>
                    <p className="text-[13px] text-pulse-500 dark:text-[var(--text-muted)] leading-snug italic">{quote}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three jobs */}
      <Reveal as="section" className="py-16 bg-pulse-50 dark:bg-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-bold text-4xl tracking-tight mb-3 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
            Three things it does for you. Three it won't do.
          </h2>
          <p className="text-pulse-500 dark:text-[var(--text-muted)] mb-8 text-lg">
            The AI helps you read the room faster — it doesn't interpret the room for you. You stay in control.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: <Layers size={22} />,
                title: 'Cluster open responses',
                desc: 'Groups free-text answers into themes with counts and exemplar quotes. Stemming + sentence embeddings, clustered with density threshold.',
                code: ['// 142 responses', '→ 3 clusters, 12 outliers', '→ 11.4s'],
              },
              {
                icon: <FileText size={22} />,
                title: 'Draft the recap',
                desc: 'Produces theme suggestions and a first-pass synthesis from session responses. Hosts review the output before using it outside the room.',
                code: ['// theme draft', '→ 8 summaries', '→ host reviewed'],
              },
              {
                icon: <Search size={22} />,
                title: 'Surface the missed cluster',
                desc: "Highlights a theme the host didn't ask about. Shown as a soft suggestion on the host console — never to participants.",
                code: ['// missed', '→ "compensation fairness" (14 ev)', '→ host-only'],
              },
            ].map(({ icon, title, desc, code }) => (
              <div key={title} className="bg-white dark:bg-[var(--color-surface)] rounded-xl p-7" style={shadowCard}>
                <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/12 text-violet-700 dark:text-violet-400 flex items-center justify-center mb-4">
                  {icon}
                </div>
                <h3 className="font-semibold text-[18px] mb-2 text-pulse-900 dark:text-[var(--text-primary)]">{title}</h3>
                <p className="text-sm leading-relaxed text-pulse-500 dark:text-[var(--text-muted)] mb-3">{desc}</p>
                <div className="bg-pulse-50 dark:bg-[var(--color-border)] rounded-lg p-3 text-[11.5px] text-pulse-900 dark:text-[var(--text-primary)] leading-relaxed" style={monoFont}>
                  {code.map((line, i) => (
                    <div key={i}>
                      {line.startsWith('//') ? (
                        <span className="text-violet-700 dark:text-violet-400">{line}</span>
                      ) : (
                        line
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Disclosure */}
      <Reveal as="section" className="py-16 bg-white dark:bg-[var(--color-bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-violet-50 dark:bg-violet-500/12 rounded-[20px] p-10 grid gap-5" style={{ gridTemplateColumns: '48px 1fr' }}>
            <div className="w-12 h-12 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="font-bold text-[26px] tracking-tight mb-2.5 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
                The AI disclosure rules we actually follow.
              </h2>
              <p className="text-[15.5px] leading-relaxed text-pulse-800 dark:text-[var(--text-secondary)] mb-3.5">
                Anything produced by a model carries the AI badge in Qesto product surfaces. Hosts review AI output
                before using it outside the room, and participant-facing live views stay focused on aggregate tallies.
              </p>
              <ul className="space-y-2 text-sm text-pulse-600 dark:text-[var(--text-secondary)] list-disc pl-5">
                <li>AI-generated content is always labeled with the sparkles glyph and violet accent.</li>
                <li>Theme clusters are generated from real session responses and should be reviewed by the host.</li>
                <li>Detailed edit history and PDF recap provenance are roadmap items.</li>
                <li>Participants never see AI output during a live session — only aggregate tallies.</li>
                <li>We don't generate quotes. Every quoted line in a recap is a real participant response.</li>
              </ul>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Anti-slop */}
      <Reveal as="section" className="py-16 bg-white dark:bg-[var(--color-bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-pulse-900 text-white rounded-3xl p-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-bold text-[32px] tracking-tight mb-4" style={displayFont}>
                No slop. No hallucinations. No "helpful" metaphors.
              </h2>
              <p className="text-[16px] leading-relaxed text-slate-300 mb-3">
                Qesto's AI prompts are tuned to refuse to invent. If it can't anchor a claim to five or more
                responses, it says so. If the cluster is too small, it stays in the outlier bucket.
              </p>
              <p className="text-[16px] leading-relaxed text-slate-300">
                We'd rather ship a short recap than a confident one.
              </p>
            </div>
            <div className="space-y-3.5">
              {antiSlop.map(({ title, desc }) => (
                <div key={title} className="flex items-start gap-3.5 p-4 rounded-xl bg-white/[0.04]">
                  <Check size={20} className="text-teal-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white font-semibold text-sm block mb-1">{title}</strong>
                    <span className="text-slate-400 text-[13.5px] leading-relaxed">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* Privacy */}
      <Reveal as="section" className="py-16 bg-pulse-50 dark:bg-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Your responses stay private</div>
          <h2 className="font-bold text-4xl tracking-tight mb-8 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
            What your room shares, stays in your room.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: <Cpu size={22} />,
                title: 'Analysis happens inside your session',
                desc: 'Themes are generated in real time without sending responses to any external service. What people share stays where it belongs.',
              },
              {
                icon: <Shield size={22} />,
                title: 'No third-party AI services',
                desc: 'Your responses are never sent to outside providers. The analysis runs privately, so your room can share honestly.',
              },
              {
                icon: <Trash2 size={22} />,
                title: 'Removed when you remove',
                desc: 'All analysis data lives with the session. When you remove a session, everything that was generated goes with it.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="bg-white dark:bg-[var(--color-surface)] rounded-xl p-7" style={shadowCard}>
                <div className="w-12 h-12 rounded-xl bg-violet-50 dark:bg-violet-500/12 text-violet-700 dark:text-violet-400 flex items-center justify-center mb-4">
                  {icon}
                </div>
                <h3 className="font-semibold text-[18px] mb-2 text-pulse-900 dark:text-[var(--text-primary)]">{title}</h3>
                <p className="text-sm leading-relaxed text-pulse-500 dark:text-[var(--text-muted)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* CTA band */}
      <Reveal className="py-10 px-6">
        <div className="max-w-6xl mx-auto bg-pulse-900 rounded-[2rem] text-white text-center py-16 px-8">
          <h2 className="font-bold text-4xl tracking-tight mb-3" style={displayFont}>
            Evidence you can edit. AI you can trust.
          </h2>
          <p className="text-slate-400 mb-8">
            Try AI-assisted themes on your next eligible session.
          </p>
          <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
            Generate a recap
          </Link>
        </div>
      </Reveal>
    </MainLayout>
  )
}
