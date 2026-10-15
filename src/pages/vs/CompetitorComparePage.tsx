import { Link } from 'react-router-dom'
import { Check, Minus, X } from 'lucide-react'
import MainLayout from '../../layouts/MainLayout'
import PageSeo from '../../components/PageSeo'
import Reveal from '../../components/Reveal'
import type { CompareCell, CompetitorComparePageData } from './compareData'

const btnPrimary =
  'inline-flex items-center justify-center px-8 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const btnSecondary =
  'inline-flex items-center justify-center px-8 py-3 rounded-lg font-medium text-pulse-900 dark:text-[#F0F2F8] text-sm border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-[#1C2540] hover:border-pulse-500 dark:hover:border-[#3A4870] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }

function Cell({ value }: { value: CompareCell }) {
  if (value === 'yes') {
    return (
      <span className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400 font-medium">
        <Check size={16} aria-hidden="true" /> Yes
      </span>
    )
  }
  if (value === 'no') {
    return (
      <span className="inline-flex items-center gap-1.5 text-pulse-500 dark:text-[#8A96B0]">
        <X size={16} aria-hidden="true" /> No
      </span>
    )
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
        <Minus size={16} aria-hidden="true" /> Partial
      </span>
    )
  }
  return <span className="text-pulse-700 dark:text-[#A8B3CC]">{value}</span>
}

export default function CompetitorComparePage({ data }: { data: CompetitorComparePageData }) {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Who is Qesto best for compared to ${data.competitorName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: data.whoQestoSuits.join(' '),
        },
      },
      {
        '@type': 'Question',
        name: `Who should stay with ${data.competitorName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: data.whoCompetitorSuits.join(' '),
        },
      },
      {
        '@type': 'Question',
        name: `How do I migrate from ${data.competitorName} to Qesto?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: data.migrationSteps.join(' '),
        },
      },
    ],
  }

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: data.title,
    description: data.description,
    url: `https://qesto.cc/vs/${data.slug}`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Qesto',
      url: 'https://qesto.cc',
    },
  }

  return (
    <MainLayout>
      <PageSeo
        title={data.title}
        description={data.description}
        canonicalPath={`/vs/${data.slug}`}
        jsonLd={[webPageJsonLd, faqJsonLd]}
      />

      <section className="py-16 md:py-20 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-3xl mx-auto px-8 text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">
            Compare
          </p>
          <h1
            className="font-bold text-4xl md:text-5xl tracking-tight mb-6 text-pulse-900 dark:text-[#F0F2F8]"
            style={displayFont}
            tabIndex={-1}
          >
            {data.h1}
          </h1>
          <p className="text-lg text-pulse-500 dark:text-[#8A96B0] leading-relaxed mb-8">{data.tldr}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/login" className={btnPrimary + ' text-base px-7 py-3.5'} style={gradientBrand}>
              Start free on Qesto
            </Link>
            <Link
              to="/pricing"
              className={btnSecondary + ' text-base px-7 py-3.5 dark:bg-[#1C2540] dark:border-[#2A3858] dark:text-[#F0F2F8]'}
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      <Reveal as="section" className="pb-16 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-5xl mx-auto px-8">
          <h2
            className="font-bold text-3xl tracking-tight mb-6 text-pulse-900 dark:text-[#F0F2F8]"
            style={displayFont}
          >
            Feature comparison
          </h2>
          <div className="overflow-x-auto rounded-xl border border-pulse-200 dark:border-[#2A3858]">
            <table className="w-full text-left text-sm">
              <thead className="bg-pulse-50 dark:bg-[#151C2E]">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-pulse-900 dark:text-[#F0F2F8]">
                    Capability
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-pulse-900 dark:text-[#F0F2F8]">
                    Qesto
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-pulse-900 dark:text-[#F0F2F8]">
                    {data.competitorName}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.feature} className="border-t border-pulse-100 dark:border-[#2A3858]">
                    <th scope="row" className="px-4 py-3 font-medium text-pulse-800 dark:text-[#D0D7E8] align-top">
                      {row.feature}
                      {row.note ? (
                        <p className="mt-1 text-xs font-normal text-pulse-500 dark:text-[#8A96B0]">{row.note}</p>
                      ) : null}
                    </th>
                    <td className="px-4 py-3 align-top">
                      <Cell value={row.qesto} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Cell value={row.competitor} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="pb-16 bg-pulse-50 dark:bg-[#0D1424]">
        <div className="max-w-5xl mx-auto px-8 grid md:grid-cols-2 gap-10">
          <div>
            <h2 className="font-bold text-2xl tracking-tight mb-4 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
              Who Qesto suits best
            </h2>
            <ul className="space-y-3 text-pulse-700 dark:text-[#A8B3CC]">
              {data.whoQestoSuits.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" size={18} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-bold text-2xl tracking-tight mb-4 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
              Who {data.competitorName} suits best
            </h2>
            <ul className="space-y-3 text-pulse-700 dark:text-[#A8B3CC]">
              {data.whoCompetitorSuits.map((item) => (
                <li key={item} className="flex gap-2">
                  <Minus className="text-pulse-400 shrink-0 mt-0.5" size={18} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" className="pb-16 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-bold text-3xl tracking-tight mb-6 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Migration guide
          </h2>
          <ol className="space-y-4 list-decimal list-inside text-pulse-700 dark:text-[#A8B3CC]">
            {data.migrationSteps.map((step) => (
              <li key={step} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/login" className={btnPrimary} style={gradientBrand}>
              Launch a free session
            </Link>
            <Link to="/templates" className={btnSecondary + ' dark:bg-[#1C2540] dark:border-[#2A3858] dark:text-[#F0F2F8]'}>
              Browse templates
            </Link>
          </div>
        </div>
      </Reveal>

      <section className="pb-16 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-3xl mx-auto px-8">
          <h2 className="font-bold text-xl tracking-tight mb-4 text-pulse-900 dark:text-[#F0F2F8]" style={displayFont}>
            Related
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {data.relatedLinks.map((link) => (
              <li key={link.href}>
                <Link to={link.href} className="text-teal-700 dark:text-teal-400 hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-xs text-pulse-500 dark:text-[#8A96B0] leading-relaxed">{data.sourcesNote}</p>
        </div>
      </section>
    </MainLayout>
  )
}
