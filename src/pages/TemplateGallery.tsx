import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Users, BookOpen, ChevronRight } from 'lucide-react'
import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'
import { api } from '../api/client'
import { useT } from '../i18n'
import { generateOgImageUrl } from '../utils/og-image-generator'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }

type Industry =
  | 'hr-people'
  | 'agile-software'
  | 'education-training'
  | 'leadership-management'
  | 'sales-customer-success'
  | 'healthcare'
  | 'general'

type Theme =
  | 'team-wellbeing'
  | 'retrospective-reflection'
  | 'change-transformation'
  | 'learning-development'
  | 'engagement-motivation'
  | 'strategy-alignment'
  | 'innovation-ideation'

type Lang = 'nl' | 'en' | 'de' | 'fr'

interface TemplateRecord {
  id: string
  title: Record<Lang, string>
  purpose: Record<Lang, string>
  bestUsedFor: Record<Lang, string[]>
  estimatedMinutes: number
  questions: { id: string; text: Record<Lang, string>; type: string }[]
  industry: Industry
  theme: Theme
  topic: string
  usageCount: number
  createdAt: string
}

const INDUSTRY_LABELS: Record<Industry, string> = {
  'hr-people': 'HR & People',
  'agile-software': 'Agile & Software',
  'education-training': 'Education & Training',
  'leadership-management': 'Leadership & Management',
  'sales-customer-success': 'Sales & Customer Success',
  'healthcare': 'Healthcare',
  'general': 'General',
}

const THEME_LABELS: Record<Theme, string> = {
  'team-wellbeing': 'Team Wellbeing',
  'retrospective-reflection': 'Retrospective & Reflection',
  'change-transformation': 'Change & Transformation',
  'learning-development': 'Learning & Development',
  'engagement-motivation': 'Engagement & Motivation',
  'strategy-alignment': 'Strategy & Alignment',
  'innovation-ideation': 'Innovation & Ideation',
}

function TemplateCard({ template, lang }: { template: TemplateRecord; lang: Lang }) {
  const t = useT('common')
  const title = template.title[lang] || template.title.en
  const purpose = template.purpose[lang] || template.purpose.en

  return (
    <Link
      to={`/templates/${template.id}`}
      className="group block rounded-2xl bg-white dark:bg-[#111827] border border-pulse-100 dark:border-white/10 hover:border-teal-400 dark:hover:border-teal-500 transition-all duration-200 overflow-hidden"
      style={shadowCard}
      aria-label={title}
    >
      {/* Tag strip */}
      <div className="h-1 w-full" style={gradientBrand} />

      <div className="p-5">
        {/* Industry badge */}
        <span className="inline-block mb-3 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
          {INDUSTRY_LABELS[template.industry]}
        </span>

        {/* Title */}
        <h3 className="font-semibold text-base text-pulse-900 dark:text-[var(--text-primary)] mb-2 line-clamp-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
          {title}
        </h3>

        {/* Purpose */}
        <p className="text-sm text-pulse-600 dark:text-[#8893AD] line-clamp-2 mb-4">
          {purpose}
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-4 text-xs text-pulse-500 dark:text-[#8893AD]">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {template.questions.length} {t('templates.questions')}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {template.estimatedMinutes} min
          </span>
          {template.usageCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {template.usageCount}
            </span>
          )}
        </div>

        {/* CTA link */}
        <div className="mt-4 flex items-center gap-1 text-sm font-medium text-teal-600 dark:text-teal-400 group-hover:gap-2 transition-all">
          {t('templates.viewTemplate')}
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  )
}

export default function TemplateGallery() {
  const t = useT('common')
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [industry, setIndustry] = useState<Industry | ''>('')
  const [theme, setTheme] = useState<Theme | ''>('')
  const lang: Lang = (document.documentElement.lang?.slice(0, 2) as Lang) || 'en'

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (industry) params.set('industry', industry)
    if (theme) params.set('theme', theme)
    params.set('lang', lang)
    params.set('limit', '60')

    api<TemplateRecord[]>(`/api/gallery?${params}`, { signal: controller.signal })
      .then((result) => {
        if (result.ok) setTemplates(result.data)
        else setError(result.error.message)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [industry, theme, lang])

  // SEO: Collection page schema
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Qesto Template Gallery',
    description: 'Browse ready-to-use session templates for team engagement, learning, and insights.',
    url: 'https://qesto.cc/templates',
    isPartOf: {
      '@type': 'WebSite',
      name: 'Qesto',
      url: 'https://qesto.cc',
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://qesto.cc/templates?industry={industry}&theme={theme}',
      },
      'query-input': 'required name=industry,theme',
    },
  }

  const galleryOgImage = generateOgImageUrl({
    title: 'Qesto Template Gallery',
    subtitle: 'Browse ready-to-use session templates',
    color: 'teal',
  })

  return (
    <MainLayout>
      <PageSeo
        title={t('templates.galleryTitle')}
        description={t('templates.galleryDescription')}
        canonicalPath="/templates"
        ogImage={galleryOgImage}
        jsonLd={collectionSchema}
      />

      {/* Hero */}
      <section className="py-14 md:py-20 bg-white dark:bg-[var(--color-bg)]">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div
            className="inline-block text-xs font-bold tracking-widest uppercase mb-4 px-3 py-1 rounded-full text-white"
            style={gradientBrand}
          >
            {t('templates.galleryBadge')}
          </div>
          <h1
            className="font-bold text-4xl md:text-5xl text-pulse-900 dark:text-[var(--text-primary)] mb-4"
            style={displayFont}
            tabIndex={-1}
          >
            {t('templates.galleryHeading')}
          </h1>
          <p className="text-lg text-pulse-600 dark:text-[#8893AD] max-w-2xl mx-auto">
            {t('templates.gallerySubheading')}
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="border-y border-pulse-100 dark:border-white/10 bg-pulse-50 dark:bg-[#0D1424]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap gap-3 items-center">
          <span className="text-sm font-medium text-pulse-700 dark:text-[#8893AD] mr-2">
            {t('templates.filterBy')}
          </span>

          {/* Industry filter */}
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value as Industry | '')}
            className="text-sm rounded-lg border border-pulse-200 dark:border-white/20 bg-white dark:bg-[#111827] text-pulse-900 dark:text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label={t('templates.filterIndustry')}
          >
            <option value="">{t('templates.allIndustries')}</option>
            {Object.entries(INDUSTRY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Theme filter */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme | '')}
            className="text-sm rounded-lg border border-pulse-200 dark:border-white/20 bg-white dark:bg-[#111827] text-pulse-900 dark:text-[var(--text-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            aria-label={t('templates.filterTheme')}
          >
            <option value="">{t('templates.allThemes')}</option>
            {Object.entries(THEME_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {(industry || theme) && (
            <button
              onClick={() => { setIndustry(''); setTheme('') }}
              className="text-sm text-pulse-500 dark:text-[#8893AD] hover:text-teal-600 dark:hover:text-teal-400 transition-colors underline underline-offset-2"
            >
              {t('templates.clearFilters')}
            </button>
          )}

          <span className="ml-auto text-sm text-pulse-500 dark:text-[#8893AD]">
            {loading ? t('loading') : t('templates.templateCount', { count: templates.length })}
          </span>
        </div>
      </section>

      {/* Grid */}
      <section className="py-12 bg-white dark:bg-[var(--color-bg)]">
        <div className="max-w-6xl mx-auto px-6">
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-56 rounded-2xl bg-pulse-100 dark:bg-white/5 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-20">
              <p className="text-pulse-600 dark:text-[#8893AD] mb-4">{t('error')}</p>
              <button
                onClick={() => setIndustry(industry)}
                className="text-sm text-teal-600 dark:text-teal-400 underline"
              >
                {t('retry')}
              </button>
            </div>
          )}

          {!loading && !error && templates.length === 0 && (
            <div className="text-center py-20">
              <BookOpen className="mx-auto h-12 w-12 text-pulse-500 dark:text-white/20 mb-4" />
              <p className="text-pulse-600 dark:text-[#8893AD]">{t('templates.noTemplates')}</p>
            </div>
          )}

          {!loading && !error && templates.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((tmpl) => (
                <TemplateCard key={tmpl.id} template={tmpl} lang={lang} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA section */}
      <section className="py-16 bg-pulse-50 dark:bg-[#0D1424]">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2
            className="font-bold text-3xl text-pulse-900 dark:text-[var(--text-primary)] mb-4"
            style={displayFont}
          >
            {t('templates.ctaHeading')}
          </h2>
          <p className="text-pulse-600 dark:text-[#8893AD] mb-8">
            {t('templates.ctaSubheading')}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl font-medium text-white text-sm transition-all duration-150 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            style={gradientBrand}
          >
            {t('templates.ctaButton')}
          </Link>
        </div>
      </section>
    </MainLayout>
  )
}
