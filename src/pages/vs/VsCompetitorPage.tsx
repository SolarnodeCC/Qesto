import { Link, Navigate, useParams } from 'react-router-dom'
import CompetitorComparePage from './CompetitorComparePage'
import { COMPETITOR_PAGES, COMPARE_HUB_LINKS } from './compareData'
import MainLayout from '../../layouts/MainLayout'
import PageSeo from '../../components/PageSeo'

const displayFont = { fontFamily: 'var(--font-family-display)' }
const btnPrimary =
  'inline-flex items-center justify-center px-8 py-3 rounded-lg font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }

export function CompareHubPage() {
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Qesto competitor comparisons',
    description: 'Independent comparisons of Qesto versus Mentimeter, Slido, Parabol, and more.',
    url: 'https://qesto.cc/compare',
    hasPart: COMPARE_HUB_LINKS.map((c) => ({
      '@type': 'WebPage',
      name: `Qesto vs ${c.name}`,
      url: `https://qesto.cc/vs/${c.slug}`,
    })),
  }

  return (
    <MainLayout>
      <PageSeo
        title="Compare Qesto — Mentimeter, Slido, Parabol Alternatives"
        description="See how Qesto compares to Mentimeter, Slido, and Parabol on privacy, edge latency, AI insights, and pricing."
        canonicalPath="/compare"
        jsonLd={itemList}
      />
      <section className="py-16 md:py-20 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-3xl mx-auto px-8 text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-teal-700 dark:text-teal-400 mb-3">
            Alternatives
          </p>
          <h1
            className="font-bold text-4xl md:text-5xl tracking-tight mb-6 text-pulse-900 dark:text-[#F0F2F8]"
            style={displayFont}
            tabIndex={-1}
          >
            Compare Qesto
          </h1>
          <p className="text-lg text-pulse-500 dark:text-[#8A96B0] leading-relaxed mb-10">
            Honest comparison pages for teams evaluating live polling and facilitation tools. No fabricated claims —
            just documented product differences.
          </p>
        </div>
        <div className="max-w-5xl mx-auto px-8 grid md:grid-cols-3 gap-6">
          {COMPARE_HUB_LINKS.map((c) => (
            <Link
              key={c.slug}
              to={`/vs/${c.slug}`}
              className="rounded-xl border border-pulse-200 dark:border-[#2A3858] bg-white dark:bg-[#151C2E] p-6 text-left hover:border-teal-500 dark:hover:border-teal-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <h2 className="font-bold text-xl text-pulse-900 dark:text-[#F0F2F8] mb-2" style={displayFont}>
                vs {c.name}
              </h2>
              <p className="text-sm text-pulse-500 dark:text-[#8A96B0] leading-relaxed">{c.blurb}</p>
            </Link>
          ))}
        </div>
        <div className="max-w-3xl mx-auto px-8 mt-12 text-center">
          <Link to="/login" className={btnPrimary} style={gradientBrand}>
            Start free
          </Link>
        </div>
      </section>
    </MainLayout>
  )
}

export default function VsCompetitorPage() {
  const { slug } = useParams<{ slug: string }>()
  const data = slug ? COMPETITOR_PAGES[slug] : undefined
  if (!data) {
    return <Navigate to="/compare" replace />
  }
  return <CompetitorComparePage data={data} />
}
