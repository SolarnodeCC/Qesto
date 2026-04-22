import FeaturePageTemplate from '../../components/FeaturePageTemplate'
import PageSeo from '../../components/PageSeo'
import { useT } from '../../i18n'

export default function LivePollingPage() {
  const t = useT('solutions')

  return (
    <>
      <PageSeo
        title={t('features.livePolling.seo.title')}
        description={t('features.livePolling.seo.description')}
        canonicalPath="/features/live-polling"
        ogImage="/images/solutions/photo-1572021335469-31706a17aaef.avif"
      />
      <FeaturePageTemplate
        hero={{
          badge: t('features.livePolling.badge'),
          headline: t('features.livePolling.headline'),
          subheadline: t('features.livePolling.subheadline'),
          primaryCta: { label: t('cta.tryItFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
          imageUrl: '/images/solutions/photo-1572021335469-31706a17aaef.avif',
          imageAlt: 'Audience responding to a live poll during an event',
          gallery: [
            { src: '/images/solutions/photo-1704652070195-61e76e1466db.avif', alt: 'Workshop participants ranking ideas in real time' },
            { src: '/images/solutions/photo-1557804506-669a67965ba0.avif', alt: 'Large session with instant pulse checks' },
          ],
      }}
      howItWorks={{
        heading: t('features.livePolling.howItWorks.heading'),
        steps: [
          {
            number: 1,
              title: t('features.livePolling.howItWorks.step1.title'),
              desc: t('features.livePolling.howItWorks.step1.desc'),
          },
          {
            number: 2,
              title: t('features.livePolling.howItWorks.step2.title'),
              desc: t('features.livePolling.howItWorks.step2.desc'),
          },
          {
            number: 3,
              title: t('features.livePolling.howItWorks.step3.title'),
              desc: t('features.livePolling.howItWorks.step3.desc'),
          },
        ],
      }}
      outcomes={{
        heading: t('features.livePolling.outcomes.heading'),
        items: [
          {
            icon: '🌍',
              metric: t('features.livePolling.outcomes.item1.metric'),
              desc: t('features.livePolling.outcomes.item1.desc'),
          },
          {
            icon: '👥',
              metric: t('features.livePolling.outcomes.item2.metric'),
              desc: t('features.livePolling.outcomes.item2.desc'),
          },
          {
            icon: '🗳️',
              metric: t('features.livePolling.outcomes.item3.metric'),
              desc: t('features.livePolling.outcomes.item3.desc'),
          },
        ],
      }}
      proof={{
        heading: t('features.livePolling.proof.heading'),
        metrics: [
          { value: t('features.livePolling.proof.metric1.value'), label: t('features.livePolling.proof.metric1.label'), note: t('features.livePolling.proof.metric1.note') },
          { value: t('features.livePolling.proof.metric2.value'), label: t('features.livePolling.proof.metric2.label'), note: t('features.livePolling.proof.metric2.note') },
          { value: t('features.livePolling.proof.metric3.value'), label: t('features.livePolling.proof.metric3.label'), note: t('features.livePolling.proof.metric3.note') },
        ],
      }}
      related={{
        heading: t('features.livePolling.related.heading'),
        links: [
            { label: t('features.livePolling.related.link1.label'), href: '/events', desc: t('features.livePolling.related.link1.desc') },
            { label: t('features.livePolling.related.link2.label'), href: '/hr', desc: t('features.livePolling.related.link2.desc') },
            { label: t('features.livePolling.related.link3.label'), href: '/use-cases/team-meetings', desc: t('features.livePolling.related.link3.desc') },
        ],
      }}
      faq={{
        heading: t('features.livePolling.faq.heading'),
        items: [
          { question: t('features.livePolling.faq.q1.question'), answer: t('features.livePolling.faq.q1.answer') },
          { question: t('features.livePolling.faq.q2.question'), answer: t('features.livePolling.faq.q2.answer') },
          { question: t('features.livePolling.faq.q3.question'), answer: t('features.livePolling.faq.q3.answer') },
        ],
      }}
      bottomCta={{
          heading: t('features.livePolling.bottomCta.heading'),
          subheading: t('features.livePolling.bottomCta.subheading'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
        }}
      />
    </>
  )
}
