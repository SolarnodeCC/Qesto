import SolutionPageTemplate from '../../components/SolutionPageTemplate'
import PageSeo from '../../components/PageSeo'
import { useT } from '../../i18n'

export default function EventsPage() {
  const t = useT('solutions')

  return (
    <>
      <PageSeo
        title={t('events.seo.title')}
        description={t('events.seo.description')}
        canonicalPath="/events"
        ogImage="/images/solutions/photo-1572021335469-31706a17aaef.avif"
      />
      <SolutionPageTemplate
        hero={{
          badge: t('events.badge'),
          headline: t('events.headline'),
          subheadline: t('events.subheadline'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
          imageUrl: '/images/solutions/photo-1572021335469-31706a17aaef.avif',
          imageAlt: t('events.imageAlt'),
          gallery: [
            { src: '/images/solutions/photo-1704652070195-61e76e1466db.avif', alt: 'Workshop participants co-creating in groups' },
            { src: '/images/solutions/photo-1557804506-669a67965ba0.avif', alt: 'Presenter engaging a crowd during a keynote' },
          ],
      }}
      painPoints={{
          heading: t('events.painPoints.heading'),
          items: [
            {
              icon: '😶',
              title: t('events.painPoints.passive.title'),
              desc: t('events.painPoints.passive.desc'),
            },
            {
              icon: '🐢',
              title: t('events.painPoints.feedback.title'),
              desc: t('events.painPoints.feedback.desc'),
            },
            {
              icon: '🔇',
              title: t('events.painPoints.silent.title'),
              desc: t('events.painPoints.silent.desc'),
            },
          ],
      }}
      features={{
          heading: t('events.features.heading'),
          subheading: t('events.features.subheading'),
          items: [
            {
              icon: '📊',
              title: t('events.features.livePolls.title'),
              desc: t('events.features.livePolls.desc'),
            },
            {
              icon: '🏆',
              title: t('events.features.ranking.title'),
              desc: t('events.features.ranking.desc'),
            },
            {
              icon: '💬',
              title: t('events.features.openQuestions.title'),
              desc: t('events.features.openQuestions.desc'),
              ai: true,
            },
            {
              icon: '✅',
              title: t('events.features.consent.title'),
              desc: t('events.features.consent.desc'),
            },
          ],
        }}
        proof={{
          heading: t('events.proof.heading'),
          metrics: [
            { value: t('events.proof.metric1.value'), label: t('events.proof.metric1.label'), note: t('events.proof.metric1.note') },
            { value: t('events.proof.metric2.value'), label: t('events.proof.metric2.label'), note: t('events.proof.metric2.note') },
            { value: t('events.proof.metric3.value'), label: t('events.proof.metric3.label'), note: t('events.proof.metric3.note') },
          ],
          badges: [
            { label: t('events.proof.badge1') },
            { label: t('events.proof.badge2') },
            { label: t('events.proof.badge3') },
          ],
          testimonial: {
            quote: t('events.proof.testimonial.quote'),
            author: t('events.proof.testimonial.author'),
            role: t('events.proof.testimonial.role'),
          },
      }}
      playbook={{
          heading: 'A high-impact event flow in three moves',
          intro: 'Use this facilitation pattern to increase participation and capture sponsor-ready evidence in every session block.',
          steps: [
            {
              title: 'Prime the room in minute one',
              desc: 'Open with a context-setting poll to map audience expectations and tailor speaker framing in real time.',
            },
            {
              title: 'Convert questions into priorities',
              desc: 'Run ranked Q&A during the talk so the most valuable questions rise early instead of getting lost at the end.',
            },
            {
              title: 'Close with actionable pulse data',
              desc: 'End each session with a quick confidence check and export the insights for sponsors, producers, and speakers.',
            },
          ],
        }}
      scenarios={{
          heading: t('events.scenarios.heading'),
          items: [
            {
              title: t('events.scenarios.warmup.title'),
              desc: t('events.scenarios.warmup.desc'),
            },
            {
              title: t('events.scenarios.qa.title'),
              desc: t('events.scenarios.qa.desc'),
            },
            {
              title: t('events.scenarios.pulse.title'),
              desc: t('events.scenarios.pulse.desc'),
            },
          ],
        }}
        related={{
          heading: t('events.related.heading'),
          links: [
            { label: t('events.related.link1.label'), href: '/features/live-polling', desc: t('events.related.link1.desc') },
            { label: t('events.related.link2.label'), href: '/features/ai-insights', desc: t('events.related.link2.desc') },
            { label: t('events.related.link3.label'), href: '/use-cases/workshops', desc: t('events.related.link3.desc') },
          ],
        }}
        faq={{
          heading: t('events.faq.heading'),
          items: [
            { question: t('events.faq.q1.question'), answer: t('events.faq.q1.answer') },
            { question: t('events.faq.q2.question'), answer: t('events.faq.q2.answer') },
            { question: t('events.faq.q3.question'), answer: t('events.faq.q3.answer') },
          ],
      }}
      bottomCta={{
          heading: t('events.bottomCta.heading'),
          subheading: t('events.bottomCta.subheading'),
          primaryCta: { label: t('cta.startFree'), href: '/login' },
          secondaryCta: { label: t('cta.viewPricing'), href: '/pricing' },
        }}
      />
    </>
  )
}
