import SolutionPageTemplate from '../../components/SolutionPageTemplate'
import PageSeo from '../../components/PageSeo'
import { useT } from '../../i18n'

export default function ConsultingPage() {
  const t = useT('solutions')

  return (
    <>
      <PageSeo
        title={t('consulting.seo.title')}
        description={t('consulting.seo.description')}
        canonicalPath="/consulting"
        ogImage="/images/solutions/photo-1552664730-d307ca884978.avif"
      />
      <SolutionPageTemplate
        hero={{
          badge: t('consulting.badge'),
          headline: t('consulting.headline'),
          subheadline: t('consulting.subheadline'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
          imageUrl: '/images/solutions/photo-1552664730-d307ca884978.avif',
          imageAlt: t('consulting.imageAlt'),
      }}
      painPoints={{
          heading: t('consulting.painPoints.heading'),
          items: [
            { icon: '🤔', title: t('consulting.painPoints.consensus.title'), desc: t('consulting.painPoints.consensus.desc') },
            { icon: '🗓️', title: t('consulting.painPoints.debrief.title'), desc: t('consulting.painPoints.debrief.desc') },
            { icon: '⏱️', title: t('consulting.painPoints.logistics.title'), desc: t('consulting.painPoints.logistics.desc') },
          ],
      }}
      features={{
          heading: t('consulting.features.heading'),
          items: [
            { icon: '🏆', title: t('consulting.features.ranking.title'), desc: t('consulting.features.ranking.desc') },
            { icon: '⚖️', title: t('consulting.features.consent.title'), desc: t('consulting.features.consent.desc') },
            { icon: '💬', title: t('consulting.features.open.title'), desc: t('consulting.features.open.desc'), ai: true },
            { icon: '📈', title: t('consulting.features.export.title'), desc: t('consulting.features.export.desc') },
          ],
        }}
        proof={{
          heading: t('consulting.proof.heading'),
          metrics: [
            { value: t('consulting.proof.metric1.value'), label: t('consulting.proof.metric1.label'), note: t('consulting.proof.metric1.note') },
            { value: t('consulting.proof.metric2.value'), label: t('consulting.proof.metric2.label'), note: t('consulting.proof.metric2.note') },
            { value: t('consulting.proof.metric3.value'), label: t('consulting.proof.metric3.label'), note: t('consulting.proof.metric3.note') },
          ],
          badges: [{ label: t('consulting.proof.badge1') }, { label: t('consulting.proof.badge2') }, { label: t('consulting.proof.badge3') }],
          testimonial: {
            quote: t('consulting.proof.testimonial.quote'),
            author: t('consulting.proof.testimonial.author'),
            role: t('consulting.proof.testimonial.role'),
          },
      }}
      scenarios={{
          heading: t('consulting.scenarios.heading'),
          items: [
            { title: t('consulting.scenarios.strategy.title'), desc: t('consulting.scenarios.strategy.desc') },
            { title: t('consulting.scenarios.retro.title'), desc: t('consulting.scenarios.retro.desc') },
            { title: t('consulting.scenarios.design.title'), desc: t('consulting.scenarios.design.desc') },
          ],
        }}
        related={{
          heading: t('consulting.related.heading'),
          links: [
            { label: t('consulting.related.link1.label'), href: '/use-cases/workshops', desc: t('consulting.related.link1.desc') },
            { label: t('consulting.related.link2.label'), href: '/features/ai-insights', desc: t('consulting.related.link2.desc') },
            { label: t('consulting.related.link3.label'), href: '/features/live-polling', desc: t('consulting.related.link3.desc') },
          ],
        }}
        faq={{
          heading: t('consulting.faq.heading'),
          items: [
            { question: t('consulting.faq.q1.question'), answer: t('consulting.faq.q1.answer') },
            { question: t('consulting.faq.q2.question'), answer: t('consulting.faq.q2.answer') },
            { question: t('consulting.faq.q3.question'), answer: t('consulting.faq.q3.answer') },
          ],
      }}
      bottomCta={{
          heading: t('consulting.bottomCta.heading'),
          subheading: t('consulting.bottomCta.subheading'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
        }}
      />
    </>
  )
}
