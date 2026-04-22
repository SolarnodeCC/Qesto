import FeaturePageTemplate from '../../components/FeaturePageTemplate'
import PageSeo from '../../components/PageSeo'
import { useT } from '../../i18n'

export default function PrivacyFeaturePage() {
  const t = useT('solutions')

  return (
    <>
      <PageSeo
        title={t('features.privacy.seo.title')}
        description={t('features.privacy.seo.description')}
        canonicalPath="/features/privacy"
      />
      <FeaturePageTemplate
        hero={{
          badge: t('features.privacy.badge'),
          headline: t('features.privacy.headline'),
          subheadline: t('features.privacy.subheadline'),
          primaryCta: { label: t('cta.talkToSales'), href: '/pricing' },
          secondaryCta: { label: t('features.privacy.hero.secondaryCta'), href: '/privacy' },
      }}
      howItWorks={{
        heading: t('features.privacy.howItWorks.heading'),
        steps: [
          {
            number: 1,
              title: t('features.privacy.howItWorks.step1.title'),
              desc: t('features.privacy.howItWorks.step1.desc'),
          },
          {
            number: 2,
              title: t('features.privacy.howItWorks.step2.title'),
              desc: t('features.privacy.howItWorks.step2.desc'),
          },
          {
            number: 3,
              title: t('features.privacy.howItWorks.step3.title'),
              desc: t('features.privacy.howItWorks.step3.desc'),
          },
        ],
      }}
      outcomes={{
        heading: t('features.privacy.outcomes.heading'),
        items: [
          {
            icon: '🔒',
              metric: t('features.privacy.outcomes.item1.metric'),
              desc: t('features.privacy.outcomes.item1.desc'),
          },
          {
            icon: '📋',
              metric: t('features.privacy.outcomes.item2.metric'),
              desc: t('features.privacy.outcomes.item2.desc'),
          },
          {
            icon: '🛡️',
              metric: t('features.privacy.outcomes.item3.metric'),
              desc: t('features.privacy.outcomes.item3.desc'),
          },
        ],
      }}
      proof={{
        heading: t('features.privacy.proof.heading'),
        metrics: [
          { value: t('features.privacy.proof.metric1.value'), label: t('features.privacy.proof.metric1.label'), note: t('features.privacy.proof.metric1.note') },
          { value: t('features.privacy.proof.metric2.value'), label: t('features.privacy.proof.metric2.label'), note: t('features.privacy.proof.metric2.note') },
          { value: t('features.privacy.proof.metric3.value'), label: t('features.privacy.proof.metric3.label'), note: t('features.privacy.proof.metric3.note') },
        ],
        badges: [{ label: t('features.privacy.proof.badge1') }, { label: t('features.privacy.proof.badge2') }, { label: t('features.privacy.proof.badge3') }],
      }}
      related={{
        heading: t('features.privacy.related.heading'),
        links: [
            { label: t('features.privacy.related.link1.label'), href: '/consulting', desc: t('features.privacy.related.link1.desc') },
            { label: t('features.privacy.related.link2.label'), href: '/hr', desc: t('features.privacy.related.link2.desc') },
            { label: t('features.privacy.related.link3.label'), href: '/nonprofit', desc: t('features.privacy.related.link3.desc') },
        ],
      }}
      faq={{
        heading: t('features.privacy.faq.heading'),
        items: [
          { question: t('features.privacy.faq.q1.question'), answer: t('features.privacy.faq.q1.answer') },
          { question: t('features.privacy.faq.q2.question'), answer: t('features.privacy.faq.q2.answer') },
          { question: t('features.privacy.faq.q3.question'), answer: t('features.privacy.faq.q3.answer') },
        ],
      }}
      bottomCta={{
          heading: t('features.privacy.bottomCta.heading'),
          subheading: t('features.privacy.bottomCta.subheading'),
          primaryCta: { label: t('cta.talkToSales'), href: '/pricing' },
          secondaryCta: { label: t('features.privacy.hero.secondaryCta'), href: '/privacy' },
        }}
      />
    </>
  )
}
