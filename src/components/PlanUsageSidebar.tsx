import { Link } from 'react-router-dom'
import { type QuotaUsage } from '../hooks/useQuotaUsage'
import { planBrandName } from '../config/plans'

// Brand names come from the shared source of truth (config/plans); colours are local.
const PLAN_DISPLAY: Record<string, { color: string; dot: string }> = {
  free:    { color: 'bg-pulse-100 text-pulse-700 border-pulse-200',    dot: 'bg-pulse-400' },
  starter: { color: 'bg-teal-50 text-teal-700 border-teal-200',       dot: 'bg-teal-500' },
  team:    { color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
}

// AI insight quota per plan (matches pricing page: 5/mo free, unlimited paid)
const AI_INSIGHTS_LIMIT: Record<string, number | null> = {
  free: 5,
  starter: null, // unlimited
  team: null,    // unlimited
}

interface Props {
  data: QuotaUsage
  loading?: boolean
}

function UsageBar({ used, limit, warn }: { used: number; limit: number; warn?: boolean }) {
  const pct = Math.min(100, limit > 0 ? Math.round((used / limit) * 100) : 0)
  const isHigh = pct >= 80
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-pulse-500 dark:text-[#8A96B0] tabular-nums">
          {used} / {limit}
        </span>
        <span className={`text-xs font-medium tabular-nums ${isHigh || warn ? 'text-amber-600 dark:text-amber-400' : 'text-pulse-500 dark:text-[#8A96B0]'}`}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-pulse-100 dark:bg-[#1C2540] overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            pct >= 100 ? 'bg-red-500' : isHigh ? 'bg-amber-500' : 'bg-teal-500'
          }`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={limit}
        />
      </div>
    </div>
  )
}

function FeatureRow({ label, value }: { label: string; value: boolean | string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-pulse-100 dark:border-[#1E2A45] last:border-0">
      <span className="text-xs text-pulse-600 dark:text-[#A8B3CC]">{label}</span>
      {typeof value === 'boolean' ? (
        value ? (
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-teal-500 shrink-0" aria-label="Included">
            <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-pulse-500 shrink-0" aria-label="Not included">
            <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
          </svg>
        )
      ) : (
        <span className="text-xs font-medium text-pulse-700 dark:text-[#F0F2F8]">{value}</span>
      )}
    </div>
  )
}

export default function PlanUsageSidebar({ data, loading }: Props) {
  const planInfo = PLAN_DISPLAY[data.plan] ?? PLAN_DISPLAY.free
  const aiLimit = AI_INSIGHTS_LIMIT[data.plan] ?? null
  const resetDate = new Date(data.reset_date)
  const daysLeft = Math.max(0, Math.ceil((resetDate.getTime() - Date.now()) / 86_400_000))
  const isUpgradeable = data.plan !== 'team'

  if (loading) {
    return (
      <aside className="space-y-3" aria-label="Plan usage loading">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-pulse-100 dark:bg-[#151C2E] skeleton-shimmer" aria-hidden="true" />
        ))}
      </aside>
    )
  }

  return (
    <aside aria-label="Subscription overview" className="space-y-4">
      {/* Plan badge + upgrade CTA */}
      <div className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${planInfo.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${planInfo.dot}`} aria-hidden="true" />
            {planBrandName(data.plan)}
          </div>
          {isUpgradeable && (
            <Link
              to="/pricing"
              className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 rounded"
            >
              Upgrade →
            </Link>
          )}
        </div>

        {/* Sessions this month */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-pulse-700 dark:text-[#A8B3CC] uppercase tracking-wide">Sessions / month</p>
            <span className="text-[10px] text-pulse-500">{daysLeft}d left</span>
          </div>
          {data.quotas.max_sessions_per_month >= 500 ? (
            <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">Unlimited</p>
          ) : (
            <UsageBar
              used={data.usage.sessions_created}
              limit={data.quotas.max_sessions_per_month}
              warn={data.usage.sessions_created >= data.quotas.max_sessions_per_month}
            />
          )}
          {data.usage.remaining === 0 && data.quotas.max_sessions_per_month < 500 && (
            <p className="text-[10px] text-red-600 font-medium">Quota reached — resets {resetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
          )}
        </div>

        {/* Participants per session */}
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-pulse-700 dark:text-[#A8B3CC] uppercase tracking-wide">Participants / session</p>
          <p className="text-xs text-pulse-600 dark:text-[#A8B3CC]">
            {data.quotas.max_participants_per_session >= 5000
              ? 'Unlimited'
              : `Up to ${data.quotas.max_participants_per_session.toLocaleString()}`}
          </p>
        </div>

        {/* AI insights */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-pulse-700 dark:text-[#A8B3CC] uppercase tracking-wide">AI insights / month</p>
          {aiLimit === null ? (
            <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">Unlimited</p>
          ) : data.quotas.features_unlocked.insightsAI ? (
            <UsageBar used={data.usage.insights_generated} limit={aiLimit} />
          ) : (
            <div className="space-y-1">
              <UsageBar used={data.usage.insights_generated} limit={aiLimit} />
              {data.usage.insights_generated >= aiLimit && (
                <p className="text-[10px] text-amber-600 font-medium">
                  Limit reached ·{' '}
                  <Link to="/pricing" className="underline hover:text-amber-700">Upgrade for unlimited</Link>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Feature matrix */}
      <div className="rounded-xl border border-pulse-200 dark:border-[#1E2A45] bg-white dark:bg-[#151C2E] p-4">
        <p className="text-xs font-semibold text-pulse-700 dark:text-[#A8B3CC] uppercase tracking-wide mb-2">Included features</p>
        <div>
          <FeatureRow label="Results export (CSV)" value={data.quotas.features_unlocked.resultsExport} />
          <FeatureRow label="AI evidence clusters" value={data.quotas.features_unlocked.semanticSearch} />
          <FeatureRow label="AI insights (full)" value={data.quotas.features_unlocked.insightsAI} />
          <FeatureRow label="Custom branding" value={data.quotas.features_unlocked.customBranding} />
          <FeatureRow label="Consent mode" value={data.quotas.features_unlocked.consentMode} />
          <FeatureRow label="Ranking questions" value={data.quotas.features_unlocked.rankingQuestions} />
          <FeatureRow label="SAML SSO" value={data.quotas.features_unlocked.samlSso} />
        </div>
      </div>

      {/* Reset date */}
      <p className="text-[10px] text-pulse-500 dark:text-[#8A96B0] text-center">
        Quota resets {resetDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
      </p>
    </aside>
  )
}
