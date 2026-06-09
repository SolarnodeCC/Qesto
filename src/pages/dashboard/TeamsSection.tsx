import { Link } from 'react-router-dom'
import { useT } from '../../i18n'
import type { DashboardTeam } from './types'

interface TeamsSectionProps {
  teams: DashboardTeam[]
  teamsLoading: boolean
}

export function TeamsSection({ teams, teamsLoading }: TeamsSectionProps) {
  const t = useT('dashboard')
  return (
    <section id="section-teams" aria-labelledby="teams-heading">
      <h2 id="teams-heading" className="text-xl font-semibold text-pulse-900 dark:text-[#F0F2F8] mb-4">
        {t('teams')}
      </h2>
      {teamsLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-pulse-200 dark:bg-pulse-800 skeleton-shimmer" aria-hidden="true" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <p className="text-sm text-pulse-500 dark:text-[#A8B3CC]">{t('noTeamsYet')}</p>
      ) : (
        <ul className="divide-y divide-pulse-200 dark:divide-[#1E2A45] rounded-xl border border-pulse-200 dark:border-[#1E2A45]">
          {teams.map((team) => (
            <li key={team.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium text-pulse-800 dark:text-[#F0F2F8]">{team.name}</p>
                <p className="text-xs text-pulse-400 dark:text-[#6B7A99] mt-0.5 capitalize">{team.plan} plan</p>
              </div>
              <Link
                to={`/teams/${team.id}/settings`}
                className="text-sm text-teal-600 dark:text-teal-400 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:focus-visible:ring-teal-400 focus-visible:ring-offset-2 rounded"
              >
                Settings →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
