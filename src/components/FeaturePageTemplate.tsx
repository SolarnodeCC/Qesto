import { Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import AIBadge from './AIBadge'

export interface FeatureStep {
  number: number
  title: string
  desc: string
}

export interface FeatureOutcome {
  icon: string
  metric: string
  desc: string
}

export interface RelatedLink {
  label: string
  href: string
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

export interface FaqItem {
  question: string
  answer: string
}

export interface FeaturePageProps {
  hero: {
    badge?: string
    ai?: boolean
    headline: string
    subheadline: string
    primaryCta: { label: string; href: string }
    secondaryCta?: { label: string; href: string }
    imageUrl?: string
    imageAlt?: string
    gallery?: Array<{ src: string; alt: string }>
  }
  howItWorks: {
    heading: string
    steps: FeatureStep[]
  }
  outcomes: {
    heading: string
    items: FeatureOutcome[]
  }
  related: {
    heading: string
    links: RelatedLink[]
  }
  proof?: {
    heading: string
    metrics?: ProofMetric[]
    badges?: ProofBadge[]
    testimonial?: ProofTestimonial
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
}

export default function FeaturePageTemplate({
  hero,
  howItWorks,
  outcomes,
  related,
  proof,
  faq,
  bottomCta,
}: FeaturePageProps) {
  const hasHeroImage = Boolean(hero.imageUrl && hero.imageAlt)
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
    <MainLayout>
      {/* Hero */}
      <section className="animate-page-enter py-20 md:py-28 border-b border-pulse-200">
        <div className="grid-container px-4 md:px-6">
          <div className={hasHeroImage ? 'col-span-full max-w-[1120px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center' : 'col-span-full max-w-[680px] mx-auto text-center'}>
            <div className="space-y-6">
              <div className={hasHeroImage ? 'flex items-center gap-2' : 'flex items-center justify-center gap-2'}>
              {hero.ai && <AIBadge variant="analyzed" label="AI-powered" />}
              {hero.badge && (
                <span className="inline-flex items-center rounded-pill px-3 py-1 text-caption font-medium bg-teal-100 text-teal-700 border border-teal-200">
                  {hero.badge}
                </span>
              )}
              </div>
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
              <div className={hasHeroImage ? 'flex flex-wrap gap-3' : 'flex flex-wrap justify-center gap-3'}>
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

            {hasHeroImage && (
              <div className="space-y-4">
                <div className="rounded-xl overflow-hidden shadow-elevated ring-1 ring-teal-100">
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
                {hero.gallery && hero.gallery.length > 0 && (
                  <ul className="grid grid-cols-2 gap-3" role="list">
                    {hero.gallery.slice(0, 2).map((image) => (
                      <li key={image.src} className="rounded-lg overflow-hidden ring-1 ring-pulse-200 shadow-card">
                        <img
                          src={image.src}
                          alt={image.alt}
                          className="w-full h-24 object-cover"
                          loading="lazy"
                          width="320"
                          height="96"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Proof */}
      {proof && (
        <section aria-labelledby="feature-proof-heading" className="py-16 md:py-20 border-b border-pulse-200">
          <div className="grid-container px-4 md:px-6">
            <div className="col-span-full max-w-[1120px] mx-auto space-y-8">
              <h2
                id="feature-proof-heading"
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

      {/* How it works */}
      <section aria-labelledby="how-it-works-heading" className="py-16 md:py-20 border-b border-pulse-200">
        <div className="grid-container px-4 md:px-6">
          <div className="col-span-full max-w-[1120px] mx-auto space-y-12">
            <h2
              id="how-it-works-heading"
              className="text-heading-l font-semibold text-center"
              style={{ fontFamily: 'var(--font-family-display)' }}
            >
              {howItWorks.heading}
            </h2>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-8" role="list">
              {howItWorks.steps.map((step, i) => (
                <li
                  key={step.number}
                  className="animate-list-item flex flex-col gap-4"
                  style={{ '--stagger-index': i } as React.CSSProperties}
                >
                  <span
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-violet-600 text-white flex items-center justify-center font-bold text-sm"
                    aria-hidden="true"
                  >
                    {step.number}
                  </span>
                  <div className="space-y-1">
                    <h3 className="text-heading-s font-semibold">{step.title}</h3>
                    <p className="text-caption text-pulse-500 leading-relaxed">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section
        aria-labelledby="outcomes-heading"
        className="py-16 md:py-20 bg-gradient-to-br from-teal-50/50 to-violet-50/50 border-b border-pulse-200"
      >
        <div className="grid-container px-4 md:px-6">
          <div className="col-span-full max-w-[1120px] mx-auto space-y-10">
            <h2
              id="outcomes-heading"
              className="text-heading-l font-semibold text-center"
              style={{ fontFamily: 'var(--font-family-display)' }}
            >
              {outcomes.heading}
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-6" role="list">
              {outcomes.items.map((item, i) => (
                <li
                  key={item.metric}
                  className="animate-list-item rounded-xl border border-pulse-200 bg-white dark:bg-pulse-900 p-6 text-center space-y-3 shadow-card"
                  style={{ '--stagger-index': i } as React.CSSProperties}
                >
                  <span className="text-3xl" aria-hidden="true">{item.icon}</span>
                  <p className="text-heading-m font-bold bg-gradient-to-br from-teal-500 to-violet-600 bg-clip-text text-transparent">
                    {item.metric}
                  </p>
                  <p className="text-caption text-pulse-500 leading-relaxed">{item.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Related pages */}
      <section aria-labelledby="related-heading" className="py-16 md:py-20 border-b border-pulse-200">
        <div className="grid-container px-4 md:px-6">
          <div className="col-span-full max-w-[1120px] mx-auto space-y-8">
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

      {/* FAQ */}
      {faq && (
        <section aria-labelledby="feature-faq-heading" className="py-16 md:py-20 border-b border-pulse-200">
          <div className="grid-container px-4 md:px-6">
            <div className="col-span-full max-w-[900px] mx-auto space-y-8">
              <h2
                id="feature-faq-heading"
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
      <section aria-labelledby="feature-cta-heading" className="py-16 md:py-24">
        <div className="grid-container px-4 md:px-6">
          <div className="col-span-full max-w-[680px] mx-auto text-center space-y-6 py-12 px-8 rounded-2xl bg-gradient-to-br from-teal-50 to-violet-50 border border-pulse-200">
            <h2
              id="feature-cta-heading"
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
