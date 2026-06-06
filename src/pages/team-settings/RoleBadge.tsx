import type { Role } from './types'

const colours: Record<Role, string> = {
  owner: 'bg-violet-100 text-violet-700',
  admin: 'bg-teal-100 text-teal-700',
  member: 'bg-pulse-100 text-pulse-600',
  viewer: 'bg-pulse-100 text-pulse-500',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-block text-xs uppercase tracking-wider rounded-full px-2 py-0.5 ${colours[role]}`}
    >
      {role}
    </span>
  )
}
