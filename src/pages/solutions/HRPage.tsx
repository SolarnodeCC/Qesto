import SolutionPageTemplate from '../../components/SolutionPageTemplate'
import PageSeo from '../../components/PageSeo'
import { useT } from '../../i18n'

export default function HRPage() {
  const t = useT('solutions')

  return (
    <>
      <PageSeo
        title={t('hr.seo.title')}
        description={t('hr.seo.description')}
        canonicalPath="/hr"
        ogImage="/images/solutions/photo-1543269865-cbf427effbad.avif"
      />
      <SolutionPageTemplate
        hero={{
          badge: t('hr.badge'),
          headline: t('hr.headline'),
          subheadline: t('hr.subheadline'),
          primaryCta: { label: t('cta.talkToSales'), href: '/pricing' },
          secondaryCta: { label: t('cta.startFree'), href: '/login' },
          imageUrl: '/images/solutions/photo-1543269865-cbf427effbad.avif',
          imageAlt: t('hr.imageAlt'),
          gallery: [
            { src: '/images/solutions/photo-1521737604893-d14cc237f11d.avif', alt: 'HR leaders reviewing employee feedback themes' },
            { src: '/images/solutions/photo-1551434678-e076c223a692.avif', alt: 'Cross-functional team in a trust-building session' },
          ],
      }}
      painPoints={{
          heading: t('hr.painPoints.heading'),
          items: [
            { icon: '📅', title: t('hr.painPoints.stale.title'), desc: t('hr.painPoints.stale.desc') },
            { icon: '🤐', title: t('hr.painPoints.fear.title'), desc: t('hr.painPoints.fear.desc') },
            { icon: '📋', title: t('hr.painPoints.fatigue.title'), desc: t('hr.painPoints.fatigue.desc') },
          ],
      }}
      features={{
          heading: t('hr.features.heading'),
          items: [
            { icon: '🔒', title: t('hr.features.anonymity.title'), desc: t('hr.features.anonymity.desc') },
            { icon: '⚡', title: t('hr.features.pulse.title'), desc: t('hr.features.pulse.desc') },
            { icon: '🤖', title: t('hr.features.ai.title'), desc: t('hr.features.ai.desc'), ai: true },
            { icon: '📊', title: t('hr.features.gdpr.title'), desc: t('hr.features.gdpr.desc') },
          ],
        }}
        proof={{
          heading: t('hr.proof.heading'),
          metrics: [
            { value: t('hr.proof.metric1.value'), label: t('hr.proof.metric1.label'), note: t('hr.proof.metric1.note') },
            { value: t('hr.proof.metric2.value'), label: t('hr.proof.metric2.label'), note: t('hr.proof.metric2.note') },
            { value: t('hr.proof.metric3.value'), label: t('hr.proof.metric3.label'), note: t('hr.proof.metric3.note') },
          ],
          badges: [{ label: t('hr.proof.badge1') }, { label: t('hr.proof.badge2') }, { label: t('hr.proof.badge3') }],
          testimonial: {
            quote: t('hr.proof.testimonial.quote'),
            author: t('hr.proof.testimonial.author'),
            role: t('hr.proof.testimonial.role'),
          },
      }}
      scenarios={{
          heading: t('hr.scenarios.heading'),
          items: [
            { title: t('hr.scenarios.allHands.title'), desc: t('hr.scenarios.allHands.desc') },
            { title: t('hr.scenarios.onboarding.title'), desc: t('hr.scenarios.onboarding.desc') },
            { title: t('hr.scenarios.manager.title'), desc: t('hr.scenarios.manager.desc') },
          ],
        }}
        related={{
          heading: t('hr.related.heading'),
          links: [
            { label: t('hr.related.link1.label'), href: '/features/privacy', desc: t('hr.related.link1.desc') },
            { label: t('hr.related.link2.label'), href: '/features/ai-insights', desc: t('hr.related.link2.desc') },
            { label: t('hr.related.link3.label'), href: '/use-cases/team-meetings', desc: t('hr.related.link3.desc') },
          ],
        }}
        faq={{
          heading: t('hr.faq.heading'),
          items: [
            { question: t('hr.faq.q1.question'), answer: t('hr.faq.q1.answer') },
            { question: t('hr.faq.q2.question'), answer: t('hr.faq.q2.answer') },
            { question: t('hr.faq.q3.question'), answer: t('hr.faq.q3.answer') },
          ],
      }}
      bottomCta={{
          heading: t('hr.bottomCta.heading'),
          subheading: t('hr.bottomCta.subheading'),
          primaryCta: { label: t('cta.talkToSales'), href: '/pricing' },
          secondaryCta: { label: t('cta.startFree'), href: '/login' },
        }}
      />
    </>
  )
}
