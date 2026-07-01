import { Badge, type BadgeTone } from '../../ui/components'
import type { Role } from './types'

/**
 * Team role → shared Badge tone. `owner` uses `brand` (teal) rather than the old
 * violet, which collided with violet's AI-accent meaning elsewhere
 * (DESIGN_SYSTEM_AUDIT_2026-07-01).
 */
const ROLE_TONE: Record<Role, BadgeTone> = {
  owner: 'brand',
  admin: 'info',
  member: 'neutral',
  viewer: 'neutral',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge tone={ROLE_TONE[role]} className="uppercase tracking-wider">
      {role}
    </Badge>
  )
}
