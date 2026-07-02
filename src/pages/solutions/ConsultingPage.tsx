import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import PageSeo from '../../components/PageSeo'

const btnPrimary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const btnSecondary =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-medium text-pulse-900 dark:text-[#F0F2F8] text-sm border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-[#1C2540] hover:border-pulse-500 dark:hover:border-[#3A4870] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }

const themes = [
  { title: 'Theme 01 · Trust in forecasting', evidence: 12, quote: '"We don\'t believe the numbers until three people have re-keyed them." — 8 of 12 pre-workshop interviews echoed this.' },
  { title: 'Theme 02 · Meeting-to-decision gap', evidence: 9, quote: 'Live tally: 74% of attendees rated decision velocity ≤ 3/10. Cluster emerged unprompted in breakout 2.' },
  { title: 'Theme 03 · Cross-BU handoffs', evidence: 7, quote: 'Pulse at 14:20 found 6 of 7 teams losing context at handoff. Root cause cluster: ownership ambiguity.' },
]

const whitelabel = [
  { key: 'Branding', value: 'Workspace-level branding', sub: 'Your clients see a consistent room experience. Branded domains and PDF templates are roadmap work.' },
  { key: 'Template library', value: "Your firm's session templates, not ours", sub: 'Standard discovery, offsite, and retro templates shared across your partners. New engagements launch in 60 seconds.' },
  { key: 'Deliverable export', value: 'CSV session export today', sub: 'Use exported tallies as source material for your synthesis pipeline. DOCX, Notion, and JSON exports are roadmap work.' },
  { key: 'Client data isolation', value: 'Per-client Durable Object boundary', sub: "Acme's rooms never sit next to Globex's. Retention configured per engagement, not per account." },
  { key: 'Workspace SSO', value: 'SAML SSO on Chorus plans', sub: 'Workspace members can use configured SSO where the plan allows it. Clients can still join with a code.' },
]

export default function ConsultingPage() {
  return (
    <MainLayout>
      <PageSeo
        title="Qesto for Consulting — Workshops that ship evidence"
        description="Run client discovery, strategy offsites, and change-management sessions where every conclusion is backed by a tally."
        canonicalPath="/consulting"
        ogImage="/images/solutions/photo-1552664730-d307ca884978.avif"
      />

      {/* Hero */}
      <section className="py-16 md:py-20 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">
                Qesto for Consulting
              </div>
              <h1 className="font-bold text-5xl tracking-tight mb-5 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
                Workshops that ship{' '}
                <span className="bg-gradient-to-br from-teal-400 to-violet-500 bg-clip-text text-transparent">
                  evidence, not vibes.
                </span>
              </h1>
              <p className="text-lg text-pulse-500 dark:text-[#8A96B0] leading-relaxed mb-8">
                Run client discovery, strategy offsites, and change-management sessions where every conclusion is
                backed by a tally. The slide deck writes itself — and it quotes the room, not your intern.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
                  Run a pilot engagement
                </Link>
                <Link to="/pricing" className={btnSecondary + ' text-base px-7 py-3.5 dark:bg-[#1C2540] dark:border-[#2A3858] dark:text-[#F0F2F8]'}>
                  See a sample readout
                </Link>
              </div>
            </div>

            {/* Deliverable card */}
            <div className="bg-white dark:bg-[#1C2540] rounded-[20px] overflow-hidden" style={shadowElevated}>
              <div className="bg-pulse-900 text-white px-6 py-5 flex justify-between items-center">
                <span className="font-bold text-[18px] tracking-tight" style={displayFont}>
                  Client readout — Acme Industries
                </span>
                <span className="text-[12px] text-slate-400" style={monoFont}>2026-04-12</span>
              </div>
              <div className="p-7 space-y-4">
                {themes.map(({ title, evidence, quote }) => (
                  <div
                    key={title}
                    className="pl-4 py-3.5 pr-4 rounded-r-lg"
                    style={{ borderLeft: '3px solid #7C3AED', background: '#F5F3FF' }}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <strong className="text-[15px] font-semibold text-pulse-900 dark:text-[#F0F2F8]">{title}</strong>
                      <span className="text-[12px] font-semibold text-violet-700 dark:text-violet-400" style={monoFont}>
                        {evidence} evidence
                      </span>
                    </div>
                    <p className="text-[13.5px] text-pulse-500 dark:text-[#8A96B0] leading-snug italic">{quote}</p>
                  </div>
                ))}
              </div>
              <div
                className="px-6 py-3.5 bg-pulse-50 dark:bg-[#0F1525] border-t border-pulse-200 dark:border-[#1E2A45] flex justify-between text-[12px] text-pulse-500 dark:text-[#8A96B0]"
              >
                <span>Evidence-anchored · Session QSTO-5R8K</span>
                <span>Generated 14:42</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="py-16 bg-pulse-50 dark:bg-[#0F1525]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Engagement loop</div>
          <h2 className="font-bold text-4xl tracking-tight mb-3 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Discover. Workshop. Readout. Repeat.
          </h2>
          <p className="text-pulse-500 dark:text-[#8A96B0] mb-8 text-lg">
            Qesto sits across the three moments of a consulting engagement where your clients expect evidence —
            and where you'd usually burn a week synthesizing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                phase: 'Phase 01 · Discovery',
                title: 'Pre-engagement pulse',
                desc: "Ship a 10-question pulse to the client org before day one. Anonymous by default. AI clusters open responses into the 5 themes you'll walk in already knowing.",
                output: 'Output: themed evidence deck, ready for kickoff.',
              },
              {
                phase: 'Phase 02 · Workshop',
                title: 'Live session, live signal',
                desc: 'Facilitate on your slides; Qesto runs the tallies. Project behind you or tablet-beside-you. Every cluster is a slide you didn\'t have to build.',
                output: 'Output: decision log with evidence attached.',
              },
              {
                phase: 'Phase 03 · Readout',
                title: 'Evidence-anchored recap',
                desc: "Same-day client synthesis using exported tallies and reviewed AI themes. Rich branded PDF output is roadmap work.",
                output: "Output: reviewed recap source material for the sponsor.",
              },
            ].map(({ phase, title, desc, output }) => (
              <div key={phase} className="bg-white dark:bg-[#151C2E] rounded-2xl p-7" style={shadowCard}>
                <div className="text-[11px] font-bold uppercase tracking-widest text-pulse-500 dark:text-[#8A96B0] mb-2.5">{phase}</div>
                <h3 className="font-semibold text-[20px] mb-2.5 text-pulse-900 dark:text-[#F0F2F8]">{title}</h3>
                <p className="text-sm text-pulse-500 dark:text-[#8A96B0] leading-relaxed mb-4">{desc}</p>
                <div className="border-t border-dashed border-pulse-200 dark:border-[#1E2A45] pt-3.5 flex items-start gap-2 text-[13px] text-pulse-500 dark:text-[#8A96B0]">
                  <ArrowRight size={16} className="text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-teal-700 dark:text-teal-400">{output.split(':')[0]}:</strong>
                    {output.split(':')[1]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* White-label stack */}
      <section className="py-16 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Your firm on Qesto</div>
          <h2 className="font-bold text-4xl tracking-tight mb-8 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            White-label the room. Keep your brand on the deliverable.
          </h2>
          <div className="rounded-2xl overflow-hidden border border-pulse-200 dark:border-[#1E2A45] divide-y divide-pulse-200 dark:divide-[#1E2A45]">
            {whitelabel.map(({ key, value, sub }) => (
              <div
                key={key}
                className="bg-white dark:bg-[#151C2E] px-6 py-5 grid gap-6 items-start"
                style={{ gridTemplateColumns: '160px 1fr' }}
              >
                <span className="text-[11px] font-bold uppercase tracking-widest text-teal-700 dark:text-teal-400 pt-0.5">{key}</span>
                <span className="text-[15px] text-pulse-900 dark:text-[#F0F2F8] leading-relaxed">
                  {value}
                  <span className="block mt-1 text-[13.5px] text-pulse-500 dark:text-[#8A96B0]">{sub}</span>
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
              "We used to lose three days per engagement on synthesis. Now the readout is drafted before the workshop
              ends — we spend that time on the recommendation, not the slide."
            </p>
            <footer className="text-sm text-pulse-500 dark:text-[#8A96B0]">
              <strong className="text-pulse-900 dark:text-[#F0F2F8]">Marcus Viljoen</strong> · Partner, boutique strategy firm
            </footer>
          </blockquote>
        </div>
      </section>

      {/* CTA band */}
      <div className="py-10 px-6">
        <div className="max-w-6xl mx-auto bg-pulse-900 rounded-[2rem] text-white text-center py-16 px-8">
          <h2 className="font-bold text-4xl tracking-tight mb-3" style={displayFont}>
            Your next engagement has a receipt.
          </h2>
          <p className="text-slate-400 mb-8">
            Pilot Qesto on one client. If the readout doesn't save you a synthesis day, we'll refund the license.
          </p>
          <Link to="/pricing" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
            Talk to our consulting team
          </Link>
        </div>
      </div>
    </MainLayout>
  )
}
