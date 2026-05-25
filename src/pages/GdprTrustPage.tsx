import { Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'
import { TrustBadge } from '../components/TrustBadge'

/**
 * GDPR-TRUST-PAGE-01 — Marketing trust page (no new engineering APIs).
 * Engineering badge (GDPR-BADGE-01) ships Sprint 34.
 */
export default function GdprTrustPage() {
  return (
    <MainLayout>
      <PageSeo
        title="GDPR & Data Trust — Qesto"
        description="How Qesto handles EU data, subprocessors, anonymity modes, and your rights under GDPR."
        canonicalPath="/trust/gdpr"
      />
      <article className="max-w-3xl mx-auto px-6 py-16 prose prose-pulse dark:prose-invert">
        <p className="text-sm font-medium text-teal-700 dark:text-teal-400 uppercase tracking-wide">Trust center</p>
        <h1 className="text-4xl font-bold tracking-tight text-pulse-900 dark:text-[#F0F2F8]">
          GDPR-ready by design
        </h1>
        <div className="not-prose flex flex-wrap gap-2 py-2">
          <TrustBadge variant="gdpr" />
          <TrustBadge variant="edge" />
        </div>
        <p className="text-lg text-pulse-600 dark:text-[#9AA8C7] leading-relaxed">
          Qesto runs on Cloudflare&apos;s edge network. Session data is processed close to participants with
          privacy-by-default anonymity modes — including zero-knowledge sessions where individual identity is never stored.
        </p>

        <section>
          <h2>What we store</h2>
          <ul>
            <li>Session questions, vote tallies, and optional open responses (plan-gated).</li>
            <li>Team membership and billing metadata for account holders.</li>
            <li>Audit events with sanitized labels — no raw participant text in admin energizer metrics.</li>
          </ul>
        </section>

        <section>
          <h2>EU hosting & subprocessors</h2>
          <p>
            Primary infrastructure is Cloudflare (Workers, D1, KV, Durable Objects). A full sub-processor registry and
            DPA template for enterprise customers ships with our compliance evidence pack (Sprint 34). Until then, request
            documentation via{' '}
            <a href="mailto:privacy@qesto.cc" className="text-teal-600 hover:underline">
              privacy@qesto.cc
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Your rights</h2>
          <p>
            Account holders can request export or deletion of personal data. Automated deletion tests and the public GDPR
            badge are on the roadmap for the v2.3 compliance release.
          </p>
        </section>

        <section>
          <h2>Related documents</h2>
          <ul>
            <li>
              <Link to="/privacy" className="text-teal-600 hover:underline">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link to="/features/privacy" className="text-teal-600 hover:underline">
                Anonymity modes explained
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="text-teal-600 hover:underline">
                Plans &amp; features
              </Link>
            </li>
          </ul>
        </section>

        <p className="text-sm text-pulse-500 border-t border-pulse-200 pt-6 dark:border-[#2A3858]">
          Last updated: May 2026. This page describes current product behavior; formal SOC 2 Type I evidence is planned
          for a later release.
        </p>
      </article>
    </MainLayout>
  )
}
