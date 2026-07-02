#!/usr/bin/env node
/**
 * generate-adr-index.mjs
 * Regenerates the Decision Summary table in knowledge-base/adr/README.md.
 *
 * Usage:
 *   node scripts/generate-adr-index.mjs          # prints table to stdout
 *   node scripts/generate-adr-index.mjs --write   # writes README.md in-place
 *
 * Domain is maintained in the DOMAIN_MAP below; everything else (title,
 * status) is extracted from the ADR files. Add a new ADR there too when
 * adding a new file. [SLOT] entries for planned-but-unwritten ADRs are
 * declared in PLANNED_SLOTS.
 *
 * Wire into quality gates (optional):
 *   node scripts/generate-adr-index.mjs > /tmp/adr-index.md
 *   diff /tmp/adr-index.md knowledge-base/adr/README.md
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ADR_DIR = join(__dirname, '..', 'knowledge-base', 'adr')
const README_PATH = join(ADR_DIR, 'README.md')

// Domain for each ADR identifier (key = canonical ADR id, e.g. '0001', '040', 'AI-Latency').
// Update this map when adding a new ADR.
const DOMAIN_MAP = {
  '0001': 'Architecture',
  '0002': 'AI/Backend',
  '0003': 'Backend',
  '0004': 'Security',
  '0005': 'Realtime',
  '0006': 'AI/Backend',
  '0007': 'Resilience',
  '0007-amend': 'Resilience',
  '0008': 'Integrations',
  '0009': 'Security',
  '0010': 'Security',
  '0011': 'AI/Backend',
  '0012': 'Backend',
  '0013': 'Backend',
  '0015': 'Frontend',
  '0016': 'Multi-tenant',
  '0017': 'Backend',
  '0018': 'AI/Backend',
  '0019': 'Integrations',
  '0020': 'Integrations',
  '0021': 'Integrations',
  '0022': 'Data',
  '0022-phase2': 'Data',
  '0023': 'Integrations',
  '0024': 'Integrations',
  '0025': 'Realtime',
  '0026': 'Backend',
  '0027': 'Data',
  '0028': 'Integrations',
  '0029': 'AI/Backend',
  '0030': 'Resilience',
  '0031': 'Realtime',
  '0032': 'Multi-tenant',
  '0033': 'Security',
  '0034': 'Frontend',
  '0036': 'Data',
  '0038': 'Realtime',
  '040': 'AI/Backend',
  '0042': 'Frontend',
  '042': 'Infrastructure',
  '0043': 'Security',
  '0044': 'Realtime',
  '0045': 'AI/Backend',
  '0046': 'AI/Backend',
  '0048': 'Data',
  'AI-Latency': 'AI/Performance',
  'DO-Timers': 'Realtime',
  'KV-Tenant-Conventions': 'Data',
}

// Planned-but-unwritten ADR slots. Listed in sequence order.
const PLANNED_SLOTS = [
  { id: '0014', after: '0013', title: 'AI Capability Tier Ladder', domain: 'AI/Backend' },
  { id: '0035', after: '0034', title: 'SessionRoom Decomposition (Lobby / Live / Results DO)', domain: 'Realtime' },
  { id: '0037', after: '0036', title: 'Tenant Namespace Isolation (enforcement S81+)', domain: 'Security' },
  { id: '0039', after: '0038', title: 'AI Agent Runtime (superseded by ADR-0046)', domain: 'AI/Backend' },
  { id: '0041', after: '040', title: 'Customer-Managed Key (CMK) Envelope', domain: 'Security' },
  { id: '0047', after: '0046', title: 'Town-Hall Moderation Queue DO + Upvote Scale', domain: 'Realtime' },
]

function extractStatus(content) {
  // Try YAML front-matter style: "status: accepted"
  const yamlMatch = content.match(/^status:\s*(\S+)/im)
  if (yamlMatch) return capitalise(yamlMatch[1])
  // Try inline bold anywhere in file: "**Status:** Accepted (S66)" or "**Status**: Proposed"
  // Note: some files use **Status:** (colon inside bold) vs **Status**: (colon outside)
  const boldMatch = content.match(/\*\*[Ss]tatus:?\*\*:?\s*([A-Za-z]+)/m)
  if (boldMatch) return capitalise(boldMatch[1])
  // Try heading + next-line value: "## Status\nAccepted"
  const headingMatch = content.match(/^##\s+Status\s*\n+([A-Za-z]+)/m)
  if (headingMatch) return capitalise(headingMatch[1])
  return 'Unknown'
}

function capitalise(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function extractTitle(content) {
  const m = content.match(/^#\s+(.+)/m)
  if (!m) return '(untitled)'
  return m[1]
    // Strip "ADR-0001:" or "ADR-0001 —" or "ADR —" or "ADR:" prefixes
    .replace(/^ADR[-–]?\d*[a-z]?\s*(?::|\s*[–—])\s*/i, '')
    .trim()
}

function adrSortKey(id) {
  // Take only the leading digit sequence so "0022-phase2" → 22, not 222
  const m = id.match(/^(\d+)/)
  if (!m) return 9999 // named ADRs sort last
  return parseInt(m[1], 10)
}

// Parse files
const files = readdirSync(ADR_DIR)
  .filter(f => f.endsWith('.md') && f !== 'README.md')
  .sort()

const rows = []

for (const file of files) {
  const content = readFileSync(join(ADR_DIR, file), 'utf8')
  const title = extractTitle(content)
  const status = extractStatus(content)

  // Determine canonical id from filename
  // e.g. ADR-0001-do-per-session.md → 0001
  //      ADR-0007-amend-integrations-scope.md → 0007-amend
  //      ADR-0022-phase-2-write-routing.md → 0022-phase2
  //      ADR-040-kb-vector-pipeline.md → 040
  //      ADR-042-cloudflare-capability-expansion.md → 042
  //      ADR-AI-Latency.md → AI-Latency
  const base = file.replace(/\.md$/, '').replace(/^ADR-/, '')
  let id
  if (/^\d{3,4}-amend/.test(base)) {
    id = base.match(/^(\d{3,4})/)[1] + '-amend'
  } else if (/^\d{3,4}-phase[-_]?2/.test(base)) {
    id = base.match(/^(\d{3,4})/)[1] + '-phase2'
  } else if (/^\d{3,4}/.test(base)) {
    id = base.match(/^(\d{3,4})/)[1]
  } else {
    id = base // named ADR (AI-Latency, DO-Timers, KV-Tenant-Conventions)
  }

  const domain = DOMAIN_MAP[id] || 'General'
  rows.push({ id, file, title, domain, status, sortKey: adrSortKey(id), planned: false })
}

// Insert planned slots
for (const slot of PLANNED_SLOTS) {
  rows.push({
    id: slot.id,
    file: null,
    title: slot.title,
    domain: slot.domain,
    status: '\\[SLOT\\]',
    sortKey: adrSortKey(slot.id),
    planned: true,
  })
}

// Sort: numbered by numeric value, then named ADRs at the end.
// Within the same numeric sort key, the base id (no suffix) sorts first so
// amendments and phase-2 variants follow their parent.
rows.sort((a, b) => {
  if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey
  // Same numeric prefix — base id (no hyphen suffix) comes first
  const aBase = !a.id.includes('-')
  const bBase = !b.id.includes('-')
  if (aBase && !bBase) return -1
  if (!aBase && bBase) return 1
  return a.id.localeCompare(b.id)
})

const totalFiles = rows.filter(r => !r.planned).length
const totalSlots = rows.filter(r => r.planned).length

// Build table rows
const tableRows = rows.map(r => {
  if (r.planned) {
    const adrLabel = `ADR-${r.id}`
    return `| ${adrLabel} | ${r.title} | ${r.domain} | [SLOT] |`
  }
  const adrLabel = r.id.match(/^\d{3,4}$/) ? `ADR-${r.id}` : `ADR-${r.id}`
  return `| [${adrLabel}](./${r.file}) | ${r.title} | ${r.domain} | ${r.status} |`
})

const table = `| ADR | Title | Domain | Status |
|---|---|---|---|
${tableRows.join('\n')}`

const readme = `# Architecture Decision Records (ADRs)

${totalFiles} documented decisions (+ ${totalSlots} planned slots) that guide the Qesto architecture.

> **To regenerate this index:** \`node scripts/generate-adr-index.mjs --write\`

## Decision Summary

${table}

### Numbering notes

- **Dual files at 0007**: \`ADR-0007-circuit-breaker.md\` is the primary decision; \`ADR-0007-amend-integrations-scope.md\` is a formal amendment expanding scope.
- **Dual files at 0022**: \`ADR-0022-multi-region-foundation.md\` (Phase 1 read replicas) and \`ADR-0022-phase-2-write-routing.md\` (Phase 2 write routing).
- **Legacy 3-digit names**: \`ADR-040\` (KB vector pipeline) and \`ADR-042\` (Cloudflare capability expansion) predate the 4-digit zero-padded convention; their filenames are kept as-is to avoid breaking cross-references.
- **Named ADRs** (AI-Latency, DO-Timers, KV-Tenant-Conventions) were written before the numeric scheme was adopted.
- **[SLOT]** rows are ADRs planned in sprint notes or referenced by other ADRs but not yet written. Files will be added when the ADR is formally accepted.

---

**See**: [Main Knowledge Base](../README.md) | [Architecture Overview](../architecture/)
`

if (process.argv.includes('--write')) {
  writeFileSync(README_PATH, readme, 'utf8')
  console.log(`✅ Written: ${README_PATH}`)
  console.log(`   ${totalFiles} ADR files + ${totalSlots} planned slots`)
} else {
  process.stdout.write(readme)
}
