import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import AIBadge from './AIBadge'

export interface SolutionFeature {
  icon: string
  title: string
  desc: string
  ai?: boolean
}

export interface SolutionScenario {
  title: string
  desc: string
}

export interface ProofMetric {
  label: string
  value: string
  note?: string
}

export interface ProofBadge {
  label: string
}

export interface ProofTestimonial {
  quote: string
  author: string
  role?: string
}

export interface PainPoint {
  icon: string
  title: string
  desc: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface RelatedLink {
  label: string
  href: string
  desc: string
}

export interface SolutionPageProps {
  hero: {
    badge?: string
    headline: string
    subheadline: string
    primaryCta: { label: string; href: string }
    secondaryCta?: { label: string; href: string }
    imageUrl: string
    imageAlt: string
  }
  painPoints: {
    heading: string
    items: PainPoint[]
  }
  features: {
    heading: string
    subheading?: string
    items: SolutionFeature[]
  }
  scenarios: {
    heading: string
    items: SolutionScenario[]
  }
  proof?: {
    heading: string
    metrics?: ProofMetric[]
    badges?: ProofBadge[]
    testimonial?: ProofTestimonial
  }
  related?: {
    heading: string
    links: RelatedLink[]
  }
  faq?: {
    heading: string
    items: FaqItem[]
  }
  bottomCta: {
    heading: string
    subheading: string
    primaryCta: { label: string; href: string }
    secondaryCta?: { label: string; href: string }
  }
  navSlot?: ReactNode
}

export default function SolutionPageTemplate({
  hero,
  painPoints,
  features,
  scenarios,
  proof,
  related,
  faq,
  bottomCta,
  navSlot,
}: SolutionPageProps) {
  const faqJsonLd = faq
    ? {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    }
    : null

  return (
    <MainLayout navSlot={navSlot}>
      {/* Hero */}
      <section className="animate-page-enter bg-gradient-to-br from-teal-50 to-violet-50 border-b border-pulse-200">
        <div className="grid-container px-4 md:px-6 py-16 md:py-24">
          <div className="max-w-[1120px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              {hero.badge && (
                <span className="inline-flex items-center rounded-pill px-3 py-1 text-caption font-medium bg-teal-100 text-teal-700 border border-teal-200">
                  {hero.badge}
                </span>
              )}
              <h1
                tabIndex={-1}
                className="text-display-l font-bold bg-gradient-to-br from-teal-500 to-violet-600 bg-clip-text text-transparent focus:outline-none"
                style={{ fontFamily: 'var(--font-family-display)' }}
              >
                {hero.headline}
              </h1>
              <p className="text-body-l text-pulse-600 leading-relaxed">
                {hero.subheadline}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={hero.primaryCta.href}
                  className="inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-6 py-3 font-semibold hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion shadow-teal"
                >
                  {hero.primaryCta.label}
                </Link>
                {hero.secondaryCta && (
                  <Link
                    to={hero.secondaryCta.href}
                    className="inline-flex items-center rounded-lg border border-pulse-300 text-pulse-700 px-6 py-3 font-medium hover:border-teal-400 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion"
                  >
                    {hero.secondaryCta.label}
                  </Link>
                )}
              </div>
            </div>
            <div className="rounded-xl overflow-hidden shadow-elevated">
              <img
                src={hero.imageUrl}
                alt={hero.imageAlt}
                className="w-full h-64 lg:h-80 object-cover"
                loading="eager"
                fetchPriority="high"
                width="640"
                height="320"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section aria-labelledby="pain-points-heading" className="py-16 md:py-20 border-b border-pulse-200">
        <div className="grid-container px-4 md:px-6">
          <div className="max-w-[1120px] mx-auto space-y-10">
            <h2
              id="pain-points-heading"
              className="text-heading-l font-semibold text-center"
              style={{ fontFamily: 'var(--font-family-display)' }}
            >
              {painPoints.heading}
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6" role="list">
              {painPoints.items.map((item, i) => (
                <li
                  key={item.title}
                  className="animate-list-item rounded-xl border border-pulse-200 bg-white dark:bg-pulse-900 p-6 space-y-3 shadow-card"
                  style={{ '--stagger-index': i } as React.CSSProperties}
                >
                  <span className="text-2xl" aria-hidden="true">{item.icon}</span>
                  <h3 className="text-heading-s font-semibold">{item.title}</h3>
                  <p className="text-caption text-pulse-500 leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        aria-labelledby="features-heading"
        className="py-16 md:py-20 bg-gradient-to-br from-teal-50/50 to-violet-50/50 border-b border-pulse-200"
      >
        <div className="grid-container px-4 md:px-6">
          <div className="max-w-[1120px] mx-auto space-y-10">
            <div className="text-center space-y-3">
              <h2
                id="features-heading"
                className="text-heading-l font-semibold"
                style={{ fontFamily: 'var(--font-family-display)' }}
              >
                {features.heading}
              </h2>
              {features.subheading && (
                <p className="text-body-l text-pulse-600 max-w-2xl mx-auto">{features.subheading}</p>
              )}
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" role="list">
              {features.items.map((feat, i) => (
                <li
                  key={feat.title}
                  className="animate-list-item rounded-xl border border-pulse-200 bg-white dark:bg-pulse-900 p-5 space-y-3 shadow-card hover:shadow-elevated transition-shadow"
                  style={{ '--stagger-index': i } as React.CSSProperties}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden="true">{feat.icon}</span>
                    {feat.ai && <AIBadge variant="analyzed" />}
                  </div>
                  <h3 className="text-heading-s font-semibold">{feat.title}</h3>
                  <p className="text-caption text-pulse-500 leading-relaxed">{feat.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Proof */}
      {proof && (
        <section aria-labelledby="proof-heading" className="py-16 md:py-20 border-b border-pulse-200">
          <div className="grid-container px-4 md:px-6">
            <div className="max-w-[1120px] mx-auto space-y-8">
              <h2
                id="proof-heading"
                className="text-heading-l font-semibold text-center"
                style={{ fontFamily: 'var(--font-family-display)' }}
              >
                {proof.heading}
              </h2>

              {proof.metrics && proof.metrics.length > 0 && (
                <ul className="grid grid-cols-1 sm:grid-cols-3 gap-5" role="list">
                  {proof.metrics.map((metric, i) => (
                    <li
                      key={metric.label}
                      className="animate-list-item rounded-xl border border-pulse-200 bg-white dark:bg-pulse-900 p-5 space-y-2 text-center shadow-card"
                      style={{ '--stagger-index': i } as React.CSSProperties}
                    >
                      <p className="text-heading-m font-bold bg-gradient-to-br from-teal-500 to-violet-600 bg-clip-text text-transparent">
                        {metric.value}
                      </p>
                      <p className="text-heading-s font-semibold">{metric.label}</p>
                      {metric.note && <p className="text-caption text-pulse-500">{metric.note}</p>}
                    </li>
                  ))}
                </ul>
              )}

              {proof.badges && proof.badges.length > 0 && (
                <ul className="flex flex-wrap items-center justify-center gap-3" role="list">
                  {proof.badges.map((badge) => (
                    <li key={badge.label}>
                      <span className="inline-flex items-center rounded-pill px-3 py-1 text-caption font-medium bg-pulse-100 text-pulse-700 border border-pulse-200">
                        {badge.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {proof.testimonial && (
                <blockquote className="max-w-[780px] mx-auto rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50 to-violet-50 p-6 md:p-8 text-center space-y-3">
                  <p className="text-body-l text-pulse-700 leading-relaxed">"{proof.testimonial.quote}"</p>
                  <footer className="text-caption text-pulse-600">
                    <strong>{proof.testimonial.author}</strong>
                    {proof.testimonial.role ? `, ${proof.testimonial.role}` : ''}
                  </footer>
                </blockquote>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Scenarios */}
      <section aria-labelledby="scenarios-heading" className="py-16 md:py-20 border-b border-pulse-200">
        <div className="grid-container px-4 md:px-6">
          <div className="max-w-[1120px] mx-auto space-y-10">
            <h2
              id="scenarios-heading"
              className="text-heading-l font-semibold text-center"
              style={{ fontFamily: 'var(--font-family-display)' }}
            >
              {scenarios.heading}
            </h2>
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="list">
              {scenarios.items.map((s, i) => (
                <li
                  key={s.title}
                  className="animate-list-item rounded-xl border border-teal-100 bg-gradient-to-br from-teal-50 to-violet-50 p-6 space-y-2"
                  style={{ '--stagger-index': i } as React.CSSProperties}
                >
                  <h3 className="text-heading-s font-semibold text-teal-700">{s.title}</h3>
                  <p className="text-caption text-pulse-600 leading-relaxed">{s.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Related pages */}
      {related && (
        <section aria-labelledby="related-heading" className="py-16 md:py-20 border-b border-pulse-200">
          <div className="grid-container px-4 md:px-6">
            <div className="max-w-[1120px] mx-auto space-y-8">
              <h2
                id="related-heading"
                className="text-heading-l font-semibold text-center"
                style={{ fontFamily: 'var(--font-family-display)' }}
              >
                {related.heading}
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-5" role="list">
                {related.links.map((link, i) => (
                  <li key={link.href} className="animate-list-item" style={{ '--stagger-index': i } as React.CSSProperties}>
                    <Link
                      to={link.href}
                      className="block rounded-xl border border-pulse-200 bg-white dark:bg-pulse-900 p-5 space-y-2 shadow-card hover:shadow-elevated hover:border-teal-300 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                    >
                      <p className="text-heading-s font-semibold text-teal-700">{link.label}</p>
                      <p className="text-caption text-pulse-500">{link.desc}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faq && (
        <section aria-labelledby="faq-heading" className="py-16 md:py-20 border-b border-pulse-200">
          <div className="grid-container px-4 md:px-6">
            <div className="max-w-[900px] mx-auto space-y-8">
              <h2
                id="faq-heading"
                className="text-heading-l font-semibold text-center"
                style={{ fontFamily: 'var(--font-family-display)' }}
              >
                {faq.heading}
              </h2>
              <ul className="space-y-4" role="list">
                {faq.items.map((item, i) => (
                  <li
                    key={item.question}
                    className="animate-list-item rounded-xl border border-pulse-200 bg-white dark:bg-pulse-900 p-5 md:p-6 space-y-2 shadow-card"
                    style={{ '--stagger-index': i } as React.CSSProperties}
                  >
                    <h3 className="text-heading-s font-semibold">{item.question}</h3>
                    <p className="text-caption text-pulse-500 leading-relaxed">{item.answer}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
      {faqJsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(faqJsonLd)}
        </script>
      )}

      {/* Bottom CTA */}
      <section aria-labelledby="cta-heading" className="py-16 md:py-24">
        <div className="grid-container px-4 md:px-6">
          <div className="max-w-[680px] mx-auto text-center space-y-6 py-12 px-8 rounded-2xl bg-gradient-to-br from-teal-50 to-violet-50 border border-pulse-200">
            <h2
              id="cta-heading"
              className="text-heading-l font-bold bg-gradient-to-br from-teal-500 to-violet-600 bg-clip-text text-transparent"
              style={{ fontFamily: 'var(--font-family-display)' }}
            >
              {bottomCta.heading}
            </h2>
            <p className="text-body-l text-pulse-600">{bottomCta.subheading}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to={bottomCta.primaryCta.href}
                className="inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-6 py-3 font-semibold hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion shadow-teal"
              >
                {bottomCta.primaryCta.label}
              </Link>
              {bottomCta.secondaryCta && (
                <Link
                  to={bottomCta.secondaryCta.href}
                  className="inline-flex items-center rounded-lg border border-pulse-300 text-pulse-700 px-6 py-3 font-medium hover:border-teal-400 hover:text-teal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 btn-motion"
                >
                  {bottomCta.secondaryCta.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  )
}
