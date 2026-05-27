import SolutionPageTemplate from '../components/SolutionPageTemplate'
import PageSeo from '../components/PageSeo'

/**
 * GDPR-TRUST-PAGE-01 — Marketing trust page (no new engineering APIs).
 * Engineering badge (GDPR-BADGE-01) ships Sprint 34.
 */
export default function GdprTrustPage() {
  return (
    <>
      <PageSeo
        title="GDPR & Data Trust — Qesto"
        description="How Qesto handles EU data, subprocessors, anonymity modes, and your rights under GDPR."
        canonicalPath="/trust/gdpr"
      />
      <SolutionPageTemplate
        hero={{
          headline: 'GDPR-ready by design',
          subheadline:
            "Qesto runs on Cloudflare's edge network. Session data is processed close to participants with privacy-by-default anonymity modes — including zero-knowledge sessions where individual identity is never stored.",
          primaryCta: { label: 'Get started', href: '/login' },
        }}
        faq={{
          heading: 'GDPR & data compliance',
          items: [
            {
              question: 'What data does Qesto store?',
              answer:
                'Session questions, vote tallies, and optional open responses (plan-gated). Team membership and billing metadata for account holders. Audit events with sanitized labels — no raw participant text in admin energizer metrics.',
            },
            {
              question: 'Where is our data hosted?',
              answer:
                'Primary infrastructure is Cloudflare (Workers, D1, KV, Durable Objects). A full sub-processor registry and DPA template for enterprise customers are available. Contact privacy@qesto.cc for documentation.',
            },
            {
              question: 'What rights do account holders have?',
              answer:
                'Account holders can request export or deletion of personal data. Automated deletion tests and the public GDPR badge are on the roadmap for the v2.3 compliance release.',
            },
            {
              question: 'How are participants anonymized?',
              answer:
                'Qesto supports anonymity modes where participant identity is completely decoupled from responses. In zero-knowledge sessions, individual identity is never stored — votes are aggregated without tracking individual participants.',
            },
          ],
        }}
        bottomCta={{
          heading: 'Ready to run compliant sessions?',
          subheading: 'Start creating sessions with built-in GDPR controls.',
          primaryCta: { label: 'Get started', href: '/login' },
        }}
      />
    </>
  )
}
