import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'

const displayFont = { fontFamily: 'var(--font-family-display)' }
const monoFont = { fontFamily: 'var(--font-family-mono)' }

const toc = [
  { id: 's1', label: 'Who we are' },
  { id: 's2', label: 'What we collect' },
  { id: 's3', label: 'Consent posture' },
  { id: 's4', label: 'How we use data' },
  { id: 's5', label: 'Sub-processors' },
  { id: 's6', label: 'Retention' },
  { id: 's7', label: 'Your rights' },
  { id: 's8', label: 'AI & inference' },
  { id: 's9', label: 'Security' },
  { id: 's10', label: 'Website analytics & cookies' },
  { id: 's11', label: 'Changes' },
  { id: 's12', label: 'Contact' },
]

export default function Privacy() {
  return (
    <MainLayout>
      <PageSeo
        title="Privacy Policy — Qesto"
        description="Read how Qesto handles session data, consent logs, retention, security controls, and privacy rights."
        canonicalPath="/privacy"
      />

      {/* Legal hero */}
      <div className="border-b border-pulse-200 pb-6 pt-14">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">Legal</div>
          <h1 className="font-bold tracking-tight text-pulse-900 dark:text-[#F0F2F8] mb-3" style={{ ...displayFont, fontSize: 44 }}>
            Privacy Policy
          </h1>
          <div className="flex gap-5 text-[13px] text-pulse-500 dark:text-[#8A96B0]" style={monoFont}>
            <span><strong className="text-pulse-600 dark:text-[#A8B3CC] font-semibold" style={{ fontFamily: 'var(--font-family-body)' }}>Version:</strong> 2.2.0</span>
            <span><strong className="text-pulse-600 dark:text-[#A8B3CC] font-semibold" style={{ fontFamily: 'var(--font-family-body)' }}>Effective:</strong> 2026-06-01</span>
            <span><strong className="text-pulse-600 dark:text-[#A8B3CC] font-semibold" style={{ fontFamily: 'var(--font-family-body)' }}>Previous:</strong> 2026-01-15</span>
          </div>
        </div>
      </div>

      {/* Legal layout */}
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid gap-16 py-12 pb-24" style={{ gridTemplateColumns: '200px 1fr' }}>

          {/* TOC */}
          <aside className="hidden md:block" style={{ position: 'sticky', top: 80, height: 'fit-content' }}>
            <h5 className="text-[13px] font-bold text-pulse-900 dark:text-[#F0F2F8] mb-3">On this page</h5>
            <ol className="space-y-1.5 list-decimal list-inside">
              {toc.map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="text-[13px] text-pulse-500 dark:text-[#8A96B0] hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          {/* Prose */}
          <main className="prose-content min-w-0">
            <p className="text-[17px] text-pulse-900 dark:text-[#F0F2F8] leading-relaxed mb-8">
              Qesto is built on the premise that a room speaks honestly only when it knows the rules. This document
              tells you exactly what happens to your data — what we hold, who touches it, and when it disappears.
            </p>

            <h2 id="s1" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              1. Who we are
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Qesto B.V. ("Qesto", "we") is registered in Amsterdam, the Netherlands, at KvK 88214503. We act as
              the data <em>processor</em> for hosts running sessions on our platform, and as <em>controller</em>{' '}
              only for our own account metadata (your login, your billing, the sessions you've created).
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              For hosted session data — votes, responses, tallies, consent logs — the host is the controller. We
              process on their instructions under the Data Processing Agreement you signed at account creation.
            </p>

            <h2 id="s2" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              2. What we collect
            </h2>
            <h3 className="font-semibold text-[18px] text-pulse-900 dark:text-[#F0F2F8] mt-5 mb-2">Host responsibilities</h3>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-pulse-700 dark:text-[#A8B3CC] mb-4">
              <li>Account email, name, organization name, and OAuth identifier (if SSO).</li>
              <li>Billing address and payment metadata (card handled by Stripe, never by us).</li>
              <li>Session configuration — question text, option labels, retention settings.</li>
            </ul>
            <h3 className="font-semibold text-[18px] text-pulse-900 dark:text-[#F0F2F8] mt-5 mb-2">Participant responsibilities</h3>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-pulse-700 dark:text-[#A8B3CC] mb-4">
              <li>Their consent choice for that session (identified, cohort-visible, or anonymous) with timestamp.</li>
              <li>Their votes and free-text responses.</li>
              <li>
                Their identity (name, email, team) <em>only if</em> they selected identified or cohort-visible mode.
              </li>
              <li>A short-lived, session-scoped session token. No cross-session tracking.</li>
            </ul>
            <h3 className="font-semibold text-[18px] text-pulse-900 dark:text-[#F0F2F8] mt-5 mb-2">Educational use &amp; minors</h3>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Qesto accounts require the account holder to be at least 16 years old. However, participants joining a
              session by code may include individuals under 16 — this is a designed use case for teachers,
              trainers, and educational institutions.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Where participants include minors, the host (teacher, institution, or employer) acts as the data
              controller for session responses and is responsible for ensuring an appropriate legal basis for
              processing exists — including obtaining parental consent where required under Art. 8 GDPR and
              Art. 16 UAVG (Dutch Implementation Act) for participants under 16. Qesto processes session data on
              the host's instructions as processor under the Data Processing Agreement.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Qesto does not independently verify the age of session participants. Hosts running sessions for
              audiences that include minors must configure appropriate anonymity settings (cohort-visible or
              anonymous mode is recommended) and obtain the necessary consents before the session begins.
            </p>

            <h2 id="s3" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              3. Consent posture
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Every session starts with a consent round. Participants pick their visibility posture before any
              question opens. The posture is honored for the life of the session and stored in the consent log.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              If a participant selects anonymous, we <strong>cannot</strong> re-link their response to an identity
              later. Not for legal hold, not for support, not for us. The link does not exist.
            </p>

            <h2 id="s4" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              4. How we use data
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-pulse-700 dark:text-[#A8B3CC] mb-4">
              <li><strong>To run your session.</strong> Deliver votes to the Durable Object, compute tallies, generate recaps.</li>
              <li><strong>To bill you.</strong> Count session-hours against your plan.</li>
              <li><strong>To support you.</strong> Respond to tickets. Support staff see only metadata, never raw responses, without your explicit request.</li>
              <li><strong>To keep the platform healthy.</strong> Aggregate error telemetry (no content, no identity).</li>
            </ul>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              We do <strong>not</strong> sell data. We do <strong>not</strong> serve ads. We do{' '}
              <strong>not</strong> train models on your content.
            </p>

            <h2 id="s5" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              5. Sub-processors
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-3">The complete list:</p>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-pulse-700 dark:text-[#A8B3CC] mb-4">
              <li><strong>Cloudflare, Inc.</strong> — Workers compute, Durable Objects, D1, KV storage, and Workers AI inference.</li>
              <li><strong>Stripe, Inc.</strong> — payment processing for paid plans. No session data ever touches Stripe.</li>
              <li><strong>Resend.</strong> — transactional email for login links and account messages.</li>
              <li>
                <strong>Microsoft Corporation</strong> — Microsoft Clarity website &amp; product-UI analytics,
                loaded <em>only</em> after you accept analytics cookies (section 10). Masked interaction data
                only; never your session votes or responses.
              </li>
            </ul>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              That's the whole list. We publish changes 30 days in advance; existing customers can object in writing.
            </p>

            <h2 id="s6" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              6. Retention
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-3">
              Retention is configured per workspace. Defaults:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-pulse-700 dark:text-[#A8B3CC] mb-4">
              <li><strong>Pulse plan:</strong> 30 days.</li>
              <li><strong>Signal plan:</strong> 365 days.</li>
              <li><strong>Chorus plan:</strong> custom, as low as 7 days or as high as 7 years.</li>
            </ul>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Identity rows purge first. Aggregate tallies can persist longer — with no link back — for trend
              reporting.
            </p>

            <h2 id="s7" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              7. Your rights
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Under GDPR and equivalent laws, you have the right to access, correct, export, or remove your data.
              Email{' '}
              <a href="mailto:dpo@qesto.cc" className="text-teal-600 hover:underline">
                dpo@qesto.cc
              </a>{' '}
              — we respond within 30 days.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Participants: for rights over responses submitted in a session, contact the host who ran that session.
              We'll help them execute the request.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              You also have the right to lodge a complaint with a supervisory authority. In the Netherlands:{' '}
              <strong>Autoriteit Persoonsgegevens (AP)</strong>,{' '}
              <a
                href="https://www.autoriteitpersoonsgegevens.nl"
                className="text-teal-600 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                autoriteitpersoonsgegevens.nl
              </a>
              . If you are located in another EU member state, you may also contact your local Data Protection
              Authority.
            </p>

            <h2 id="s8" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              8. AI &amp; inference
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Qesto uses <strong>Cloudflare Workers AI only</strong>. Inference runs on Cloudflare's network. No
              vendor hand-off to OpenAI, Anthropic, or Azure AI.
            </p>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Model inputs and outputs live with the session. Remove the session, the prompts go with it. No training
              pipeline, no fine-tuning corpus, no retention past the session's own retention window.
            </p>

            <h2 id="s9" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              9. Security
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-pulse-700 dark:text-[#A8B3CC] mb-4">
              <li>TLS 1.3 for every connection. HSTS with preload.</li>
              <li>Data at rest is encrypted by the managed Cloudflare services Qesto uses.</li>
              <li>Access to team data is controlled through JWT authentication, team membership, and plan-gated features.</li>
              <li>Formal compliance reports, customer-managed keys, and third-party penetration-test summaries are roadmap items for enterprise procurement.</li>
            </ul>

            <h2 id="s10" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              10. Website analytics &amp; cookies
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              We use <strong>Microsoft Clarity</strong> to understand how people navigate our website and product
              interface — heatmaps and replays of clicks, scrolls, and page transitions — so we can fix confusing
              flows. This is the only third-party analytics we run.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[15px] text-pulse-700 dark:text-[#A8B3CC] mb-4">
              <li>
                It loads <strong>only after you accept analytics cookies</strong> in the banner. Decline, and Clarity
                is never loaded and no analytics cookies are set.
              </li>
              <li>
                Clarity masks text and form input by default. It captures <em>interaction patterns</em>, not the
                content of your votes or responses — that session data stays within the sections above and is never
                sent to Clarity.
              </li>
              <li>
                When enabled, Microsoft Corporation acts as our processor and may process this usage data on our
                behalf under its{' '}
                <a
                  href="https://privacy.microsoft.com/privacystatement"
                  className="text-teal-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  privacy statement
                </a>.
              </li>
              <li>
                You can withdraw consent at any time by clearing this site's cookies and storage in your browser; the
                banner will ask again.
              </li>
            </ul>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              This is distinct from the in-session consent posture in section 3, which governs how participants appear
              within a session.
            </p>

            <h2 id="s11" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              11. Changes
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              We'll notify you 30 days before material changes. Minor edits (clarifications, sub-processor
              replacements within the same tier) get a version bump and a changelog entry — no email blast.
            </p>

            <h2 id="s12" className="font-bold text-[26px] tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-10 mb-4" style={displayFont}>
              12. Contact
            </h2>
            <p className="text-[15px] leading-relaxed text-pulse-700 dark:text-[#A8B3CC] mb-4">
              Data Protection Officer:{' '}
              <a href="mailto:dpo@qesto.cc" className="text-teal-600 hover:underline">dpo@qesto.cc</a>
              {' '}· EU representative:{' '}
              <a href="mailto:eu-rep@qesto.cc" className="text-teal-600 hover:underline">eu-rep@qesto.cc</a>
              {' '}· General:{' '}
              <a href="mailto:privacy@qesto.cc" className="text-teal-600 hover:underline">privacy@qesto.cc</a>
            </p>
            <p className="text-[13px] text-pulse-500 mt-8">
              — This policy replaces all prior privacy statements. Prior versions available on request.
            </p>
          </main>
        </div>
      </div>
    </MainLayout>
  )
}
