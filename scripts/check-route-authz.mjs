#!/usr/bin/env node
/**
 * SEC-RBAC-INVENTORY-01 — CI ratchet for mutating routes missing auth markers.
 *
 * Heuristic: route modules with POST/PATCH/PUT/DELETE must import or reference
 * at least one known auth/authz pattern, unless explicitly public (EXEMPT).
 *
 * Parent-mounted authMiddleware is not traced across files — session lifecycle
 * modules use SessionVars / requireDraft markers instead.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..')
const SCAN_DIR = resolve(ROOT, 'functions/api/routes')

const AUTHZ_MARKERS = [
  /requireSessionAccess/,
  /authorizeTeamPermission/,
  /requireTeamPermission/,
  /requireTeamOwner/,
  /adminMiddleware/,
  /authMiddleware/,
  /verifyStripeSignature/,
  /widgetTokenMiddleware/,
  /publicApiAuth/,
  /scimAuth/,
  /requireFeature\(/,
  /requireAdmin/,
  /SessionVars/,
  /requireDraft/,
  /requireLiveForClose/,
  /requireFound/,
  /requireLiveForWebSocket/,
]

const EXEMPT = new RegExp(
  [
    'billing-webhooks',
    'webhooks-marketing',
    'routes/auth/',
    'embed-widget',
    'routes/embed\\.ts',
    'public-api',
    'routes/scim\\.ts',
    'routes/seo\\.ts',
    'og-image',
    'marketing-template',
    'sessions/public',
    'routes/platform\\.ts',
    'webhook-templates',
    'partner-marketplace',
    'help/register',
    'templates-marketing',
    'report-content',
  ].join('|'),
)

const MUTATING = /\.(post|put|patch|delete)\(/i
const BASELINE = 0

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

const violations = []
for (const file of walk(SCAN_DIR)) {
  const rel = relative(ROOT, file)
  if (EXEMPT.test(rel)) continue
  const content = readFileSync(file, 'utf8')
  if (!MUTATING.test(content)) continue
  if (!AUTHZ_MARKERS.some((m) => m.test(content))) {
    violations.push(rel)
  }
}

if (violations.length > BASELINE) {
  console.error(`check-route-authz: ${violations.length} route file(s) missing auth markers (baseline ${BASELINE})`)
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

console.log(`check-route-authz: OK (${violations.length} flagged, baseline ${BASELINE})`)
