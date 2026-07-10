import { useState, useEffect } from 'react'
import { useT } from '../../i18n'

/**
 * Self-contained Slack + Microsoft Teams integration section, extracted from
 * TeamSettings.tsx (R-05). Owns its own status-loading effects, state, and
 * handlers; depends only on the team id, so the parent page no longer carries
 * ~17 integration state fields and 7 handlers.
 */
export function TeamIntegrations({ teamId: id }: { teamId: string | undefined }) {
  const t = useT('sessions')
  const tTeam = useT('team')

  // Slack section state
  const [slackStatus, setSlackStatus] = useState<{
    connected: boolean
    channel?: string
    teamName?: string
    notifyOnClose?: boolean
    notifyOnEnergizer?: boolean
  } | null>(null)
  const [slackLoading, setSlackLoading] = useState(false)
  const [slackError, setSlackError] = useState<string | null>(null)
  const [slackTestSent, setSlackTestSent] = useState(false)
  const [slackDisconnecting, setSlackDisconnecting] = useState(false)
  const [slackTesting, setSlackTesting] = useState(false)
  const [slackNotifyClose, setSlackNotifyClose] = useState(true)
  const [slackNotifyEnergizer, setSlackNotifyEnergizer] = useState(false)
  const [slackPrefsSaving, setSlackPrefsSaving] = useState(false)

  const [teamsStatus, setTeamsStatus] = useState<{ connected: boolean; channelName?: string } | null>(null)
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamsError, setTeamsError] = useState<string | null>(null)
  const [teamsDisconnecting, setTeamsDisconnecting] = useState(false)
  const [teamsGroupId, setTeamsGroupId] = useState('')
  const [teamsChannelId, setTeamsChannelId] = useState('')
  const [teamsChannelName, setTeamsChannelName] = useState('')
  const [teamsConfigSaving, setTeamsConfigSaving] = useState(false)

  // ── Load Slack status ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    setSlackLoading(true)
    setSlackError(null)
    void fetch(`/api/integrations/slack/status?teamId=${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) {
          setSlackError('Failed to load Slack status.')
          return
        }
        const json = await res.json() as {
          ok: boolean
          data: {
            connected: boolean
            channel?: string
            teamName?: string
            notifyOnClose?: boolean
            notifyOnEnergizer?: boolean
          }
        }
        if (json.ok) {
          setSlackStatus(json.data)
          setSlackNotifyClose(json.data.notifyOnClose !== false)
          setSlackNotifyEnergizer(json.data.notifyOnEnergizer === true)
        } else {
          setSlackError('Failed to load Slack status.')
        }
      })
      .catch(() => setSlackError('Failed to load Slack status.'))
      .finally(() => setSlackLoading(false))
  }, [id])

  // ── Load Teams status ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    setTeamsLoading(true)
    setTeamsError(null)
    void fetch(`/api/integrations/teams/status?teamId=${encodeURIComponent(id)}`)
      .then(async (res) => {
        const json = (await res.json()) as {
          ok: boolean
          data?: { connected: boolean; channelName?: string }
        }
        if (json.ok && json.data) setTeamsStatus(json.data)
        else setTeamsError(tTeam('teams_status_error'))
      })
      .catch(() => setTeamsError(tTeam('teams_status_error')))
      .finally(() => setTeamsLoading(false))
  }, [id, tTeam])

  async function handleSlackDisconnect() {
    if (!id) return
    setSlackDisconnecting(true)
    setSlackError(null)
    setSlackTestSent(false)
    try {
      const res = await fetch('/api/integrations/slack/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: id }),
      })
      const json = await res.json() as { ok: boolean; data?: { disconnected: boolean }; error?: { message: string } }
      if (json.ok) {
        setSlackStatus({ connected: false })
      } else {
        setSlackError(json.error?.message ?? 'Disconnect failed.')
      }
    } catch {
      setSlackError('Disconnect failed. Please try again.')
    } finally {
      setSlackDisconnecting(false)
    }
  }

  async function saveSlackPreferences(notifyOnClose: boolean, notifyOnEnergizer: boolean) {
    if (!id) return
    setSlackPrefsSaving(true)
    setSlackError(null)
    try {
      const res = await fetch('/api/integrations/slack/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId: id, notifyOnClose, notifyOnEnergizer }),
      })
      const json = (await res.json()) as { ok: boolean; error?: { message?: string } }
      if (!json.ok) {
        setSlackError(json.error?.message ?? tTeam('slack_prefs_error'))
      }
    } catch {
      setSlackError(tTeam('slack_prefs_error'))
    } finally {
      setSlackPrefsSaving(false)
    }
  }

  async function handleSlackNotifyCloseChange(checked: boolean) {
    setSlackNotifyClose(checked)
    await saveSlackPreferences(checked, slackNotifyEnergizer)
  }

  async function handleSlackNotifyEnergizerChange(checked: boolean) {
    setSlackNotifyEnergizer(checked)
    await saveSlackPreferences(slackNotifyClose, checked)
  }

  async function handleTeamsDisconnect() {
    if (!id) return
    setTeamsDisconnecting(true)
    setTeamsError(null)
    try {
      const res = await fetch('/api/integrations/teams/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ teamId: id }),
      })
      const json = (await res.json()) as { ok: boolean }
      if (json.ok) setTeamsStatus({ connected: false })
      else setTeamsError(tTeam('teams_disconnect_error'))
    } catch {
      setTeamsError(tTeam('teams_disconnect_error'))
    } finally {
      setTeamsDisconnecting(false)
    }
  }

  async function handleTeamsConfigSave() {
    if (!id || !teamsGroupId.trim() || !teamsChannelId.trim()) return
    setTeamsConfigSaving(true)
    setTeamsError(null)
    try {
      const res = await fetch('/api/integrations/teams/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          teamId: id,
          groupId: teamsGroupId.trim(),
          channelId: teamsChannelId.trim(),
          channelName: teamsChannelName.trim() || teamsChannelId.trim(),
        }),
      })
      const json = (await res.json()) as { ok: boolean; error?: { message?: string } }
      if (json.ok) {
        setTeamsStatus({ connected: true, channelName: teamsChannelName.trim() || teamsChannelId.trim() })
      } else {
        setTeamsError(json.error?.message ?? tTeam('teams_config_error'))
      }
    } catch {
      setTeamsError(tTeam('teams_config_error'))
    } finally {
      setTeamsConfigSaving(false)
    }
  }

  async function handleSlackTest() {
    if (!id) return
    setSlackTesting(true)
    setSlackError(null)
    setSlackTestSent(false)
    try {
      const res = await fetch('/api/integrations/slack/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: id }),
      })
      const json = await res.json() as { ok: boolean; error?: { message: string } }
      if (json.ok) {
        setSlackTestSent(true)
      } else {
        setSlackError(json.error?.message ?? 'Test message failed.')
      }
    } catch {
      setSlackError('Test message failed. Please try again.')
    } finally {
      setSlackTesting(false)
    }
  }

  return (
    <section aria-labelledby="section-integrations" className="space-y-4 rounded-xl border border-pulse-200 p-8">
      <h2 id="section-integrations" className="text-lg font-semibold">{t('integrations')}</h2>

      {/* Slack card */}
      <div className="flex items-start gap-4 rounded-lg border border-pulse-200 p-4">
        {/* Slack logo */}
        <svg
          aria-hidden="true"
          focusable="false"
          width="32"
          height="32"
          viewBox="0 0 54 54"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 mt-0.5"
        >
          <g fill="none" fillRule="evenodd">
            <path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/>
            <path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/>
            <path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/>
            <path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/>
          </g>
        </svg>

        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h3 className="font-medium text-pulse-900 dark:text-[#F0F2F8]">{t('slack_title')}</h3>
            <p className="text-sm text-pulse-500 mt-0.5">{t('slack_description')}</p>
          </div>

          {/* Loading state */}
          {slackLoading ? (
            <div className="h-6 w-40 rounded bg-pulse-100 skeleton-shimmer" aria-hidden="true" />
          ) : (
            <>
              {/* Connection status */}
              <p className="text-sm">
                {slackStatus?.connected && slackStatus.channel ? (
                  <span className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400 font-medium">
                    <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-teal-500" />
                    {t('slack_connected', { channel: slackStatus.channel })}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-pulse-500">
                    <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-pulse-300" />
                    {t('slack_not_connected')}
                  </span>
                )}
              </p>

              {/* Error message */}
              {slackError ? (
                <p role="alert" aria-live="polite" className="text-sm text-red-600">
                  {slackError}
                </p>
              ) : null}

              {/* Test sent confirmation */}
              {slackTestSent ? (
                <p aria-live="polite" className="text-sm text-teal-600">
                  {t('slack_test_sent')}
                </p>
              ) : null}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {slackStatus?.connected ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleSlackTest()}
                      disabled={slackTesting || slackDisconnecting}
                      className="min-h-[44px] inline-flex items-center rounded-lg border border-pulse-300 dark:border-[#2A3858] bg-white dark:bg-transparent text-pulse-700 dark:text-[#A8B3CC] px-4 py-2 text-sm font-medium hover:border-teal-400 hover:text-teal-700 dark:hover:border-teal-600 dark:hover:text-teal-400 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                    >
                      {slackTesting ? 'Sending…' : t('slack_test')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSlackDisconnect()}
                      disabled={slackDisconnecting || slackTesting}
                      className="min-h-[44px] inline-flex items-center rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    >
                      {slackDisconnecting ? 'Disconnecting…' : t('slack_disconnect')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (id) window.location.href = `/api/integrations/slack/connect?teamId=${encodeURIComponent(id)}`
                    }}
                    className="min-h-[44px] inline-flex items-center rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                  >
                    {t('slack_connect')}
                  </button>
                )}
              </div>

              {slackStatus?.connected ? (
                <fieldset className="space-y-2 border-t border-pulse-100 pt-3">
                  <legend className="text-sm font-medium text-pulse-700 dark:text-[#A8B3CC] mb-2">{tTeam('slack_notification_events')}</legend>
                  <label className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slackNotifyClose}
                      onChange={(e) => void handleSlackNotifyCloseChange(e.target.checked)}
                      disabled={slackPrefsSaving}
                      className="h-4 w-4 rounded border-pulse-300 text-teal-600 focus:ring-teal-500"
                    />
                    {t('slack_notify_close')}
                  </label>
                  <label className="flex items-center gap-3 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={slackNotifyEnergizer}
                      onChange={(e) => void handleSlackNotifyEnergizerChange(e.target.checked)}
                      disabled={slackPrefsSaving}
                      className="h-4 w-4 rounded border-pulse-300 text-teal-600 focus:ring-teal-500"
                    />
                    {t('slack_notify_energizer')}
                  </label>
                </fieldset>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Microsoft Teams card */}
      <div className="flex items-start gap-4 rounded-lg border border-pulse-200 p-4">
        <div
          aria-hidden="true"
          className="shrink-0 mt-0.5 flex h-12 w-12 items-center justify-center rounded bg-[#464EB8] text-xs font-bold text-white"
        >
          T
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h3 className="font-medium text-pulse-900 dark:text-[#F0F2F8]">{tTeam('teams_title')}</h3>
            <p className="text-sm text-pulse-500 mt-0.5">{tTeam('teams_description')}</p>
          </div>
          {teamsLoading ? (
            <div className="h-6 w-40 rounded bg-pulse-100 skeleton-shimmer" aria-hidden="true" />
          ) : (
            <>
              <p className="text-sm">
                {teamsStatus?.connected && teamsStatus.channelName ? (
                  <span className="inline-flex items-center gap-1.5 text-teal-700 dark:text-teal-400 font-medium">
                    <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-teal-500" />
                    {tTeam('teams_connected', { channel: teamsStatus.channelName })}
                  </span>
                ) : teamsStatus?.connected ? (
                  <span className="text-amber-700 dark:text-amber-400">{tTeam('teams_needs_channel')}</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-pulse-500">
                    <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-pulse-300" />
                    {tTeam('teams_not_connected')}
                  </span>
                )}
              </p>
              {teamsError ? (
                <p role="alert" className="text-sm text-red-600">{teamsError}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {teamsStatus?.connected ? (
                  <button
                    type="button"
                    onClick={() => void handleTeamsDisconnect()}
                    disabled={teamsDisconnecting}
                    className="min-h-[44px] rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:border-red-400 disabled:opacity-60"
                  >
                    {teamsDisconnecting ? '…' : tTeam('teams_disconnect')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (id) window.location.href = `/api/integrations/teams/connect?teamId=${encodeURIComponent(id)}`
                    }}
                    className="min-h-[44px] rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 px-4 py-2 text-sm font-medium text-white"
                  >
                    {tTeam('teams_connect')}
                  </button>
                )}
              </div>
              {teamsStatus?.connected ? (
                <form
                  className="space-y-2 border-t border-pulse-100 pt-3"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void handleTeamsConfigSave()
                  }}
                >
                  <p className="text-sm font-medium text-pulse-700 dark:text-[#A8B3CC]">{tTeam('teams_channel_config')}</p>
                  <label className="block text-sm">
                    <span className="text-pulse-600 dark:text-[#A8B3CC]">{tTeam('teams_group_id')}</span>
                    <input
                      value={teamsGroupId}
                      onChange={(e) => setTeamsGroupId(e.target.value)}
                      className="mt-1 w-full rounded border border-pulse-200 px-3 py-2"
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-pulse-600 dark:text-[#A8B3CC]">{tTeam('teams_channel_id')}</span>
                    <input
                      value={teamsChannelId}
                      onChange={(e) => setTeamsChannelId(e.target.value)}
                      className="mt-1 w-full rounded border border-pulse-200 px-3 py-2"
                      required
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-pulse-600 dark:text-[#A8B3CC]">{tTeam('teams_channel_name')}</span>
                    <input
                      value={teamsChannelName}
                      onChange={(e) => setTeamsChannelName(e.target.value)}
                      className="mt-1 w-full rounded border border-pulse-200 px-3 py-2"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={teamsConfigSaving}
                    className="min-h-[44px] rounded-lg border border-pulse-300 px-4 py-2 text-sm font-medium"
                  >
                    {teamsConfigSaving ? '…' : tTeam('teams_save_channel')}
                  </button>
                </form>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
