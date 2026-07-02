import { Link } from 'react-router-dom'
import { QrCode, Monitor, Sparkles } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import PageSeo from '../../components/PageSeo'

const btnPrimary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const btnSecondary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-pulse-900 dark:text-[var(--text-primary)] text-sm border border-pulse-300 dark:border-[var(--color-border-strong)] bg-white dark:bg-[var(--color-surface-elevated)] hover:border-pulse-500 dark:hover:border-[#3A4870] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }

const timeline = [
  { time: '08:55', msg: <>Doors open. <span className="text-pulse-500">Join code on the lobby screens; 212 devices connected before the intro track ends.</span></>, tag: 'Pre-event', live: false },
  { time: '09:05', msg: <>Consent round. <span className="text-pulse-500">Every attendee picks visibility for the day. 94% opt in to anonymous, 22% to identified for panel questions.</span></>, tag: 'Consent', live: false },
  { time: '09:10', msg: <>"What are you here to solve?" — <span className="text-pulse-500">284 responses, AI clusters into 3 themes in 12 seconds, projected behind the speaker.</span></>, tag: 'Live', live: true },
  { time: '10:20', msg: <>Panel queue. <span className="text-pulse-500">Upvoted questions surface on the moderator's console. Top 5 read aloud in order, identified voters optional.</span></>, tag: 'Live', live: true },
  { time: '11:00', msg: <>Workshops. <span className="text-pulse-500">Ten rooms, ten Qestos. Each facilitator runs the same template; host console aggregates at 12:30.</span></>, tag: 'Breakout', live: false },
  { time: '14:45', msg: <>"What's the one thing you'll change on Monday?" — <span className="text-pulse-500">word cloud on stage, exported responses ready for the follow-up.</span></>, tag: 'Live', live: true },
  { time: '15:30', msg: <>Recap source ready. <span className="text-pulse-500">CSV tallies and reviewed theme notes give organizers material for the follow-up while the event is still fresh.</span></>, tag: 'Recap', live: false },
]

export default function EventsPage() {
  return (
    <MainLayout>
      <PageSeo
        title="Qesto for Events — The room answers back"
        description="Turn any keynote, panel, or breakout into a two-way conversation. Live tallies, AI insights, and a recap before the applause lands."
        canonicalPath="/events"
        ogImage="/images/solutions/photo-1572021335469-31706a17aaef.avif"
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-white dark:bg-[var(--color-bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Qesto for Events</div>
              <h1 className="font-bold text-5xl tracking-tight mb-5 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
                The room{' '}
                <span className="bg-gradient-to-br from-teal-400 to-violet-500 bg-clip-text text-transparent">
                  answers back.
                </span>
              </h1>
              <p className="text-lg text-pulse-500 dark:text-[var(--text-muted)] leading-relaxed mb-8">
                Turn any keynote, panel, or breakout into a two-way conversation. Live tallies project on the main
                screen, AI surfaces the question a facilitator missed, and the speaker walks offstage with a recap
                before the applause lands.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
                  Run your next event
                </Link>
                <Link to="/features/live-polling" className={btnSecondary + ' text-base px-7 py-3.5 dark:bg-[var(--color-surface-elevated)] dark:border-[var(--color-border-strong)] dark:text-[var(--text-primary)]'}>
                  See Present mode
                </Link>
              </div>
            </div>

            {/* Stage mockup */}
            <div
              className="relative rounded-3xl p-7 text-white grid overflow-hidden"
              style={{ background: 'var(--color-bg-subtle)', aspectRatio: '16/10', gridTemplateRows: 'auto 1fr auto', gap: 16, ...shadowElevated }}
            >
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 70% 20%, rgba(20,184,166,0.2), transparent 60%)' }}
              />
              <div className="relative flex justify-between items-center text-[11px] tracking-widest uppercase text-white/60">
                <span>qesto · room QSTO-7K2</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]" />
                  Live · 284 votes
                </span>
              </div>
              <div className="relative font-bold text-3xl leading-tight tracking-tight" style={displayFont}>
                Which of these is blocking your team the most this quarter?
              </div>
              <div className="relative grid gap-2.5">
                {[
                  { lbl: 'Hiring velocity', pct: 78, n: 142 },
                  { lbl: 'Cross-team rituals', pct: 52, n: 94 },
                  { lbl: 'Tooling debt', pct: 28, n: 48 },
                ].map(({ lbl, pct, n }) => (
                  <div key={lbl} className="flex items-center gap-3 text-sm">
                    <span className="w-36 text-white/80 font-medium">{lbl}</span>
                    <div className="flex-1 h-3.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, ...gradientBrand }} />
                    </div>
                    <span className="w-8 text-right text-white/80" style={monoFont}>{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Formats */}
      <section className="py-16 bg-pulse-50 dark:bg-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Formats</div>
          <h2 className="font-bold text-4xl tracking-tight mb-3 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
            One stage. Three sessions. Same host console.
          </h2>
          <p className="text-pulse-500 dark:text-[var(--text-muted)] mb-8 text-lg">
            Qesto adapts to the room. Projected tallies for 500. Breakout wizards for 20. Same session ID threads
            the whole day.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-2xl p-8 min-h-[240px] flex flex-col justify-between relative overflow-hidden bg-pulse-900 text-white">
              <div className="text-[48px] font-bold leading-none opacity-20" style={displayFont}>01</div>
              <div>
                <h3 className="text-[22px] font-semibold mb-2.5">Keynote</h3>
                <p className="text-sm leading-relaxed opacity-85">
                  Project live tallies behind the speaker. 1-tap join. AI clusters open responses into 3 themes the
                  speaker can address before Q&amp;A.
                </p>
              </div>
            </div>
            <div
              className="rounded-2xl p-8 min-h-[240px] flex flex-col justify-between relative overflow-hidden text-pulse-900"
              style={{ background: 'linear-gradient(135deg, #F0FDFA 0%, #F5F3FF 100%)' }}
            >
              <div className="text-[48px] font-bold leading-none opacity-20" style={displayFont}>02</div>
              <div>
                <h3 className="text-[22px] font-semibold mb-2.5">Panel</h3>
                <p className="text-sm leading-relaxed opacity-85">
                  Audience submits questions with upvotes. Moderator sees the ranked queue. Identified mode on if the
                  panelists want to reply by name.
                </p>
              </div>
            </div>
            <div className="rounded-2xl p-8 min-h-[240px] flex flex-col justify-between relative overflow-hidden text-pulse-900 dark:text-[var(--text-primary)] bg-teal-50 dark:bg-teal-500/12">
              <div className="text-[48px] font-bold leading-none opacity-20" style={displayFont}>03</div>
              <div>
                <h3 className="text-[22px] font-semibold mb-2.5">Workshop</h3>
                <p className="text-sm leading-relaxed opacity-85">
                  Break 80 people into 10 rooms. Each room runs its own consent round. Host console aggregates themes
                  without exposing raw rows.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 bg-white dark:bg-[var(--color-bg-subtle)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">A day in the room</div>
          <h2 className="font-bold text-4xl tracking-tight mb-3 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
            From curtain-up to recap, one session ID.
          </h2>
          <p className="text-pulse-500 dark:text-[var(--text-muted)] mb-8 text-lg">
            Here's how a 300-person half-day runs on Qesto. Every step is logged, every tally is exportable.
          </p>
          <div className="rounded-2xl overflow-hidden border border-pulse-200 dark:border-[var(--color-border)] divide-y divide-pulse-200 dark:divide-[var(--color-border)]">
            {timeline.map(({ time, msg, tag, live }) => (
              <div
                key={time}
                className="bg-white dark:bg-[var(--color-surface)] px-6 py-4.5 grid items-center gap-5"
                style={{ gridTemplateColumns: '80px 1fr auto' }}
              >
                <span className="text-teal-700 dark:text-teal-400 font-semibold text-[13px]" style={monoFont}>{time}</span>
                <span className="text-[15px] text-pulse-900 dark:text-[var(--text-primary)]">{msg}</span>
                <span
                  className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded ${
                    live ? 'bg-teal-50 dark:bg-teal-500/12 text-teal-700 dark:text-teal-400' : 'bg-pulse-100 dark:bg-[var(--color-border)] text-pulse-500 dark:text-[var(--text-muted)]'
                  }`}
                >
                  {tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why switch */}
      <section className="py-16 bg-pulse-50 dark:bg-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Why event producers switch</div>
          <h2 className="font-bold text-4xl tracking-tight mb-8 text-pulse-900 dark:text-[var(--text-primary)]" style={displayFont}>
            Because nobody installs a second app at your event.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: <QrCode size={22} />,
                title: 'Join code on the screen',
                desc: 'Short 6-character code, QR, or NFC. Works on the sketchiest conference wifi — edge server, no round-trip.',
                ai: false,
              },
              {
                icon: <Monitor size={22} />,
                title: 'Present mode runs on anything',
                desc: 'Project from a laptop, iPad, or the AV booth. Tallies stay readable at the back row because we designed for 1920×1080 first.',
                ai: false,
              },
              {
                icon: <Sparkles size={22} />,
                title: 'The question the host missed',
                desc: "AI surfaces the cluster nobody asked about. Helpful for moderators running to time; invisible if you don't want it.",
                ai: true,
              },
            ].map(({ icon, title, desc, ai }) => (
              <div key={title} className="bg-white dark:bg-[var(--color-surface)] rounded-2xl p-7" style={shadowCard}>
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                    ai ? 'bg-violet-50 dark:bg-violet-500/12 text-violet-700 dark:text-violet-400' : 'bg-teal-50 dark:bg-teal-500/12 text-teal-700 dark:text-teal-400'
                  }`}
                >
                  {icon}
                </div>
                <h3 className="font-semibold text-[18px] mb-2 text-pulse-900 dark:text-[var(--text-primary)]">{title}</h3>
                <p className="text-sm leading-relaxed text-pulse-500 dark:text-[var(--text-muted)]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <div className="py-10 px-6">
        <div className="max-w-6xl mx-auto bg-pulse-900 rounded-[2rem] text-white text-center py-16 px-8">
          <h2 className="font-bold text-4xl tracking-tight mb-3" style={displayFont}>
            Your next keynote should hear back.
          </h2>
          <p className="text-slate-400 mb-8">
            Spin up a room in 90 seconds. Free for audiences under 100; pay per-session above.
          </p>
          <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
            Launch Present mode
          </Link>
        </div>
      </div>
    </MainLayout>
  )
}
