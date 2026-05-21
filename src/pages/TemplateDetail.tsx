import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Clock, Users, BookOpen, ArrowLeft, Copy, Check, ExternalLink } from 'lucide-react'
import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'
import { api } from '../api/client'
import { useT } from '../i18n'

const gradientBrand = { background: 'linear-gradient(135deg, #14B8A6 0%, #8B5CF6 100%)' }
const displayFont = { fontFamily: 'var(--font-family-display)' }
const shadowCard = { boxShadow: 'var(--shadow-card)' }
const shadowElevated = { boxShadow: 'var(--shadow-elevated)' }

type Lang = 'nl' | 'en' | 'de' | 'fr'

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
}

function MagicLinkPanel({ link, onClose }: { link: string; onClose: () => void }) {
  const t = useT('common')
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] p-6"
        style={shadowElevated}
      >
        <h2 className="font-bold text-xl text-pulse-900 dark:text-[#F0F2F8] mb-2" style={displayFont}>
          {t('templates.magicLinkTitle')}
        </h2>
        <p className="text-sm text-pulse-600 dark:text-[#8893AD] mb-5">
          {t('templates.magicLinkDescription')}
        </p>

        {/* Link display */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-pulse-50 dark:bg-white/5 border border-pulse-200 dark:border-white/10 mb-4">
          <span className="flex-1 text-sm text-pulse-700 dark:text-[#8893AD] truncate font-mono">
            {link}
          </span>
          <button
            onClick={copyLink}
            className="shrink-0 p-2 rounded-lg text-pulse-600 dark:text-[#8893AD] hover:bg-pulse-100 dark:hover:bg-white/10 transition-colors"
            aria-label={copied ? t('copied') : t('copyLink')}
          >
            {copied ? <Check className="h-4 w-4 text-teal-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:scale-[1.01]"
            style={gradientBrand}
          >
            {t('templates.openSession')}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-pulse-700 dark:text-[#8893AD] border border-pulse-200 dark:border-white/20 hover:bg-pulse-50 dark:hover:bg-white/5 transition-colors"
          >
            {t('close')}
          </button>
        </div>

        <p className="mt-4 text-xs text-pulse-400 dark:text-white/30 text-center">
          {t('templates.magicLinkExpiry')}
        </p>
      </div>
    </div>
  )
}

export default function TemplateDetail() {
  const { id } = useParams<{ id: string }>()
  const t = useT('common')
  const lang: Lang = (document.documentElement.lang?.slice(0, 2) as Lang) || 'en'

  const [template, setTemplate] = useState<TemplateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [using, setUsing] = useState(false)
  const [magicLink, setMagicLink] = useState<string | null>(null)

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

  async function handleUseTemplate() {
    if (!id) return
    setUsing(true)
    const result = await api<{ sessionId: string; magicLink: string; expiresIn: number }>(
      `/api/gallery/${id}/use`,
      { method: 'POST' }
    )
    if (result.ok) {
      setMagicLink(result.data.magicLink)
    } else {
      setError(result.error.message)
    }
    setUsing(false)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="animate-pulse text-pulse-400 dark:text-white/30">{t('loading')}</div>
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

  return (
    <MainLayout>
      <PageSeo
        title={`${title} — Qesto Template`}
        description={purpose}
        canonicalPath={`/templates/${template.id}`}
      />

      {magicLink && (
        <MagicLinkPanel link={magicLink} onClose={() => setMagicLink(null)} />
      )}

      {/* Back nav */}
      <div className="border-b border-pulse-100 dark:border-white/10 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-6xl mx-auto px-6 py-3">
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
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
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
              <p className="text-lg text-pulse-600 dark:text-[#8893AD] mb-8">{purpose}</p>

              {/* Meta row */}
              <div className="flex flex-wrap gap-5 text-sm text-pulse-600 dark:text-[#8893AD] mb-10">
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
                <div className="mb-8">
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
                <div className="mb-8">
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
                className="rounded-2xl bg-white dark:bg-[#111827] border border-pulse-100 dark:border-white/10 p-6"
                style={shadowCard}
              >
                <div className="h-1 -mx-6 -mt-6 rounded-t-2xl mb-5" style={gradientBrand} />

                <p className="text-sm text-pulse-600 dark:text-[#8893AD] mb-5">
                  {t('templates.ctaCardDescription')}
                </p>

                <button
                  onClick={handleUseTemplate}
                  disabled={using}
                  className="w-full flex items-center justify-center px-6 py-3 rounded-xl font-medium text-white text-sm transition-all hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={gradientBrand}
                >
                  {using ? t('templates.creating') : t('templates.useTemplate')}
                </button>

                <p className="mt-3 text-xs text-center text-pulse-400 dark:text-white/30">
                  {t('templates.noAccountNeeded')}
                </p>

                <hr className="my-5 border-pulse-100 dark:border-white/10" />

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
      <section className="py-12 bg-pulse-50 dark:bg-[#0D1424]">
        <div className="max-w-6xl mx-auto px-6">
          <h2
            className="font-bold text-2xl text-pulse-900 dark:text-[#F0F2F8] mb-6"
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
                  <span className="text-xs text-pulse-400 dark:text-white/30 capitalize">{q.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-14 bg-white dark:bg-[#0A0F1E]">
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2
            className="font-bold text-2xl text-pulse-900 dark:text-[#F0F2F8] mb-3"
            style={displayFont}
          >
            {t('templates.readyToStart')}
          </h2>
          <p className="text-pulse-600 dark:text-[#8893AD] mb-6">
            {t('templates.readyToStartDescription')}
          </p>
          <button
            onClick={handleUseTemplate}
            disabled={using}
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl font-medium text-white text-sm transition-all hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60"
            style={gradientBrand}
          >
            {using ? t('templates.creating') : t('templates.useTemplate')}
          </button>
        </div>
      </section>
    </MainLayout>
  )
}
