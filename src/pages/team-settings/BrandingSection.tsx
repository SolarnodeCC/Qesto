// jankurai:allow HLT-006-DIRECT-DB-WRONG-LAYER reason=react-ui-layer-no-d1-access expires=2027-06-01
import { api } from '../../api/client'
import type { Team } from './types'

interface Props {
  team: Team
  teamId: string
  brandingDescription: string
  onTeamUpdate: (team: Team) => void
}

export function BrandingSection({ team, teamId, brandingDescription, onTeamUpdate }: Props) {
  return (
    <section aria-labelledby="section-branding" className="space-y-4 rounded-xl border border-pulse-200 p-6">
      <h2 id="section-branding" className="text-lg font-semibold">Branding</h2>
      <p className="text-sm text-pulse-500">{brandingDescription}</p>
      <form
        className="grid gap-3 max-w-md"
        onSubmit={async (e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          const res = await api<{ team: Team }>(`/api/teams/${encodeURIComponent(teamId)}`, {
            method: 'PATCH',
            body: JSON.stringify({
              branding: {
                logoUrl: (fd.get('logoUrl') as string) || undefined,
                primaryColor: (fd.get('primaryColor') as string) || undefined,
                secondaryColor: (fd.get('secondaryColor') as string) || undefined,
              },
            }),
          })
          if (res.ok) onTeamUpdate(res.data.team)
        }}
      >
        <label className="text-sm font-medium text-pulse-700 dark:text-[#A8B3CC]">
          Logo URL
          <input
            name="logoUrl"
            type="url"
            defaultValue={team.branding?.logoUrl ?? ''}
            className="mt-1 w-full border border-pulse-300 rounded-lg px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-pulse-700 dark:text-[#A8B3CC]">
          Primary color
          <input
            name="primaryColor"
            type="text"
            pattern="#[0-9A-Fa-f]{6}"
            defaultValue={team.branding?.primaryColor ?? '#0D9488'}
            className="mt-1 w-full border border-pulse-300 rounded-lg px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="text-sm font-medium text-pulse-700 dark:text-[#A8B3CC]">
          Secondary color
          <input
            name="secondaryColor"
            type="text"
            pattern="#[0-9A-Fa-f]{6}"
            defaultValue={team.branding?.secondaryColor ?? '#8B5CF6'}
            className="mt-1 w-full border border-pulse-300 rounded-lg px-3 py-2 text-sm font-mono"
          />
        </label>
        <button
          type="submit"
          className="self-start min-h-[44px] rounded-lg bg-teal-600 text-white px-4 py-2 text-sm font-medium hover:bg-teal-700"
        >
          Save branding
        </button>
      </form>
    </section>
  )
}
