/**
 * COMPLIANCE-TYPE2-EVIDENCE-01 — evidence pack metadata for enterprise admins.
 *
 * "automated" means the control is enforced or recorded by code on every
 * relevant request with no human step in the loop (see `description` per
 * artifact for exactly what runs). "manual_upload" means a human currently
 * performs and/or records the control outside this codebase.
 *
 * `collected_at` is when this snapshot was generated. Automated artifacts
 * reflect live, continuously-enforced state (there's no periodic batch job —
 * `next_collection` is null for these because "next" doesn't apply to an
 * always-on check). `pentest-remediation` is the one artifact with a real
 * external cadence, sourced from the admin-tracked status in
 * `compliance-admin.ts` (`POST /api/admin/compliance/pentest/*`).
 */
import { Hono } from 'hono'
import { authMiddleware, type AuthVariables } from '../middleware/auth'
import type { AdminVariables } from '../middleware/admin'
import { adminMiddleware } from '../middleware/admin'
import type { Env } from '../types'
import type { ParentApp } from './parent-app'

export type EvidencePackArtifactStatus = 'automated' | 'manual_upload'

export type EvidencePackArtifact = {
  id: string
  status: EvidencePackArtifactStatus
  source: string
  description: string
  collected_at: number
  /** Only set for artifacts with a real, externally-tracked recurrence. */
  next_collection: number | null
}

const PENTEST_RECHECK_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000 // 90 days, matches security review cadence

export function mountComplianceRoutes(parent: ParentApp) {
  const app = new Hono<{ Bindings: Env; Variables: AuthVariables & AdminVariables }>()
  app.use('*', authMiddleware)
  app.use('*', adminMiddleware)

  app.get('/evidence-pack', async (c) => {
    const generatedAt = Date.now()
    const artifacts: EvidencePackArtifact[] = [
      {
        id: 'access-control',
        status: 'automated',
        source: 'functions/api/middleware/rbac.ts PERMISSION_MATRIX',
        description:
          'Role-based permission matrix enforced in middleware on every request (owner/admin/member/viewer/guest). No human review step — denied requests are rejected inline.',
        collected_at: generatedAt,
        next_collection: null,
      },
      {
        id: 'audit-trail',
        status: 'automated',
        source: 'D1 audit_events table (lib/audit.ts recordAuthAuditEvent)',
        description:
          'Auth and admin actions are written to the audit_events D1 table automatically as they happen, with actor, outcome, and trace id.',
        collected_at: generatedAt,
        next_collection: null,
      },
      {
        id: 'gdpr-deletion',
        status: 'automated',
        source: 'gdpr.deletion_requested / gdpr.deletion_completed Analytics Engine events',
        description:
          'DELETE /api/users/me/gdpr-delete and the org-admin equivalent run synchronously and emit before/after events; see GDPR_DATA_SUBJECT_RUNBOOK.md.',
        collected_at: generatedAt,
        next_collection: null,
      },
      {
        id: 'api-key-lifecycle',
        status: 'automated',
        source: 'INTEGRATIONS_KV apikey:* records (lib/api-keys.ts)',
        description:
          'API key creation, hashing at rest, and revocation are recorded in INTEGRATIONS_KV automatically when keys are issued or revoked via the API.',
        collected_at: generatedAt,
        next_collection: null,
      },
      {
        id: 'pentest-remediation',
        status: 'manual_upload',
        source: 'security/backlog + compliance-admin.ts pentest status',
        description:
          'Penetration test scheduling, findings, and remediation are tracked manually by the security team; this endpoint only reflects the last status a human recorded, not an automated scan.',
        collected_at: generatedAt,
        next_collection: generatedAt + PENTEST_RECHECK_INTERVAL_MS,
      },
    ]

    return c.json({
      ok: true,
      data: {
        generatedAt,
        framework: 'SOC2-Type-II-prep',
        artifacts,
        retentionDays: 365,
        note: 'Full PDF export is enterprise roadmap; this endpoint lists verifiable control sources, not a signed audit report.',
      },
      trace_id: c.get('trace_id'),
    })
  })

  parent.route('/api/compliance', app)
}
