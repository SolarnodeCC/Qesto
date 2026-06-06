// CODE-SPLIT — team KV / D1 store + membership helpers + cross-domain service
// functions (no behavior change). Teams live in TEAMS_KV as `team:{id}` → JSON
// blob, and membership is mirrored in D1's `user_roles` table so the shared RBAC
// middleware (middleware/rbac.ts) can answer per-request permission checks.
//
// KV shape (TEAMS_KV):
//   team:{teamId}        → Team JSON blob (see Team type)
//   user-teams:{userId}  → string[] of teamIds for reverse lookup (GET /teams)
//   team-invite:{token}  → { teamId, email, role, createdAt } (1-day TTL)
import { ulid } from '../../lib/ulid'
import { readKvJson, writeKvJson } from '../../lib/kv'
import { validateKvJson, TeamInviteTokenSchema } from '../../lib/protocol-schemas'
import { teamDocumentKey, teamInviteKey, userTeamsIndexKey } from '../../lib/kv-keys'
import type { Role, Team, TeamMember } from './types'
import { absent } from '../../lib/absent'

// ─── KV helpers ──────────────────────────────────────────────────────────────

export async function loadTeam(kv: KVNamespace, id: string): Promise<Team | null> {
  return readKvJson<Team>(kv, teamDocumentKey(id))
}

export async function saveTeam(kv: KVNamespace, team: Team): Promise<void> {
  await writeKvJson(kv, teamDocumentKey(team.id), team)
}

export async function loadUserTeamIds(kv: KVNamespace, userId: string): Promise<string[]> {
  return (await readKvJson<string[]>(kv, userTeamsIndexKey(userId))) ?? []
}

export async function addUserTeam(kv: KVNamespace, userId: string, teamId: string): Promise<void> {
  const ids = await loadUserTeamIds(kv, userId)
  if (!ids.includes(teamId)) {
    ids.push(teamId)
    await writeKvJson(kv, userTeamsIndexKey(userId), ids)
  }
}

export async function removeUserTeam(kv: KVNamespace, userId: string, teamId: string): Promise<void> {
  const ids = await loadUserTeamIds(kv, userId)
  const filtered = ids.filter((id) => id !== teamId)
  if (filtered.length !== ids.length) {
    await writeKvJson(kv, userTeamsIndexKey(userId), filtered)
  }
}

export function teamDomainKey(host: string): string {
  return `team-domain:${host.toLowerCase()}`
}

// ─── Membership helpers ──────────────────────────────────────────────────────

export function findMember(team: Team, userId: string): TeamMember | undefined {
  return team.members.find((m) => m.userId === userId)
}

export function isOwner(team: Team, userId: string): boolean {
  return team.ownerId === userId
}

export function isMemberOrOwner(team: Team, userId: string): boolean {
  return isOwner(team, userId) || team.members.some((m) => m.userId === userId)
}

/**
 * Persist role in D1 user_roles so the shared RBAC middleware can enforce
 * team-level permissions uniformly. Team scoping is out of v1 scope — we only
 * track a global role per user. Owners/admins of any team get owner/admin role.
 */
export async function upsertUserRole(db: D1Database, userId: string, role: Role): Promise<void> {
  const id = ulid()
  const now = Date.now()
  // ON CONFLICT(user_id, role) DO NOTHING — role already exists.
  await db
    .prepare(
      `INSERT INTO user_roles (id, user_id, role, created_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, role) DO NOTHING`,
    )
    .bind(id, userId, role, now)
    .run()
}

// ─── Cross-domain service functions (used by auth / SAML acceptance flows) ────

/**
 * Idempotently ensure the user has a personal team in TEAMS_KV.
 * If any team in the user's list already has `personal: true`, returns it.
 * Otherwise creates a new team named "Personal" with personal: true.
 * Safe to call on every signup and on every session create — will no-op if
 * the personal team already exists.
 */
export async function ensurePersonalTeam(
  kv: KVNamespace,
  db: D1Database,
  userId: string,
  email: string,
): Promise<Team> {
  const ids = await loadUserTeamIds(kv, userId)
  for (const id of ids) {
    const t = await loadTeam(kv, id)
    if (t?.personal === true) return t
  }
  const now = Date.now()
  const team: Team = {
    id: ulid(),
    name: 'Personal',
    ownerId: userId,
    members: [{ userId, email, role: 'owner', joinedAt: now }],
    plan: 'free',
    samlConfig: null,
    createdAt: now,
    personal: true,
  }
  await saveTeam(kv, team)
  await addUserTeam(kv, userId, team.id)
  await upsertUserRole(db, userId, 'owner')
  return team
}

/**
 * Attach a user to a team (called when a SAML callback or invite acceptance
 * successfully identifies the team + user). Idempotent.
 */
export async function attachUserToTeam(
  kv: KVNamespace,
  db: D1Database,
  teamId: string,
  userId: string,
  email: string,
  role: Role = 'member',
): Promise<void> {
  const team = await loadTeam(kv, teamId)
  if (!team) return
  if (!team.members.some((m) => m.userId === userId)) {
    team.members.push({ userId, email, role, joinedAt: Date.now() })
    await saveTeam(kv, team)
    await addUserTeam(kv, userId, teamId)
  }
  await upsertUserRole(db, userId, role)
}

export async function consumeInvite(
  kv: KVNamespace,
  tokenHash: string,
): Promise<{ teamId: string; email: string; role: Role } | null> {
  const raw = await kv.get(teamInviteKey(tokenHash))
  if (!raw) return absent()
  await kv.delete(teamInviteKey(tokenHash))
  const invite = validateKvJson(raw, TeamInviteTokenSchema)
  if (!invite) return absent()
  return { teamId: invite.teamId, email: invite.email, role: invite.role as Role }
}
