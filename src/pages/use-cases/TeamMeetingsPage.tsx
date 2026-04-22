import SolutionPageTemplate from '../../components/SolutionPageTemplate'
import PageSeo from '../../components/PageSeo'
import { useT } from '../../i18n'

export default function TeamMeetingsPage() {
  const t = useT('solutions')

  return (
    <>
      <PageSeo
        title={t('useCases.teamMeetings.seo.title')}
        description={t('useCases.teamMeetings.seo.description')}
        canonicalPath="/use-cases/team-meetings"
        ogImage="/images/solutions/photo-1551434678-e076c223a692.avif"
      />
      <SolutionPageTemplate
        hero={{
          badge: t('useCases.teamMeetings.badge'),
          headline: t('useCases.teamMeetings.headline'),
          subheadline: t('useCases.teamMeetings.subheadline'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
          imageUrl: '/images/solutions/photo-1551434678-e076c223a692.avif',
          imageAlt: t('useCases.teamMeetings.imageAlt'),
      }}
      painPoints={{
          heading: t('useCases.teamMeetings.painPoints.heading'),
          items: [
            { icon: '🔇', title: t('useCases.teamMeetings.painPoints.silent.title'), desc: t('useCases.teamMeetings.painPoints.silent.desc') },
            { icon: '⏱️', title: t('useCases.teamMeetings.painPoints.time.title'), desc: t('useCases.teamMeetings.painPoints.time.desc') },
            { icon: '🤷', title: t('useCases.teamMeetings.painPoints.record.title'), desc: t('useCases.teamMeetings.painPoints.record.desc') },
          ],
      }}
      features={{
          heading: t('useCases.teamMeetings.features.heading'),
          items: [
            { icon: '⚡', title: t('useCases.teamMeetings.features.pulse.title'), desc: t('useCases.teamMeetings.features.pulse.desc') },
            { icon: '🏆', title: t('useCases.teamMeetings.features.ranking.title'), desc: t('useCases.teamMeetings.features.ranking.desc') },
            { icon: '✅', title: t('useCases.teamMeetings.features.consent.title'), desc: t('useCases.teamMeetings.features.consent.desc') },
            { icon: '📊', title: t('useCases.teamMeetings.features.recap.title'), desc: t('useCases.teamMeetings.features.recap.desc') },
          ],
        }}
        proof={{
          heading: t('useCases.teamMeetings.proof.heading'),
          metrics: [
            { value: t('useCases.teamMeetings.proof.metric1.value'), label: t('useCases.teamMeetings.proof.metric1.label'), note: t('useCases.teamMeetings.proof.metric1.note') },
            { value: t('useCases.teamMeetings.proof.metric2.value'), label: t('useCases.teamMeetings.proof.metric2.label'), note: t('useCases.teamMeetings.proof.metric2.note') },
            { value: t('useCases.teamMeetings.proof.metric3.value'), label: t('useCases.teamMeetings.proof.metric3.label'), note: t('useCases.teamMeetings.proof.metric3.note') },
          ],
          badges: [{ label: t('useCases.teamMeetings.proof.badge1') }, { label: t('useCases.teamMeetings.proof.badge2') }, { label: t('useCases.teamMeetings.proof.badge3') }],
          testimonial: {
            quote: t('useCases.teamMeetings.proof.testimonial.quote'),
            author: t('useCases.teamMeetings.proof.testimonial.author'),
            role: t('useCases.teamMeetings.proof.testimonial.role'),
          },
      }}
      scenarios={{
          heading: t('useCases.teamMeetings.scenarios.heading'),
          items: [
            { title: t('useCases.teamMeetings.scenarios.retro.title'), desc: t('useCases.teamMeetings.scenarios.retro.desc') },
            { title: t('useCases.teamMeetings.scenarios.sprint.title'), desc: t('useCases.teamMeetings.scenarios.sprint.desc') },
            { title: t('useCases.teamMeetings.scenarios.decision.title'), desc: t('useCases.teamMeetings.scenarios.decision.desc') },
          ],
        }}
        related={{
          heading: t('useCases.teamMeetings.related.heading'),
          links: [
            { label: t('useCases.teamMeetings.related.link1.label'), href: '/features/live-polling', desc: t('useCases.teamMeetings.related.link1.desc') },
            { label: t('useCases.teamMeetings.related.link2.label'), href: '/features/privacy', desc: t('useCases.teamMeetings.related.link2.desc') },
            { label: t('useCases.teamMeetings.related.link3.label'), href: '/hr', desc: t('useCases.teamMeetings.related.link3.desc') },
          ],
        }}
        faq={{
          heading: t('useCases.teamMeetings.faq.heading'),
          items: [
            { question: t('useCases.teamMeetings.faq.q1.question'), answer: t('useCases.teamMeetings.faq.q1.answer') },
            { question: t('useCases.teamMeetings.faq.q2.question'), answer: t('useCases.teamMeetings.faq.q2.answer') },
            { question: t('useCases.teamMeetings.faq.q3.question'), answer: t('useCases.teamMeetings.faq.q3.answer') },
          ],
      }}
      bottomCta={{
          heading: t('useCases.teamMeetings.bottomCta.heading'),
          subheading: t('useCases.teamMeetings.bottomCta.subheading'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
        }}
      />
    </>
  )
}
