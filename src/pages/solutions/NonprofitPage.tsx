import SolutionPageTemplate from '../../components/SolutionPageTemplate'
import PageSeo from '../../components/PageSeo'
import { useT } from '../../i18n'

export default function NonprofitPage() {
  const t = useT('solutions')

  return (
    <>
      <PageSeo
        title={t('nonprofit.seo.title')}
        description={t('nonprofit.seo.description')}
        canonicalPath="/nonprofit"
        ogImage="/images/solutions/photo-1681949103006-70066fb25dfe.avif"
      />
      <SolutionPageTemplate
        hero={{
          badge: t('nonprofit.badge'),
          headline: t('nonprofit.headline'),
          subheadline: t('nonprofit.subheadline'),
          primaryCta: { label: t('cta.talkToSales'), href: '/pricing' },
          secondaryCta: { label: t('cta.startFree'), href: '/login' },
          imageUrl: '/images/solutions/photo-1681949103006-70066fb25dfe.avif',
          imageAlt: t('nonprofit.imageAlt'),
      }}
      painPoints={{
          heading: t('nonprofit.painPoints.heading'),
          items: [
            { icon: '🙋', title: t('nonprofit.painPoints.attendance.title'), desc: t('nonprofit.painPoints.attendance.desc') },
            { icon: '🗳️', title: t('nonprofit.painPoints.opaque.title'), desc: t('nonprofit.painPoints.opaque.desc') },
            { icon: '📢', title: t('nonprofit.painPoints.loudest.title'), desc: t('nonprofit.painPoints.loudest.desc') },
          ],
      }}
      features={{
          heading: t('nonprofit.features.heading'),
          items: [
            { icon: '✅', title: t('nonprofit.features.consent.title'), desc: t('nonprofit.features.consent.desc') },
            { icon: '🔒', title: t('nonprofit.features.anonymous.title'), desc: t('nonprofit.features.anonymous.desc') },
            { icon: '🌍', title: t('nonprofit.features.languages.title'), desc: t('nonprofit.features.languages.desc') },
            { icon: '📋', title: t('nonprofit.features.audit.title'), desc: t('nonprofit.features.audit.desc') },
          ],
        }}
        proof={{
          heading: t('nonprofit.proof.heading'),
          metrics: [
            { value: t('nonprofit.proof.metric1.value'), label: t('nonprofit.proof.metric1.label'), note: t('nonprofit.proof.metric1.note') },
            { value: t('nonprofit.proof.metric2.value'), label: t('nonprofit.proof.metric2.label'), note: t('nonprofit.proof.metric2.note') },
            { value: t('nonprofit.proof.metric3.value'), label: t('nonprofit.proof.metric3.label'), note: t('nonprofit.proof.metric3.note') },
          ],
          badges: [{ label: t('nonprofit.proof.badge1') }, { label: t('nonprofit.proof.badge2') }, { label: t('nonprofit.proof.badge3') }],
          testimonial: {
            quote: t('nonprofit.proof.testimonial.quote'),
            author: t('nonprofit.proof.testimonial.author'),
            role: t('nonprofit.proof.testimonial.role'),
          },
      }}
      scenarios={{
          heading: t('nonprofit.scenarios.heading'),
          items: [
            { title: t('nonprofit.scenarios.agm.title'), desc: t('nonprofit.scenarios.agm.desc') },
            { title: t('nonprofit.scenarios.priorities.title'), desc: t('nonprofit.scenarios.priorities.desc') },
            { title: t('nonprofit.scenarios.volunteer.title'), desc: t('nonprofit.scenarios.volunteer.desc') },
          ],
        }}
        related={{
          heading: t('nonprofit.related.heading'),
          links: [
            { label: t('nonprofit.related.link1.label'), href: '/features/privacy', desc: t('nonprofit.related.link1.desc') },
            { label: t('nonprofit.related.link2.label'), href: '/features/live-polling', desc: t('nonprofit.related.link2.desc') },
            { label: t('nonprofit.related.link3.label'), href: '/use-cases/workshops', desc: t('nonprofit.related.link3.desc') },
          ],
        }}
        faq={{
          heading: t('nonprofit.faq.heading'),
          items: [
            { question: t('nonprofit.faq.q1.question'), answer: t('nonprofit.faq.q1.answer') },
            { question: t('nonprofit.faq.q2.question'), answer: t('nonprofit.faq.q2.answer') },
            { question: t('nonprofit.faq.q3.question'), answer: t('nonprofit.faq.q3.answer') },
          ],
      }}
      bottomCta={{
          heading: t('nonprofit.bottomCta.heading'),
          subheading: t('nonprofit.bottomCta.subheading'),
          primaryCta: { label: t('cta.talkToSales'), href: '/pricing' },
          secondaryCta: { label: t('cta.startFree'), href: '/login' },
        }}
      />
    </>
  )
}
