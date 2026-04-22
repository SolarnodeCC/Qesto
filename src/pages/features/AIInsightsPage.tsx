import FeaturePageTemplate from '../../components/FeaturePageTemplate'
import PageSeo from '../../components/PageSeo'
import { useT } from '../../i18n'

export default function AIInsightsPage() {
  const t = useT('solutions')

  return (
    <>
      <PageSeo
        title={t('features.aiInsights.seo.title')}
        description={t('features.aiInsights.seo.description')}
        canonicalPath="/features/ai-insights"
        ogImage="/images/solutions/photo-1521737604893-d14cc237f11d.avif"
      />
      <FeaturePageTemplate
        hero={{
          ai: true,
          badge: t('features.aiInsights.badge'),
          headline: t('features.aiInsights.headline'),
          subheadline: t('features.aiInsights.subheadline'),
          primaryCta: { label: t('cta.tryItFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
          imageUrl: '/images/solutions/photo-1521737604893-d14cc237f11d.avif',
          imageAlt: 'Team leads reviewing AI-generated insight summaries',
          gallery: [
            { src: '/images/solutions/photo-1551434678-e076c223a692.avif', alt: 'Team retrospectives transformed into clear themes' },
            { src: '/images/solutions/photo-1552664730-d307ca884978.avif', alt: 'Consultants sharing AI-backed recommendations' },
          ],
      }}
      howItWorks={{
        heading: t('features.aiInsights.howItWorks.heading'),
        steps: [
          {
            number: 1,
              title: t('features.aiInsights.howItWorks.step1.title'),
              desc: t('features.aiInsights.howItWorks.step1.desc'),
          },
          {
            number: 2,
              title: t('features.aiInsights.howItWorks.step2.title'),
              desc: t('features.aiInsights.howItWorks.step2.desc'),
          },
          {
            number: 3,
              title: t('features.aiInsights.howItWorks.step3.title'),
              desc: t('features.aiInsights.howItWorks.step3.desc'),
          },
        ],
      }}
      outcomes={{
        heading: t('features.aiInsights.outcomes.heading'),
        items: [
          {
            icon: '⚡',
              metric: t('features.aiInsights.outcomes.item1.metric'),
              desc: t('features.aiInsights.outcomes.item1.desc'),
          },
          {
            icon: '🔒',
              metric: t('features.aiInsights.outcomes.item2.metric'),
              desc: t('features.aiInsights.outcomes.item2.desc'),
          },
          {
            icon: '✦',
              metric: t('features.aiInsights.outcomes.item3.metric'),
              desc: t('features.aiInsights.outcomes.item3.desc'),
          },
        ],
      }}
      deepDive={{
        heading: 'Where AI Insights creates the biggest leverage',
        intro: 'Teams use AI Insights when they need to move quickly from qualitative input to strategic action without sacrificing nuance.',
        pillars: [
          {
            title: 'Faster preparation cycles',
            desc: 'Generate strong first-draft question sets from a short brief and reduce session design bottlenecks.',
          },
          {
            title: 'Higher-quality synthesis',
            desc: 'Turn hundreds of comments into coherent themes with tensions, outliers, and recurring signals surfaced early.',
          },
          {
            title: 'Decision-ready outputs',
            desc: 'Translate insight clusters into stakeholder narratives, priorities, and next-step recommendations.',
          },
        ],
      }}
      proof={{
        heading: t('features.aiInsights.proof.heading'),
        metrics: [
          { value: t('features.aiInsights.proof.metric1.value'), label: t('features.aiInsights.proof.metric1.label'), note: t('features.aiInsights.proof.metric1.note') },
          { value: t('features.aiInsights.proof.metric2.value'), label: t('features.aiInsights.proof.metric2.label'), note: t('features.aiInsights.proof.metric2.note') },
          { value: t('features.aiInsights.proof.metric3.value'), label: t('features.aiInsights.proof.metric3.label'), note: t('features.aiInsights.proof.metric3.note') },
        ],
        badges: [{ label: t('features.aiInsights.proof.badge1') }, { label: t('features.aiInsights.proof.badge2') }, { label: t('features.aiInsights.proof.badge3') }],
      }}
      related={{
        heading: t('features.aiInsights.related.heading'),
        links: [
            { label: t('features.aiInsights.related.link1.label'), href: '/hr', desc: t('features.aiInsights.related.link1.desc') },
            { label: t('features.aiInsights.related.link2.label'), href: '/consulting', desc: t('features.aiInsights.related.link2.desc') },
            { label: t('features.aiInsights.related.link3.label'), href: '/use-cases/workshops', desc: t('features.aiInsights.related.link3.desc') },
        ],
      }}
      faq={{
        heading: t('features.aiInsights.faq.heading'),
        items: [
          { question: t('features.aiInsights.faq.q1.question'), answer: t('features.aiInsights.faq.q1.answer') },
          { question: t('features.aiInsights.faq.q2.question'), answer: t('features.aiInsights.faq.q2.answer') },
          { question: t('features.aiInsights.faq.q3.question'), answer: t('features.aiInsights.faq.q3.answer') },
        ],
      }}
      bottomCta={{
          heading: t('features.aiInsights.bottomCta.heading'),
          subheading: t('features.aiInsights.bottomCta.subheading'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
        }}
      />
    </>
  )
}
