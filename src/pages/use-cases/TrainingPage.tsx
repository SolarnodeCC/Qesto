import SolutionPageTemplate from '../../components/SolutionPageTemplate'
import PageSeo from '../../components/PageSeo'
import { useT } from '../../i18n'

export default function TrainingPage() {
  const t = useT('solutions')

  return (
    <>
      <PageSeo
        title={t('useCases.training.seo.title')}
        description={t('useCases.training.seo.description')}
        canonicalPath="/use-cases/training"
        ogImage="/images/solutions/photo-1434030216411-0b793f4b4173.avif"
      />
      <SolutionPageTemplate
        hero={{
          badge: t('useCases.training.badge'),
          headline: t('useCases.training.headline'),
          subheadline: t('useCases.training.subheadline'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
          imageUrl: '/images/solutions/photo-1434030216411-0b793f4b4173.avif',
          imageAlt: t('useCases.training.imageAlt'),
          gallery: [
            { src: '/images/solutions/photo-1524178232363-1fb2b075b655.avif', alt: 'Learners participating in an interactive session' },
            { src: '/images/solutions/photo-1704652070195-61e76e1466db.avif', alt: 'Trainers collecting rapid feedback in real time' },
          ],
      }}
      painPoints={{
          heading: t('useCases.training.painPoints.heading'),
          items: [
            { icon: '😴', title: t('useCases.training.painPoints.passive.title'), desc: t('useCases.training.painPoints.passive.desc') },
            { icon: '🙋', title: t('useCases.training.painPoints.silence.title'), desc: t('useCases.training.painPoints.silence.desc') },
            { icon: '📝', title: t('useCases.training.painPoints.surveys.title'), desc: t('useCases.training.painPoints.surveys.desc') },
          ],
      }}
      features={{
          heading: t('useCases.training.features.heading'),
          items: [
            { icon: '🎯', title: t('useCases.training.features.formative.title'), desc: t('useCases.training.features.formative.desc') },
            { icon: '📊', title: t('useCases.training.features.confidence.title'), desc: t('useCases.training.features.confidence.desc') },
            { icon: '💬', title: t('useCases.training.features.reflection.title'), desc: t('useCases.training.features.reflection.desc') },
            { icon: '🤖', title: t('useCases.training.features.ai.title'), desc: t('useCases.training.features.ai.desc'), ai: true },
          ],
        }}
        proof={{
          heading: t('useCases.training.proof.heading'),
          metrics: [
            { value: t('useCases.training.proof.metric1.value'), label: t('useCases.training.proof.metric1.label'), note: t('useCases.training.proof.metric1.note') },
            { value: t('useCases.training.proof.metric2.value'), label: t('useCases.training.proof.metric2.label'), note: t('useCases.training.proof.metric2.note') },
            { value: t('useCases.training.proof.metric3.value'), label: t('useCases.training.proof.metric3.label'), note: t('useCases.training.proof.metric3.note') },
          ],
          badges: [{ label: t('useCases.training.proof.badge1') }, { label: t('useCases.training.proof.badge2') }, { label: t('useCases.training.proof.badge3') }],
          testimonial: {
            quote: t('useCases.training.proof.testimonial.quote'),
            author: t('useCases.training.proof.testimonial.author'),
            role: t('useCases.training.proof.testimonial.role'),
          },
      }}
      scenarios={{
          heading: t('useCases.training.scenarios.heading'),
          items: [
            { title: t('useCases.training.scenarios.midModule.title'), desc: t('useCases.training.scenarios.midModule.desc') },
            { title: t('useCases.training.scenarios.reflection.title'), desc: t('useCases.training.scenarios.reflection.desc') },
            { title: t('useCases.training.scenarios.baseline.title'), desc: t('useCases.training.scenarios.baseline.desc') },
          ],
        }}
        related={{
          heading: t('useCases.training.related.heading'),
          links: [
            { label: t('useCases.training.related.link1.label'), href: '/features/live-polling', desc: t('useCases.training.related.link1.desc') },
            { label: t('useCases.training.related.link2.label'), href: '/features/ai-insights', desc: t('useCases.training.related.link2.desc') },
            { label: t('useCases.training.related.link3.label'), href: '/events', desc: t('useCases.training.related.link3.desc') },
          ],
        }}
        faq={{
          heading: t('useCases.training.faq.heading'),
          items: [
            { question: t('useCases.training.faq.q1.question'), answer: t('useCases.training.faq.q1.answer') },
            { question: t('useCases.training.faq.q2.question'), answer: t('useCases.training.faq.q2.answer') },
            { question: t('useCases.training.faq.q3.question'), answer: t('useCases.training.faq.q3.answer') },
          ],
      }}
      bottomCta={{
          heading: t('useCases.training.bottomCta.heading'),
          subheading: t('useCases.training.bottomCta.subheading'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
        }}
      />
    </>
  )
}
