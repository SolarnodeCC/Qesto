import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import PageSeo from '../components/PageSeo'
import { useT } from '../i18n'
import { inputHint } from '../ui/input-hint'

type MarketplaceApp = {
  id: string
  name: string
  partner: string
  description: string
  scopes: string[]
  badge?: 'beta' | 'ga'
}

export default function MarketplacePage() {
  const t = useT('common')
  const [apps, setApps] = useState<MarketplaceApp[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''
    fetch(`/api/marketplace/apps${params}`)
      .then((r) => r.json() as Promise<{ ok?: boolean; data?: { apps: MarketplaceApp[] } }>)
      .then((json) => {
        if (json.ok && json.data) setApps(json.data.apps)
      })
      .finally(() => setLoading(false))
  }, [query])

  return (
    <MainLayout>
      <PageSeo
        title={t('marketplace.seoTitle')}
        description={t('marketplace.seoDescription')}
        canonicalPath="/marketplace"
      />
      <div className="max-w-4xl mx-auto px-6 py-16">
        <p className="text-sm font-medium text-teal-700 dark:text-teal-400 uppercase tracking-wide">
          {t('marketplace.eyebrow')}
        </p>
        <h1 tabIndex={-1} className="text-4xl font-bold tracking-tight text-pulse-900 dark:text-[#F0F2F8] mt-2">
          {t('marketplace.title')}
        </h1>
        <p className="mt-4 text-lg text-pulse-600 dark:text-[#9AA8C7]">{t('marketplace.subtitle')}</p>

        <label className="mt-8 block">
          <span className="sr-only">{t('marketplace.searchLabel')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setLoading(true)
              setQuery(e.target.value)
            }}
            {...inputHint(t('marketplace.searchPlaceholder'))}
            className="w-full rounded-lg border border-pulse-200 px-4 py-3 text-sm dark:border-[#2A3858] dark:bg-[#1C2540] dark:text-[#F0F2F8]"
          />
        </label>

        {loading ? (
          <p className="mt-8 text-sm text-pulse-500" role="status">
            {t('marketplace.loading')}
          </p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {apps.map((app) => (
              <li
                key={app.id}
                className="rounded-xl border border-pulse-200 p-5 dark:border-[#2A3858] dark:bg-[#1C2540]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-pulse-900 dark:text-[#F0F2F8]">{app.name}</h2>
                  {app.badge && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                      {app.badge}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-pulse-600 dark:text-[#9AA8C7]">{app.description}</p>
                <p className="mt-3 text-xs text-pulse-500 capitalize">{app.partner}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-12 text-sm text-pulse-500">
          <Link to="/partner/sla" className="text-teal-600 hover:underline">
            {t('marketplace.slaLink')}
          </Link>
          {' · '}
          <Link to="/login" className="text-teal-600 hover:underline">
            {t('marketplace.buildLink')}
          </Link>
        </p>
      </div>
    </MainLayout>
  )
}
