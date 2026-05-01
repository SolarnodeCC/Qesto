import { Link } from 'react-router-dom'
import { List, CheckSquare, BarChart3, MessageSquare, ThumbsUp, Move, Cloud, Gauge, Play, EyeOff, Shuffle, Users, Timer, Download } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import PageSeo from '../../components/PageSeo'

const btnPrimary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const btnSecondary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-pulse-900 text-sm border border-pulse-300 bg-white hover:border-pulse-500 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }

const questionTypes = [
  { icon: <List size={22} />, title: 'Multiple choice', desc: 'Single-select with live bar tally. Shuffle options to defeat position bias. 2–12 options.', tag: 'type: mc' },
  { icon: <CheckSquare size={22} />, title: 'Multi-select', desc: '"Pick up to N." Live stacked bars with exact counts. Great for prioritization.', tag: 'type: multi' },
  { icon: <BarChart3 size={22} />, title: 'Likert / scale', desc: '1–5 or 1–7 with custom endpoint labels. Mean and distribution shown together, never alone.', tag: 'type: scale' },
  { icon: <MessageSquare size={22} />, title: 'Open text', desc: 'Free response clustered by AI in 8–15 seconds. Raw rows never shown — themes with counts and representative quotes.', tag: 'type: open' },
  { icon: <ThumbsUp size={22} />, title: 'Upvote queue', desc: 'Audience submits questions; others upvote. Moderator console shows a ranked queue. Perfect for Q&A.', tag: 'type: queue' },
  { icon: <Move size={22} />, title: 'Ranking', desc: 'Drag-order items. Tally shows Borda count and positional heatmap.', tag: 'type: rank' },
  { icon: <Cloud size={22} />, title: 'Word cloud', desc: '1–3 word responses rendered as a live cloud. Frequency-scaled, stemming on by default.', tag: 'type: cloud' },
  { icon: <Gauge size={22} />, title: 'Slider', desc: 'Continuous 0–100 input. Tally shows median, IQR, and distribution — never just the mean.', tag: 'type: slider' },
]

const latencyRows = [
  { hop: 'Hop 01', title: 'Client → edge POP.', desc: 'TLS to the nearest Cloudflare edge. Participant never talks to an origin.', lat: '~22ms', sub: 'p50 wire' },
  { hop: 'Hop 02', title: 'Edge → Durable Object.', desc: 'Session state lives in a single DO, pinned to the colo closest to first-mover.', lat: '~8ms', sub: 'intra-colo' },
  { hop: 'Hop 03', title: 'DO → WebSocket fan-out.', desc: 'Tally update broadcast to every connected participant over persistent WS.', lat: '~12ms', sub: 'fanout' },
  { hop: 'Hop 04', title: 'Render.', desc: 'Bar moves on the projected screen. Same pipe, no client poll.', lat: '~16ms', sub: 'paint' },
  { hop: 'Total', title: 'Tap to bar movement.', desc: 'End-to-end, measured across 10k sessions in production.', lat: '< 80ms', sub: 'p50 end-to-end', highlight: true },
]

const hostControls = [
  { icon: <Play size={22} />, title: 'Launch, pause, reopen', desc: 'Every question is a state machine. Host controls all transitions; participants never see a broken flow.' },
  { icon: <EyeOff size={22} />, title: 'Hide tally live', desc: "Toggle visibility mid-vote. Useful when you want the room to commit before seeing others' answers." },
  { icon: <Shuffle size={22} />, title: 'Option shuffle', desc: 'Randomize order per participant. Defeats position bias without randomizing on the projected screen.' },
  { icon: <Users size={22} />, title: 'Minimum tally gate', desc: 'Results stay hidden until N voters are in. Default 5, configurable. Prevents single-voter exposure.' },
  { icon: <Timer size={22} />, title: 'Soft timer', desc: 'Optional countdown visible to participants. Expires to close, not to lock — stragglers finish on next question.' },
  { icon: <Download size={22} />, title: 'One-click export', desc: 'CSV, JSON, or signed PDF with every tally and consent log. Integrates with Workday, HRIS, Notion, Slack.' },
]

export default function LivePollingPage() {
  return (
    <MainLayout>
      <PageSeo
        title="Live Polling for Meetings, Training & Events — Qesto"
        description="Ask a question and see what your room is thinking in real time. Live polling for teachers, trainers, facilitators, and team leaders."
        canonicalPath="/features/live-polling"
        ogImage="/images/solutions/photo-1572021335469-31706a17aaef.avif"
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Live Polling</div>
              <h1 className="font-bold text-5xl tracking-tight mb-5 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
                Ask a question.{' '}
                <span className="bg-gradient-to-br from-teal-400 to-violet-500 bg-clip-text text-transparent">
                  Hear from everyone.
                </span>
              </h1>
              <p className="text-lg text-pulse-500 dark:text-[#6B7A99] leading-relaxed mb-8">
                Responses show up in real time as people answer. Everyone in the room can see what the group
                thinks — while the moment still matters. No app to install, no waiting for results.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
                  Start a session
                </Link>
                <Link to="/features/ai-insights" className={btnSecondary + ' text-base px-7 py-3.5 dark:bg-[#1C2540] dark:border-[#2A3858] dark:text-[#F0F2F8]'}>
                  See AI Insights
                </Link>
              </div>
            </div>

            {/* Poll preview */}
            <div className="bg-white dark:bg-[#151C2E] rounded-[20px] p-7" style={shadowElevated}>
              <div className="flex justify-between mb-3.5 text-[11px] font-bold uppercase tracking-widest text-pulse-500 dark:text-[#6B7A99]">
                <span>Question 03 of 07</span>
                <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
                  <span className="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_6px_#14B8A6]" />
                  Live · 142 voters
                </span>
              </div>
              <h3 className="font-bold text-[22px] tracking-tight mb-4 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
                Which of these should we ship first?
              </h3>
              {[
                { lbl: 'Better onboarding', pct: 68, n: 96 },
                { lbl: 'Mobile parity', pct: 42, n: 60 },
                { lbl: 'Integrations', pct: 31, n: 44 },
                { lbl: 'Perf work', pct: 18, n: 26 },
              ].map(({ lbl, pct, n }) => (
                <div key={lbl} className="flex items-center gap-2.5 mb-2 text-sm">
                  <span className="w-32 font-medium text-pulse-700 dark:text-[#A8B3CC]">{lbl}</span>
                  <div className="flex-1 h-2.5 bg-pulse-100 dark:bg-[#1E2A45] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, ...gradientBrand }} />
                  </div>
                  <span className="w-7 text-right text-pulse-500" style={{ fontVariantNumeric: 'tabular-nums', ...monoFont }}>
                    {n}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Question types */}
      <section className="py-16 bg-pulse-50 dark:bg-[#0F1525]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Question types</div>
          <h2 className="font-bold text-4xl tracking-tight mb-3 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Eight primitives. Every session you'll ever need.
          </h2>
          <p className="text-pulse-500 dark:text-[#6B7A99] mb-8 text-lg">
            Not a kitchen sink. These are the shapes a facilitator actually reaches for, sharpened.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questionTypes.map(({ icon, title, desc, tag }) => (
              <div
                key={title}
                className="bg-white dark:bg-[#151C2E] rounded-xl p-5.5 grid gap-4 items-start"
                style={{ boxShadow: 'var(--shadow-card)', gridTemplateColumns: '48px 1fr' }}
              >
                <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-500/12 text-teal-700 dark:text-teal-400 flex items-center justify-center flex-shrink-0">
                  {icon}
                </div>
                <div>
                  <h3 className="font-semibold text-[16px] mb-1.5 text-pulse-900 dark:text-[#F0F2F8]">{title}</h3>
                  <p className="text-[13.5px] text-pulse-500 dark:text-[#6B7A99] leading-relaxed mb-1.5">{desc}</p>
                  <span className="text-[11px] text-pulse-400 dark:text-[#6B7A99]" style={monoFont}>{tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latency ladder */}
      <section className="py-16 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Latency</div>
          <h2 className="font-bold text-4xl tracking-tight mb-3 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Because a tally that lags is a tally people don't trust.
          </h2>
          <p className="text-pulse-500 dark:text-[#6B7A99] mb-8 text-lg">
            The bar moves when people tap. Results don't make the room wait — so you can keep the conversation
            going without breaking the flow.
          </p>
          <div className="rounded-2xl overflow-hidden border border-pulse-200 dark:border-[#1E2A45] divide-y divide-pulse-200 dark:divide-[#1E2A45]">
            {latencyRows.map(({ hop, title, desc, lat, sub, highlight }) => (
              <div
                key={hop}
                className="bg-white dark:bg-[#151C2E] px-6 py-4.5 grid items-center gap-6 text-sm"
                style={{ gridTemplateColumns: '140px 1fr 120px' }}
              >
                <span className="text-teal-700 dark:text-teal-400 font-semibold text-[12px]" style={monoFont}>{hop}</span>
                <span className="text-pulse-800 dark:text-[#A8B3CC]">
                  <strong className="font-semibold">{title}</strong> {desc}
                </span>
                <div className="text-right" style={monoFont}>
                  <div
                    className={`text-[13px] font-bold ${highlight ? 'text-teal-700 dark:text-teal-400' : 'text-pulse-800 dark:text-[#A8B3CC]'}`}
                  >
                    {lat}
                  </div>
                  <div className="text-[11px] text-pulse-500 dark:text-[#6B7A99] uppercase tracking-widest">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Host controls */}
      <section className="py-16 bg-pulse-50 dark:bg-[#0F1525]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Host controls</div>
          <h2 className="font-bold text-4xl tracking-tight mb-8 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            The console a facilitator actually wants.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {hostControls.map(({ icon, title, desc }) => (
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
            Ship the tally. Keep the room.
          </h2>
          <p className="text-slate-400 mb-8">
            Start a session free. Paid plans unlock recaps, exports, and longer retention.
          </p>
          <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
            Launch your first poll
          </Link>
        </div>
      </div>
    </MainLayout>
  )
}
