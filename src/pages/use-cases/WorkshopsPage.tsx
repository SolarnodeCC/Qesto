import SolutionPageTemplate from '../../components/SolutionPageTemplate'
import PageSeo from '../../components/PageSeo'
import { useT } from '../../i18n'

export default function WorkshopsPage() {
  const t = useT('solutions')

  return (
    <>
      <PageSeo
        title={t('useCases.workshops.seo.title')}
        description={t('useCases.workshops.seo.description')}
        canonicalPath="/use-cases/workshops"
        ogImage="/images/solutions/photo-1704652070195-61e76e1466db.avif"
      />
      <SolutionPageTemplate
        hero={{
          badge: t('useCases.workshops.badge'),
          headline: t('useCases.workshops.headline'),
          subheadline: t('useCases.workshops.subheadline'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
          imageUrl: '/images/solutions/photo-1704652070195-61e76e1466db.avif',
          imageAlt: t('useCases.workshops.imageAlt'),
      }}
      painPoints={{
          heading: t('useCases.workshops.painPoints.heading'),
          items: [
            { icon: '📌', title: t('useCases.workshops.painPoints.props.title'), desc: t('useCases.workshops.painPoints.props.desc') },
            { icon: '🌐', title: t('useCases.workshops.painPoints.distributed.title'), desc: t('useCases.workshops.painPoints.distributed.desc') },
            { icon: '📄', title: t('useCases.workshops.painPoints.results.title'), desc: t('useCases.workshops.painPoints.results.desc') },
          ],
      }}
      features={{
          heading: t('useCases.workshops.features.heading'),
          items: [
            { icon: '💡', title: t('useCases.workshops.features.ideas.title'), desc: t('useCases.workshops.features.ideas.desc') },
            { icon: '🏆', title: t('useCases.workshops.features.voting.title'), desc: t('useCases.workshops.features.voting.desc') },
            { icon: '🤖', title: t('useCases.workshops.features.ai.title'), desc: t('useCases.workshops.features.ai.desc'), ai: true },
            { icon: '📈', title: t('useCases.workshops.features.results.title'), desc: t('useCases.workshops.features.results.desc') },
          ],
        }}
        proof={{
          heading: t('useCases.workshops.proof.heading'),
          metrics: [
            { value: t('useCases.workshops.proof.metric1.value'), label: t('useCases.workshops.proof.metric1.label'), note: t('useCases.workshops.proof.metric1.note') },
            { value: t('useCases.workshops.proof.metric2.value'), label: t('useCases.workshops.proof.metric2.label'), note: t('useCases.workshops.proof.metric2.note') },
            { value: t('useCases.workshops.proof.metric3.value'), label: t('useCases.workshops.proof.metric3.label'), note: t('useCases.workshops.proof.metric3.note') },
          ],
          badges: [{ label: t('useCases.workshops.proof.badge1') }, { label: t('useCases.workshops.proof.badge2') }, { label: t('useCases.workshops.proof.badge3') }],
          testimonial: {
            quote: t('useCases.workshops.proof.testimonial.quote'),
            author: t('useCases.workshops.proof.testimonial.author'),
            role: t('useCases.workshops.proof.testimonial.role'),
          },
      }}
      scenarios={{
          heading: t('useCases.workshops.scenarios.heading'),
          items: [
            { title: t('useCases.workshops.scenarios.design.title'), desc: t('useCases.workshops.scenarios.design.desc') },
            { title: t('useCases.workshops.scenarios.values.title'), desc: t('useCases.workshops.scenarios.values.desc') },
            { title: t('useCases.workshops.scenarios.hybrid.title'), desc: t('useCases.workshops.scenarios.hybrid.desc') },
          ],
        }}
        related={{
          heading: t('useCases.workshops.related.heading'),
          links: [
            { label: t('useCases.workshops.related.link1.label'), href: '/consulting', desc: t('useCases.workshops.related.link1.desc') },
            { label: t('useCases.workshops.related.link2.label'), href: '/features/ai-insights', desc: t('useCases.workshops.related.link2.desc') },
            { label: t('useCases.workshops.related.link3.label'), href: '/features/live-polling', desc: t('useCases.workshops.related.link3.desc') },
          ],
        }}
        faq={{
          heading: t('useCases.workshops.faq.heading'),
          items: [
            { question: t('useCases.workshops.faq.q1.question'), answer: t('useCases.workshops.faq.q1.answer') },
            { question: t('useCases.workshops.faq.q2.question'), answer: t('useCases.workshops.faq.q2.answer') },
            { question: t('useCases.workshops.faq.q3.question'), answer: t('useCases.workshops.faq.q3.answer') },
          ],
      }}
      bottomCta={{
          heading: t('useCases.workshops.bottomCta.heading'),
          subheading: t('useCases.workshops.bottomCta.subheading'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
        }}
      />
    </>
  )
}
