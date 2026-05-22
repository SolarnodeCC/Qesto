/**
 * BRAND-01 — team white-label branding (KV on Team document).
 */
import { readKvJson } from './kv'
import { teamDocumentKey } from './kv-keys'

export type TeamBranding = {
  logoUrl?: string | null
  primaryColor?: string
  secondaryColor?: string
}

const HEX = /^#[0-9A-Fa-f]{6}$/

export function normalizeBranding(raw: TeamBranding | null | undefined): TeamBranding | null {
  if (!raw) return null
  const out: TeamBranding = {}
  if (raw.logoUrl && typeof raw.logoUrl === 'string' && raw.logoUrl.length <= 2048) {
    out.logoUrl = raw.logoUrl
  }
  if (raw.primaryColor && HEX.test(raw.primaryColor)) out.primaryColor = raw.primaryColor
  if (raw.secondaryColor && HEX.test(raw.secondaryColor)) out.secondaryColor = raw.secondaryColor
  if (!out.logoUrl && !out.primaryColor && !out.secondaryColor) return null
  return out
}

export async function loadTeamBranding(
  kv: KVNamespace,
  teamId: string | null | undefined,
): Promise<TeamBranding | null> {
  if (!teamId) return null
  const team = await readKvJson<{ branding?: TeamBranding }>(kv, teamDocumentKey(teamId))
  return normalizeBranding(team?.branding ?? null)
}

export function brandingCssVars(branding: TeamBranding | null): Record<string, string> {
  if (!branding) return {}
  const vars: Record<string, string> = {}
  if (branding.primaryColor) {
    vars['--brand-primary'] = branding.primaryColor
    vars['--gradient-brand'] = `linear-gradient(135deg, ${branding.primaryColor}, ${branding.secondaryColor ?? branding.primaryColor})`
  }
  if (branding.secondaryColor) vars['--brand-secondary'] = branding.secondaryColor
  return vars
}
