import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Clock, Users, BookOpen, ArrowLeft, Check, Mail } from 'lucide-react'
import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'
import { api } from '../api/client'
import { useT } from '../i18n'
import { generateOgImageUrl } from '../utils/og-image-generator'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }

type Lang = 'nl' | 'en' | 'de' | 'fr'
const PIPELINE_LANGS: Lang[] = ['nl', 'en', 'de', 'fr']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface TemplateRecord {
  id: string
  title: Record<Lang, string>
  purpose: Record<Lang, string>
  bestUsedFor: Record<Lang, string[]>
  estimatedMinutes: number
  whatYoullLearn: Record<Lang, string[]>
  questions: { id: string; text: Record<Lang, string>; type: string }[]
  industry: string
  theme: string
  topic: string
  usageCount: number
  createdAt: string
  updatedAt: string
}

type UseState =
  | { status: 'idle' | 'sending' }
  | { status: 'sent'; email: string }

/**
 * Email-capture form for "use this template" (MKTP-002). Submitting emails the
 * visitor a one-time link that creates a real session and signs them in.
 */
function UseTemplateForm({
  templateId,
  variant,
}: {
  templateId: string
  variant: 'card' | 'inline'
}) {
  const t = useT('common')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<UseState>({ status: 'idle' })
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError(t('templates.emailInvalid'))
      return
    }
    setError(null)
    setState({ status: 'sending' })
    const result = await api<{ sent: boolean }>(`/api/gallery/${templateId}/use`, {
      method: 'POST',
      body: { email: trimmed },
    })
    if (result.ok) {
      setState({ status: 'sent', email: trimmed })
    } else {
      setError(result.error.message)
      setState({ status: 'idle' })
    }
  }

  if (state.status === 'sent') {
    return (
      <div className={variant === 'card' ? 'text-center' : 'mx-auto max-w-md text-center'}>
        <span
          className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full"
          style={gradientBrand}
        >
          <Mail className="h-5 w-5 text-white" />
        </span>
        <h3 className="font-semibold text-base text-pulse-900 dark:text-[#F0F2F8] mb-1">
          {t('templates.checkEmailTitle')}
        </h3>
        <p className="text-sm text-pulse-600 dark:text-[#8893AD]">
          {t('templates.checkEmailDescription', { email: state.email })}
        </p>
        <button
          onClick={() => { setState({ status: 'idle' }); setEmail('') }}
          className="mt-3 text-sm text-teal-600 dark:text-teal-400 underline underline-offset-2"
        >
          {t('templates.checkEmailResend')}
        </button>
      </div>
    )
  }

  const sending = state.status === 'sending'
  return (
    <form onSubmit={submit} className={variant === 'inline' ? 'mx-auto flex max-w-md flex-col gap-3 sm:flex-row' : 'flex flex-col gap-3'}>
      <div className="flex-1">
        <label htmlFor={`use-email-${variant}`} className="sr-only">
          {t('templates.emailLabel')}
        </label>
        <input
          id={`use-email-${variant}`}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('templates.emailPlaceholder')}
          aria-invalid={!!error}
          aria-describedby={error ? `use-email-err-${variant}` : undefined}
          className="w-full rounded-lg border border-pulse-200 dark:border-white/20 bg-white dark:bg-[#0A0F1E] px-3 py-2.5 text-sm text-pulse-900 dark:text-[#F0F2F8] focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        {error && (
          <p id={`use-email-err-${variant}`} className="mt-1.5 text-left text-xs text-red-500">
            {error}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={sending}
        className="flex items-center justify-center px-6 py-2.5 rounded-lg font-medium text-white text-sm transition-all hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 disabled:cursor-not-allowed"
        style={gradientBrand}
      >
        {sending ? t('templates.sending') : t('templates.sendSessionLink')}
      </button>
    </form>
  )
}

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>()
  const t = useT('common')
  const rawLang = (document.documentElement.lang?.slice(0, 2) as Lang) || 'en'
  const lang: Lang = PIPELINE_LANGS.includes(rawLang) ? rawLang : 'en'

  const [template, setTemplate] = useState<TemplateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api<TemplateRecord>(`/api/gallery/${id}`)
      .then((result) => {
        if (result.ok) setTemplate(result.data)
        else setError(result.error.message)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-pulse text-pulse-500 dark:text-white/30">{t('loading')}</div>
        </div>
      </MainLayout>
    )
  }

  if (error || !template) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <p className="text-pulse-600 dark:text-[#8893AD]">{error || t('error')}</p>
          <Link to="/templates" className="text-sm text-teal-600 dark:text-teal-400 underline">
            {t('templates.backToGallery')}
          </Link>
        </div>
      </MainLayout>
    )
  }

  const title = template.title[lang] || template.title.en
  const purpose = template.purpose[lang] || template.purpose.en
  const bestUsedFor = template.bestUsedFor[lang] || template.bestUsedFor.en || []
  const whatYoullLearn = template.whatYoullLearn[lang] || template.whatYoullLearn.en || []

  // SEO: Structured data
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Templates',
        item: 'https://qesto.cc/templates',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: title,
        item: `https://qesto.cc/templates/${template.id}`,
      },
    ],
  }

  const creativeWork = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: title,
    description: purpose,
    keywords: `${template.industry}, ${template.theme}, ${template.topic}, template, session`,
    about: {
      '@type': 'Thing',
      name: template.industry.replace(/-/g, ' '),
    },
    author: {
      '@type': 'Organization',
      name: 'Qesto',
    },
    datePublished: template.createdAt,
    dateModified: template.updatedAt,
    inLanguage: lang,
    potentialAction: {
      '@type': 'UseAction',
      name: 'Use Template',
    },
  }

  const ogImage = generateOgImageUrl({
    title,
    subtitle: purpose,
    industry: template.industry,
    theme: template.theme,
  })

  return (
    <MainLayout>
      <PageSeo
        title={`${title} — Qesto Template`}
        description={purpose}
        canonicalPath={`/templates/${template.id}`}
        ogImage={ogImage}
        jsonLd={[breadcrumb, creativeWork]}
      />

      {/* Back nav */}
      <div className="border-b border-pulse-100 dark:border-white/10 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-8 py-3">
          <Link
            to="/templates"
            className="inline-flex items-center gap-1.5 text-sm text-pulse-600 dark:text-[#8893AD] hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('templates.backToGallery')}
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="py-14 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-24 items-start">
            {/* Left: Content */}
            <div className="lg:col-span-2">
              <span className="inline-block mb-3 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                {template.industry.replace(/-/g, ' ')}
              </span>
              <h1
                className="font-bold text-4xl text-pulse-900 dark:text-[#F0F2F8] mb-4"
                style={displayFont}
                tabIndex={-1}
              >
                {title}
              </h1>
              <p className="text-lg text-pulse-600 dark:text-[#8893AD] mb-12">{purpose}</p>

              {/* Meta row */}
              <div className="flex flex-wrap gap-6 text-sm text-pulse-600 dark:text-[#8893AD] mb-16">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-teal-500" />
                  {template.questions.length} {t('templates.questions')}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-teal-500" />
                  {template.estimatedMinutes} min
                </span>
                {template.usageCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-teal-500" />
                    {t('templates.usedByCount', { count: template.usageCount })}
                  </span>
                )}
              </div>

              {/* Best used for */}
              {bestUsedFor.length > 0 && (
                <div className="mb-12">
                  <h2 className="font-semibold text-base text-pulse-900 dark:text-[#F0F2F8] mb-3">
                    {t('templates.bestUsedFor')}
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {bestUsedFor.map((use, i) => (
                      <li
                        key={i}
                        className="px-3 py-1.5 rounded-full text-sm bg-pulse-50 dark:bg-white/5 text-pulse-700 dark:text-[#8893AD] border border-pulse-200 dark:border-white/10"
                      >
                        {use}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What you'll learn */}
              {whatYoullLearn.length > 0 && (
                <div className="mb-12">
                  <h2 className="font-semibold text-base text-pulse-900 dark:text-[#F0F2F8] mb-3">
                    {t('templates.whatYoullLearn')}
                  </h2>
                  <ul className="space-y-2">
                    {whatYoullLearn.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-pulse-600 dark:text-[#8893AD]">
                        <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full flex items-center justify-center" style={gradientBrand}>
                          <Check className="h-2.5 w-2.5 text-white" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Right: CTA card */}
            <div className="lg:sticky lg:top-24">
              <div
                className="rounded-2xl bg-white dark:bg-[#111827] border border-pulse-100 dark:border-white/10 p-8"
                style={shadowCard}
              >
                <div className="h-1 -mx-8 -mt-8 rounded-t-2xl mb-6" style={gradientBrand} />

                <p className="text-sm text-pulse-600 dark:text-[#8893AD] mb-6">
                  {t('templates.ctaCardDescription')}
                </p>

                <UseTemplateForm templateId={template.id} variant="card" />

                <p className="mt-3 text-xs text-center text-pulse-500 dark:text-white/30">
                  {t('templates.noAccountNeeded')}
                </p>

                <hr className="my-6 border-pulse-100 dark:border-white/10" />

                <p className="text-xs text-pulse-500 dark:text-[#8893AD] text-center">
                  {t('templates.wantToCustomize')}{' '}
                  <Link to="/login" className="text-teal-600 dark:text-teal-400 underline">
                    {t('login')}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Questions preview */}
      <section className="py-24 bg-pulse-50 dark:bg-[#0D1424]">
        <div className="max-w-6xl mx-auto px-8">
          <h2
            className="font-bold text-2xl text-pulse-900 dark:text-[#F0F2F8] mb-8"
            style={displayFont}
          >
            {t('templates.questionsPreview')} ({template.questions.length})
          </h2>
          <div className="space-y-3">
            {template.questions.map((q, idx) => (
              <div
                key={q.id}
                className="flex items-start gap-4 p-4 rounded-xl bg-white dark:bg-[#111827] border border-pulse-100 dark:border-white/10"
                style={shadowCard}
              >
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={gradientBrand}>
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-pulse-900 dark:text-[#F0F2F8]">
                    {q.text[lang] || q.text.en}
                  </p>
                  <span className="text-xs text-pulse-500 dark:text-white/30 capitalize">{q.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-14 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-xl mx-auto px-8 text-center">
          <h2
            className="font-bold text-2xl text-pulse-900 dark:text-[#F0F2F8] mb-3"
            style={displayFont}
          >
            {t('templates.readyToStart')}
          </h2>
          <p className="text-pulse-600 dark:text-[#8893AD] mb-8">
            {t('templates.readyToStartDescription')}
          </p>
          <UseTemplateForm templateId={template.id} variant="inline" />
        </div>
      </section>
    </MainLayout>
  )
}
