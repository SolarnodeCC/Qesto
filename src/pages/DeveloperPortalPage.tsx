/**
 * FE-DEV2-OAS-01 / FE-DEV2-TRY-02 — developer portal v2 (S73).
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'

type OpenApiSpec = {
  openapi?: string
  info?: { title?: string; version?: string }
  paths?: Record<string, unknown>
}

export default function DeveloperPortalPage() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/developer/openapi.json')
      .then((r) => r.json())
      .then((j) => setSpec(j as OpenApiSpec))
      .catch(() => setError('Failed to load OpenAPI spec'))
  }, [])

  const paths = spec?.paths ? Object.keys(spec.paths) : []

  return (
    <MainLayout>
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-pulse-900 dark:text-[#F0F2F8]">Developer portal</h1>
        <p className="mt-2 text-pulse-600 dark:text-[#9AA8C7]">
          Public API v3 explorer. Issue keys from{' '}
          <Link to="/dashboard" className="text-teal-600 dark:text-teal-400 underline">
            dashboard
          </Link>
          .
        </p>

        {error && (
          <p role="alert" className="mt-4 text-red-600">
            {error}
          </p>
        )}

        {spec && (
          <section className="mt-8 rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-6">
            <h2 className="text-lg font-semibold text-pulse-900 dark:text-[#F0F2F8]">
              {spec.info?.title ?? 'API'} · {spec.info?.version ?? 'v3'}
            </h2>
            <p className="mt-2 text-sm text-pulse-500 dark:text-[#6B7A99]">OpenAPI {spec.openapi}</p>
            <ul className="mt-4 space-y-2 font-mono text-sm text-pulse-700 dark:text-[#A8B3CC]">
              {paths.map((p) => (
                <li key={p} className="rounded bg-pulse-50 dark:bg-[#0F1525] px-3 py-2">
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-pulse-400 dark:text-[#6B7A99]">
              Try-it console: use API key in Authorization header against /api/v3/*
            </p>
          </section>
        )}
      </main>
    </MainLayout>
  )
}
