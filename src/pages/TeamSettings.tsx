import { useState, useEffect, useRef } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { api } from '../api/client'
import MainLayout from '../layouts/MainLayout'

// ─── Types matching the backend Team shape ────────────────────────────────────

type Role = 'owner' | 'admin' | 'member' | 'viewer'

interface SamlConfig {
  idpEntityId: string
  idpSsoUrl: string
  idpCertificate?: string
}

interface TeamMember {
  userId: string
  email: string
  role: Role
  joinedAt: number
}

interface Team {
  id: string
  name: string
  ownerId: string
  members: TeamMember[]
  plan: 'free' | 'starter' | 'team'
  samlConfig: SamlConfig | null
  createdAt: number
}

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const colours: Record<Role, string> = {
    owner: 'bg-violet-100 text-violet-700',
    admin: 'bg-teal-100 text-teal-700',
    member: 'bg-pulse-100 text-pulse-600',
    viewer: 'bg-pulse-100 text-pulse-500',
  }
  return (
    <span
      className={`inline-block text-xs uppercase tracking-wider rounded-full px-2 py-0.5 ${colours[role]}`}
    >
      {role}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeamSettings() {
  const { id } = useParams<{ id: string }>()
  const auth = useAuth()

  const [team, setTeam] = useState<Team | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // General section state
  const [teamName, setTeamName] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameFeedback, setNameFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  // Invite section state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviting, setInviting] = useState(false)
  const [inviteFeedback, setInviteFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  // Remove member state
  const [removingId, setRemovingId] = useState<string | null>(null)

  // SAML section state
  const [samlEntityId, setSamlEntityId] = useState('')
  const [samlSsoUrl, setSamlSsoUrl] = useState('')
  const [samlSaving, setSamlSaving] = useState(false)
  const [samlFeedback, setSamlFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const h1Ref = useRef<HTMLHeadingElement>(null)

  // ── Load team on mount ────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    setLoading(true)
    void api<{ team: Team }>(`/api/teams/${id}`)
      .then((res) => {
        if (res.ok) {
          setTeam(res.data.team)
          setTeamName(res.data.team.name)
          if (res.data.team.samlConfig) {
            setSamlEntityId(res.data.team.samlConfig.idpEntityId)
            setSamlSsoUrl(res.data.team.samlConfig.idpSsoUrl)
          }
        } else {
          setLoadError(res.error.message)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  // ── Guard: redirect unauthenticated users ─────────────────────────────────

  if (auth.status === 'loading') {
    return (
      <MainLayout mainClassName="min-h-screen max-w-2xl mx-auto p-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-pulse-200 skeleton-shimmer" aria-hidden="true" />
          ))}
        </div>
      </MainLayout>
    )
  }
  if (auth.status === 'anonymous') {
    return <Navigate to="/login" replace />
  }

  const currentUserId = auth.user.id
  const isOwner = team?.ownerId === currentUserId
  const currentMember = team?.members.find((m) => m.userId === currentUserId)

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!id || !team) return
    const trimmed = teamName.trim()
    if (!trimmed || trimmed === team.name) return
    setNameSaving(true)
    setNameFeedback(null)
    const res = await api<{ team: Team }>(`/api/teams/${id}`, {
      method: 'PATCH',
      body: { name: trimmed },
    })
    setNameSaving(false)
    if (res.ok) {
      setTeam(res.data.team)
      setNameFeedback({ kind: 'ok', msg: 'Team name saved.' })
    } else {
      setNameFeedback({ kind: 'err', msg: res.error.message })
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    const email = inviteEmail.trim()
    if (!email) return
    setInviting(true)
    setInviteFeedback(null)
    const res = await api<{ invited: boolean; email: string }>(`/api/teams/${id}/members`, {
      method: 'POST',
      body: { email, role: inviteRole },
    })
    setInviting(false)
    if (res.ok) {
      setInviteEmail('')
      setInviteFeedback({ kind: 'ok', msg: `Invite sent to ${res.data.email}.` })
    } else {
      setInviteFeedback({ kind: 'err', msg: res.error.message })
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!id || !team) return
    setRemovingId(userId)
    const res = await api<{ removed: boolean }>(`/api/teams/${id}/members/${userId}`, {
      method: 'DELETE',
    })
    setRemovingId(null)
    if (res.ok) {
      setTeam({
        ...team,
        members: team.members.filter((m) => m.userId !== userId),
      })
    }
  }

  async function handleSaveSaml(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    const entityId = samlEntityId.trim()
    const ssoUrl = samlSsoUrl.trim()
    if (!entityId || !ssoUrl) return
    setSamlSaving(true)
    setSamlFeedback(null)
    const res = await api<{ team: Team }>(`/api/teams/${id}`, {
      method: 'PATCH',
      body: {
        samlConfig: { idpEntityId: entityId, idpSsoUrl: ssoUrl },
      },
    })
    setSamlSaving(false)
    if (res.ok) {
      setTeam(res.data.team)
      setSamlFeedback({ kind: 'ok', msg: 'SAML configuration saved.' })
    } else {
      setSamlFeedback({ kind: 'err', msg: res.error.message })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const navSlot = (
    <button
      type="button"
      onClick={() => void auth.logout()}
      className="text-sm text-teal-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 rounded"
    >
      Sign out
    </button>
  )

  if (loading) {
    return (
      <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto p-8">
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-pulse-200" aria-hidden="true" />
          ))}
        </div>
      </MainLayout>
    )
  }

  if (loadError || !team) {
    return (
      <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto p-8">
        <p role="alert" className="text-red-600">
          {loadError ?? 'Team not found.'}
        </p>
      </MainLayout>
    )
  }

  return (
    <MainLayout navSlot={navSlot} mainClassName="min-h-screen max-w-2xl mx-auto p-8 space-y-10">
      <div className="animate-page-enter space-y-10">
        <div>
          <h1
            ref={h1Ref}
            tabIndex={-1}
            className="text-3xl font-semibold focus:outline-none"
          >
            Team settings
          </h1>
          <p className="text-sm text-pulse-500 mt-1">
            {team.name}
            {currentMember ? (
              <> &middot; you are a <RoleBadge role={currentMember.role} /></>
            ) : null}
          </p>
        </div>

        {/* ── General ──────────────────────────────────────────────────────── */}
        <section aria-labelledby="section-general" className="space-y-4 rounded-xl border border-pulse-200 p-6">
          <h2 id="section-general" className="text-lg font-semibold">General</h2>
          <form onSubmit={(e) => void handleSaveName(e)} className="flex flex-col gap-3">
            <label htmlFor="team-name" className="text-sm font-medium">
              Team name
            </label>
            <input
              id="team-name"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={100}
              disabled={!isOwner || nameSaving}
              className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 disabled:text-pulse-500"
            />
            {nameFeedback ? (
              <p
                role="alert"
                className={`text-sm ${nameFeedback.kind === 'ok' ? 'text-teal-600' : 'text-red-600'}`}
              >
                {nameFeedback.msg}
              </p>
            ) : null}
            {isOwner && (
              <button
                type="submit"
                disabled={nameSaving || teamName.trim() === team.name || teamName.trim().length === 0}
                className="self-start inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {nameSaving ? 'Saving…' : 'Save name'}
              </button>
            )}
          </form>
        </section>

        {/* ── Members ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="section-members" className="space-y-4 rounded-xl border border-pulse-200 p-6">
          <h2 id="section-members" className="text-lg font-semibold">Members</h2>
          <ul className="divide-y divide-pulse-100" role="list">
            {team.members.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {member.email}
                    {member.userId === currentUserId ? (
                      <span className="ml-1 text-pulse-400 text-xs">(you)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-pulse-400">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <RoleBadge role={member.role} />
                  {isOwner && member.userId !== currentUserId && member.userId !== team.ownerId ? (
                    <button
                      type="button"
                      aria-label={`Remove ${member.email}`}
                      onClick={() => void handleRemoveMember(member.userId)}
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

        {/* ── Invite ─────────────────────────────────────────────────────────── */}
        <section aria-labelledby="section-invite" className="space-y-4 rounded-xl border border-pulse-200 p-6">
          <h2 id="section-invite" className="text-lg font-semibold">Invite member</h2>
          <form onSubmit={(e) => void handleInvite(e)} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label htmlFor="invite-email" className="text-sm font-medium">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  maxLength={254}
                  disabled={inviting}
                  className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="invite-role" className="text-sm font-medium">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                  disabled={inviting}
                  className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 bg-white"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            </div>
            {inviteFeedback ? (
              <p
                role="alert"
                aria-live="polite"
                className={`text-sm ${inviteFeedback.kind === 'ok' ? 'text-teal-600' : 'text-red-600'}`}
              >
                {inviteFeedback.msg}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={inviting || inviteEmail.trim().length === 0}
              className="self-start inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        </section>

        {/* ── SAML (owner only) ─────────────────────────────────────────────── */}
        {isOwner && (
          <section aria-labelledby="section-saml" className="space-y-4 rounded-xl border border-pulse-200 p-6">
            <h2 id="section-saml" className="text-lg font-semibold">SAML configuration</h2>
            <p className="text-sm text-pulse-500">
              Configure single sign-on via SAML 2.0. Contact your identity provider for these values.
            </p>
            <form onSubmit={(e) => void handleSaveSaml(e)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="saml-entity-id" className="text-sm font-medium">
                  Entity ID
                </label>
                <input
                  id="saml-entity-id"
                  type="text"
                  value={samlEntityId}
                  onChange={(e) => setSamlEntityId(e.target.value)}
                  placeholder="https://your-idp.example.com/metadata"
                  maxLength={512}
                  disabled={samlSaving}
                  className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 font-mono text-sm"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="saml-sso-url" className="text-sm font-medium">
                  IdP Metadata URL (SSO endpoint)
                </label>
                <input
                  id="saml-sso-url"
                  type="url"
                  value={samlSsoUrl}
                  onChange={(e) => setSamlSsoUrl(e.target.value)}
                  placeholder="https://your-idp.example.com/sso"
                  maxLength={1024}
                  disabled={samlSaving}
                  className="border border-pulse-300 rounded-lg px-3 py-2 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 disabled:bg-pulse-50 font-mono text-sm"
                />
              </div>
              {samlFeedback ? (
                <p
                  role="alert"
                  aria-live="polite"
                  className={`text-sm ${samlFeedback.kind === 'ok' ? 'text-teal-600' : 'text-red-600'}`}
                >
                  {samlFeedback.msg}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={samlSaving || !samlEntityId.trim() || !samlSsoUrl.trim()}
                className="self-start inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 text-white px-4 py-2 font-medium hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {samlSaving ? 'Saving…' : 'Save SAML configuration'}
              </button>
            </form>
          </section>
        )}
      </div>
    </MainLayout>
  )
}
