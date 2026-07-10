import { useState } from 'react'
import { useAdminAnalyticsAdvanced, type AnalyticsWindow } from '../../hooks/useAdminAnalyticsAdvanced'
import { Heading, Body, Caption, Button, Card } from '../../ui/components'

// Platformbeheer Module 5 — funnel, costs, retention. One window selector drives
// every widget (AC); each dataset has a CSV export (AC).

const WINDOWS: AnalyticsWindow[] = ['7d', '30d', '90d']

function fmtCents(c: number) {
  return `€${(c / 100).toFixed(2)}`
}

export default function AnalyticsAdvancedPanel() {
  const [window, setWindow] = useState<AnalyticsWindow>('30d')
  const { funnel, costs, cohorts, loading, error, exportCsv } = useAdminAnalyticsAdvanced(window)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Heading level="l">Business &amp; product analytics</Heading>
        <div role="group" aria-label="Time window" className="flex gap-1 rounded-lg bg-pulse-100 dark:bg-[#0F1526] p-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWindow(w)}
              aria-pressed={window === w}
              className={[
                'px-3 py-1 text-xs font-medium rounded-md min-h-[36px]',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
                window === w
                  ? 'bg-white dark:bg-[#1C2540] text-pulse-900 dark:text-[#F0F2F8] shadow-sm'
                  : 'text-pulse-500 dark:text-[#8A96B0]',
              ].join(' ')}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {error && <Body size="s" className="text-red-600">{error}</Body>}

      {/* Funnel */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Heading level="m" className="border-l-4 border-teal-500 pl-3">Conversion funnel</Heading>
          <Button variant="secondary" size="sm" onClick={() => exportCsv('funnel')}>Export CSV</Button>
        </div>
        <Card className="space-y-3">
          {funnel.map((step, i) => (
            <div key={step.key} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-pulse-800 dark:text-[#A8B3CC]">{step.label}</span>
                <span className="font-semibold text-pulse-900 dark:text-[#F0F2F8]">
                  {step.count}
                  {i > 0 && <span className="text-pulse-400 font-normal"> · {step.conversion_from_prev_pct}% from prev · {step.drop_off_pct}% drop</span>}
                </span>
              </div>
              <div className="h-2 rounded bg-pulse-100 dark:bg-[#0F1526] overflow-hidden">
                <div className="h-full bg-teal-500" style={{ width: `${step.conversion_from_top_pct}%` }} />
              </div>
            </div>
          ))}
          {!loading && funnel.length === 0 && <Body size="s" className="text-pulse-500">No funnel data in range.</Body>}
        </Card>
      </section>

      {/* Costs */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Heading level="m" className="border-l-4 border-teal-500 pl-3">Costs</Heading>
          <Button variant="secondary" size="sm" onClick={() => exportCsv('costs')}>Export CSV</Button>
        </div>
        <Card className="space-y-1">
          {costs ? (
            <>
              <div className="flex justify-between text-sm"><span className="text-pulse-600 dark:text-[#8A96B0]">Workers AI requests</span><span>{costs.workers_ai.requests}</span></div>
              <div className="flex justify-between text-sm"><span className="text-pulse-600 dark:text-[#8A96B0]">Est. tokens</span><span>{costs.workers_ai.est_tokens.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-pulse-600 dark:text-[#8A96B0]">Est. AI cost</span><span className="font-semibold">{fmtCents(costs.workers_ai.est_cost_cents)}{costs.workers_ai.is_estimate ? ' (est.)' : ''}</span></div>
              <Caption className="text-pulse-400 dark:text-[#5A6788]">{costs.cloudflare_billing.note}</Caption>
            </>
          ) : (
            <Body size="s" className="text-pulse-500">Loading…</Body>
          )}
        </Card>
      </section>

      {/* Retention */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Heading level="m" className="border-l-4 border-teal-500 pl-3">Retention — weekly signup cohorts</Heading>
          <Button variant="secondary" size="sm" onClick={() => exportCsv('retention')}>Export CSV</Button>
        </div>
        <Card className="overflow-x-auto">
          {cohorts.length === 0 ? (
            <Body size="s" className="text-pulse-500">No cohort data in range.</Body>
          ) : (
            <table className="w-full text-body-s">
              <thead>
                <tr className="border-b border-pulse-200 dark:border-[#1E2A45] text-pulse-600 dark:text-[#8A96B0]">
                  <th className="text-left py-2 px-2 font-medium">Cohort week</th>
                  <th className="text-right py-2 px-2 font-medium">Signups</th>
                  <th className="text-right py-2 px-2 font-medium">Activated</th>
                  <th className="text-right py-2 px-2 font-medium">Activation %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pulse-100 dark:divide-[#1E2A45]">
                {cohorts.map((co) => (
                  <tr key={co.cohort_week}>
                    <td className="py-2 px-2 font-mono text-xs">{co.cohort_week}</td>
                    <td className="text-right py-2 px-2">{co.signups}</td>
                    <td className="text-right py-2 px-2">{co.activated}</td>
                    <td className="text-right py-2 px-2 font-medium">{co.activation_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Caption className="text-pulse-400 dark:text-[#5A6788]">
          SEO (Search Console) and LinkedIn reach/engagement require external-API importers — surfaced as deferred in their endpoints.
        </Caption>
      </section>
    </div>
  )
}
