/**
 * LEARN-00 (ADR-0058) — EMBED traction checkpoint.
 *
 * The LEARN vertical only proceeds if the EMBED rails it rides on have real
 * traction: ≥10 live (non-revoked) embed widgets and 0 open security incidents.
 * Pure decision so the gate is identical in the route, the planning report, and
 * tests — no hidden "proceed anyway" path.
 */

export const LEARN_MIN_LIVE_EMBEDS = 10
export const LEARN_MAX_SECURITY_INCIDENTS = 0

export type LearnGateInput = {
  liveEmbedCount: number
  openSecurityIncidents: number
}

export type LearnGateDecision = {
  proceed: boolean
  reason: string
  liveEmbedCount: number
  openSecurityIncidents: number
  threshold: number
  /** Where deferred LEARN work reallocates (per SPRINT85_99_PLAN §checkpoint 1). */
  deferTarget: 'S96'
}

export function evaluateEmbedTractionGate(input: LearnGateInput): LearnGateDecision {
  const meetsEmbed = input.liveEmbedCount >= LEARN_MIN_LIVE_EMBEDS
  const meetsSecurity = input.openSecurityIncidents <= LEARN_MAX_SECURITY_INCIDENTS
  const proceed = meetsEmbed && meetsSecurity

  let reason: string
  if (proceed) {
    reason = `embed_traction_met:${input.liveEmbedCount}_live_embeds`
  } else if (!meetsEmbed && !meetsSecurity) {
    reason = `below_embed_threshold_and_open_incidents`
  } else if (!meetsEmbed) {
    reason = `below_embed_threshold:${input.liveEmbedCount}/${LEARN_MIN_LIVE_EMBEDS}`
  } else {
    reason = `open_security_incidents:${input.openSecurityIncidents}`
  }

  return {
    proceed,
    reason,
    liveEmbedCount: input.liveEmbedCount,
    openSecurityIncidents: input.openSecurityIncidents,
    threshold: LEARN_MIN_LIVE_EMBEDS,
    deferTarget: 'S96',
  }
}
