import { useState } from 'react'
import {
  type MetricState,
  type ObservabilityWindow,
  type RouteMetric,
  useAdminObservability,
  useAdminWaf,
} from '../../hooks/useAdminObservability'
import { Heading, Body, Caption, Card, SkeletonCard } from '../../ui/components'

// Platformbeheer Module 2 — near-realtime diagnostic board. Window-scoped
// (1h/24h/7d), threshold-driven green/orange/red, with a dedicated
// crawler-block monitor for the WAF/bot-protection signal.

const STATE_STYLE: Record<MetricState, { dot: string; text: string }> = {
  ok: { dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400' },
  warn: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  crit: { dot: 'bg-red-500', text: 'text-red-700 dark:text-red-400' },
}

const WINDOWS: ObservabilityWindow[] = ['1h', '24h', '7d']

function StateDot({ state }: { state: MetricState }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${STATE_STYLE[state].dot}`} aria-label={state} />
}

function RouteTable({ rows, emptyLabel }: { rows: RouteMetric[]; emptyLabel: string }) {
  if (rows.length === 0) {
    return <Body size="s" className="text-pulse-500 dark:text-[#8A96B0]">{emptyLabel}</Body>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-body-s">
        <thead>
          <tr className="border-b border-pulse-200 dark:border-[#1E2A45] text-pulse-600 dark:text-[#8A96B0]">
            <th className="text-left py-2 px-2 font-medium" />
            <th className="text-left py-2 px-2 font-medium">Route</th>
            <th className="text-right py-2 px-2 font-medium">req/min</th>
            <th className="text-right py-2 px-2 font-medium">err%</th>
            <th className="text-right py-2 px-2 font-medium">p50</th>
            <th className="text-right py-2 px-2 font-medium">p95</th>
            <th className="text-right py-2 px-2 font-medium">p99</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-pulse-100 dark:divide-[#1E2A45]">
          {rows.map((r) => (
            <tr key={r.route} className="hover:bg-pulse-50 dark:hover:bg-[#0F1526]">
              <td className="py-2 px-2"><StateDot state={r.state} /></td>
              <td className="py-2 px-2 font-mono text-xs text-pulse-700 dark:text-[#A8B3CC]">{r.route}</td>
              <td className="text-right py-2 px-2">{r.requests_per_min.toFixed(1)}</td>
              <td className={`text-right py-2 px-2 ${STATE_STYLE[r.state].text}`}>{(r.error_rate * 100).toFixed(1)}%</td>
              <td className="text-right py-2 px-2">{r.p50_ms}ms</td>
              <td className="text-right py-2 px-2 font-medium">{r.p95_ms}ms</td>
              <td className="text-right py-2 px-2">{r.p99_ms}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ComponentHeader({ title, state, synthetic }: { title: string; state: MetricState; synthetic?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <StateDot state={state} />
      <Heading level="m" className="border-l-4 border-teal-500 pl-3">{title}</Heading>
      {synthetic && <span className="text-xs px-2 py-0.5 rounded bg-pulse-100 dark:bg-[#1C2540] text-pulse-500 dark:text-[#8A96B0]">no data</span>}
    </div>
  )
}

export default function ObservabilityPanel() {
  const [window, setWindow] = useState<ObservabilityWindow>('24h')
  const { snapshot, loading, error } = useAdminObservability(window)
  const { waf } = useAdminWaf(window)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Heading level="l">Realtime observability</Heading>
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

      {/* WAF / crawler-block monitor — surfaced first because a legit-crawler
          block is the highest-signal, lowest-frequency event. */}
      {waf && waf.legit_crawler_block_count > 0 && (
        <Card className="border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <Body className="text-signal-error font-semibold">
            ⚠ {waf.legit_crawler_block_count} legitimate crawler block(s) detected — search engines may be unable to index the site.
          </Body>
          <div className="mt-2 space-y-1">
            {waf.legit_crawler_blocks.slice(0, 8).map((b) => (
              <div key={b.id} className="text-xs text-red-700 dark:text-red-400 font-mono">
                {new Date(b.ts).toLocaleString()} · {b.crawler_class} · {b.rule_id ?? 'rule?'} · {b.path ?? '/'}
              </div>
            ))}
          </div>
        </Card>
      )}

      {loading && !snapshot ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error && !snapshot ? (
        <Card className="border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <Body className="text-signal-error">Could not load observability snapshot: {error}</Body>
        </Card>
      ) : snapshot ? (
        <>
          {snapshot.degraded_sources.length > 0 && (
            <Card className="border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
              <Body size="s" className="text-amber-700 dark:text-amber-400">
                Degraded — sources unavailable: {snapshot.degraded_sources.join(', ')}.
              </Body>
            </Card>
          )}

          <section className="space-y-3">
            <ComponentHeader title="Workers (per route)" state={snapshot.components.workers.state} />
            <Caption className="text-pulse-500 dark:text-[#8A96B0]">{snapshot.components.workers.note}</Caption>
            <Card><RouteTable rows={snapshot.components.workers.routes} emptyLabel="No route metrics in window." /></Card>
          </section>

          <section className="space-y-3">
            <ComponentHeader title={`D1 (${snapshot.components.d1.slow_count} slow spans)`} state={snapshot.components.d1.state} synthetic={snapshot.components.d1.synthetic} />
            <Card><RouteTable rows={snapshot.components.d1.spans} emptyLabel="No D1 span metrics — instrument with recordSpan('d1.*')." /></Card>
          </section>

          <section className="space-y-3">
            <ComponentHeader title="Workers AI" state={snapshot.components.workers_ai.state} synthetic={snapshot.components.workers_ai.synthetic} />
            <Card><RouteTable rows={snapshot.components.workers_ai.spans} emptyLabel="No AI span metrics in window." /></Card>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="space-y-1">
              <ComponentHeader title="Durable Objects" state={snapshot.components.durable_objects.state} synthetic={snapshot.components.durable_objects.synthetic} />
              <Body size="s" className="text-pulse-600 dark:text-[#A8B3CC]">{snapshot.components.durable_objects.active_instances} active instances</Body>
              <Caption className="text-pulse-400 dark:text-[#5A6788]">Throughput / hibernation events via Analytics Engine — not yet wired.</Caption>
            </Card>
            <Card className="space-y-1">
              <ComponentHeader title="Vectorize" state={snapshot.components.vectorize.state} synthetic={snapshot.components.vectorize.synthetic} />
              {snapshot.components.vectorize.indexes.map((ix) => (
                <Body key={ix.name} size="s" className="text-pulse-600 dark:text-[#A8B3CC] font-mono text-xs">
                  {ix.name}: {ix.count ?? '?'} vectors / {ix.dimensions ?? '?'}d
                </Body>
              ))}
              {snapshot.components.vectorize.query_latency_ms !== null && (
                <Caption className="text-pulse-400 dark:text-[#5A6788]">describe() latency: {snapshot.components.vectorize.query_latency_ms}ms</Caption>
              )}
            </Card>
          </div>

          <Card className="space-y-1">
            <Heading level="m" className="border-l-4 border-pulse-400 pl-3">KV</Heading>
            <Caption className="text-pulse-500 dark:text-[#8A96B0]">{snapshot.components.kv.note}</Caption>
          </Card>

          <Caption className="text-pulse-400 dark:text-[#5A6788]">
            Generated {new Date(snapshot.generated_at).toLocaleTimeString()} · window {snapshot.window}
          </Caption>
        </>
      ) : null}
    </div>
  )
}
