import type { TeamMember } from './types'
import { RoleBadge } from './RoleBadge'

interface Props {
  members: TeamMember[]
  currentUserId: string
  isOwner: boolean
  ownerId: string
  removingId: string | null
  onRemove: (userId: string) => void
}

export function MembersSection({ members, currentUserId, isOwner, ownerId, removingId, onRemove }: Props) {
  return (
    <section aria-labelledby="section-members" className="space-y-4 rounded-xl border border-pulse-200 p-8">
      <h2 id="section-members" className="text-lg font-semibold">Members</h2>
      <ul className="divide-y divide-pulse-100" role="list">
        {members.map((member) => (
          <li key={member.userId} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {member.email}
                {member.userId === currentUserId ? (
                  <span className="ml-1 text-pulse-500 text-xs">(you)</span>
                ) : null}
              </p>
              <p className="text-xs text-pulse-500">
                Member since {new Date(member.joinedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <RoleBadge role={member.role} />
              {isOwner && member.userId !== currentUserId && member.userId !== ownerId ? (
                <button
                  type="button"
                  aria-label={`Remove ${member.email}`}
                  onClick={() => void onRemove(member.userId)}
                  disabled={removingId === member.userId}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-sm text-red-600 hover:text-red-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded disabled:opacity-50"
                >
                  {removingId === member.userId ? 'Removing…' : 'Remove'}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
