# YAML Frontmatter Rollout Plan

**Goal**: Add standardized YAML metadata headers to all 141 markdown files in knowledge-base/ for AI RAG optimization, discoverability, and document tracing.

**Timeline**: 3 weeks (Week 2–4, concurrent with other work)  
**Total effort**: ~30 hours across team  
**Deliverable**: 100% of files tagged with YAML frontmatter + validation report

---

## Phase 1: ADRs (Week 2)

**Files**: 12 Architecture Decision Records  
**Duration**: 4–6 hours (Monday–Tuesday)  
**Owner**: Tech lead + Documentation lead  
**Effort per file**: 15–20 min

### Files in scope
```
knowledge-base/adr/
├── ADR-0001-do-per-session.md
├── ADR-0002-ai-streaming-transport.md
├── ADR-0003-preflight-validation-contract.md
├── ADR-0004-custom-rbac-authorization.md
├── ADR-0005-do-protocol-versioning.md
├── ADR-0006-workers-ai-capabilities.md
├── ADR-0007-circuit-breaker.md
├── ADR-0008-integration-foundation.md
├── ADR-0009-pii-sanitization.md
├── ADR-AI-Latency.md
├── ADR-DO-Timers.md
└── ADR-KV-Tenant-Conventions.md
```

### Template for ADRs
```yaml
---
id: ADR-0001
type: adr
domain: architecture
status: approved
version: 1.0
owner: @Architecture team
created: 2026-04-30
updated: 2026-05-11
tags:
  - durable-objects
  - session-state
  - realtime
relates_to:
  - SPEC_REALTIME
  - ADR-0005-do-protocol-versioning
  - REQ-SESSION-LIFECYCLE
---
```

### Process
1. Read ADR content (extract status, date, related docs)
2. Apply YAML header with ID + domain + status
3. Add 3–5 semantic tags (from ADR content)
4. Link to 2–3 related specs/requirements
5. Commit in batch: `git commit -m "docs(adr): add YAML frontmatter to ADRs (Phase 1)"`
6. Run validation: verify YAML syntax, confirm all files readable

### Success criteria
- [ ] All 12 ADRs have YAML frontmatter
- [ ] No YAML syntax errors (`yamllint` clean or manual check)
- [ ] All `relates_to` links point to existing files
- [ ] Commit message references Phase 1
- [ ] Validation report generated

---

## Phase 2: Specifications (Week 3)

**Files**: 18 domain + product specifications  
**Duration**: 6–8 hours (Monday–Wednesday)  
**Owner**: Tech lead + Backend/Frontend leads  
**Effort per file**: 20–30 min

### Files in scope
```
knowledge-base/specifications/domain/
├── SPEC_CORE.md
├── SPEC_BACKEND.md
├── SPEC_FRONTEND.md
├── SPEC_DATAMODEL.md
├── SPEC_REALTIME.md
├── SPEC_INTEGRATIONS.md
├── SPEC_DEPLOYMENT.md
├── SPEC_DESIGN_SYSTEM_OVERVIEW.md
└── DESIGN_TOKENS_README.md

knowledge-base/specifications/product/
├── SPEC_PRODUCT.md
├── WEBSITE_DESIGN_SPEC.md
└── (others)

knowledge-base/specifications/
├── SPEC_INDEX.md
├── README.md
└── (includes/)
```

### Template for Domain Specs
```yaml
---
id: SPEC-BACKEND
type: specification
domain: backend
category: endpoints|services|middleware|auth
status: active
version: 2.1
owner: @Backend team
created: 2026-03-01
updated: 2026-05-11
audience:
  - Backend engineer
  - API/middleware lead
  - Architect
tags:
  - hono
  - cloudflare-workers
  - api-routes
  - rest-endpoints
relates_to:
  - SPEC_CORE
  - SPEC_DATAMODEL
  - ADR-0001-do-per-session
  - SEC-AUTH-01
  - REQ-API-VERSIONING
---
```

### Template for Product Specs
```yaml
---
id: SPEC-PRODUCT
type: specification
domain: product
category: features|business|planning
status: active
version: 1.0
owner: @Product team
created: 2026-04-01
updated: 2026-05-11
tags:
  - session-lifecycle
  - question-types
  - realtime-tallies
  - ai-recap
relates_to:
  - SPEC_CORE
  - SPEC_FRONTEND
  - ADR-0002-ai-streaming-transport
  - ROADMAP_FULL
---
```

### Process
1. Extract spec domain (backend, frontend, data, realtime, integrations, deployment, design)
2. Identify primary audience from spec content
3. Extract 5–8 semantic tags from content
4. List 3–5 related specs/ADRs/requirements
5. Commit in batch: `git commit -m "docs(spec): add YAML frontmatter to domain specs (Phase 2a)"`
6. Repeat for product specs: `git commit -m "docs(spec): add YAML frontmatter to product specs (Phase 2b)"`

### Success criteria
- [ ] All 18 specs have YAML frontmatter
- [ ] Domain field accurately categorizes specs
- [ ] `audience` field maps to 2–3 primary roles
- [ ] All `relates_to` links valid
- [ ] Two separate commits (domain specs, product specs)
- [ ] Validation report generated

---

## Phase 3: Remaining Docs (Week 4)

**Files**: 111 remaining markdown files (ADRs done, specs done = 141 − 12 − 18 = 111)  
**Duration**: 8–12 hours (distributed across week)  
**Owner**: Documentation lead + cross-functional  
**Effort per file**: 10–15 min (more automated)

### Categories
```
/api/ (3 files)                         type: api
/architecture/ (3 files, excl. ADRs)   type: guide
/security/ (6 files + audits/ 11)      type: security
/quality/ (30 files)                    type: audit|guide|checklist
/operations/ (20 files)                 type: runbook|guide
/product/ (30 files)                    type: planning|roadmap|backlog
/governance/ (8 files)                  type: guide|glossary
/ai-context/ (12 files)                type: reference|guide
/metadata/ (10 files)                   type: schema|template
/experiments/ (1 file)                  type: checklist
```

### Template for APIs
```yaml
---
id: API-REST
type: api
category: rest|websocket|realtime
status: active
version: 1.0
owner: @Backend team
created: 2026-03-01
updated: 2026-05-11
tags:
  - endpoints
  - authentication
  - response-format
relates_to:
  - SPEC_BACKEND
  - ADR-0001-do-per-session
---
```

### Template for Runbooks/Guides
```yaml
---
id: RUNBOOK-SESSION-RECONCILE
type: runbook
category: incident|deployment|monitoring
status: active
version: 1.0
owner: @DevOps team
created: 2026-04-15
updated: 2026-05-11
tags:
  - incident-response
  - durable-objects
  - session-state
severity: high
relates_to:
  - ADR-0001-do-per-session
  - SPEC_REALTIME
  - DEPLOYMENT_PIPELINE
---
```

### Template for Audits/Reports
```yaml
---
id: AUDIT-CODE-COMPLEXITY
type: audit
category: code|design|architecture|security
status: active
version: 1.0
owner: @QA team
created: 2026-04-20
updated: 2026-05-11
audit_date: 2026-04-20
findings_critical: 0
findings_high: 3
findings_medium: 12
tags:
  - complexity-analysis
  - refactoring
relates_to:
  - SPEC_BACKEND
  - REMEDIATION_PLAN
---
```

### Process (Automated + Manual)
1. Create `scripts/add-yaml-frontmatter.mjs` (automation script)
   - Scans all markdown files in knowledge-base/
   - For each file, extract:
     - Title (from first H1)
     - Category (infer from folder + content)
     - Key tags (from headings, keywords)
   - Generates YAML template (ready for human review)
   
2. Manual review pass (documentation lead)
   - Spot-check 20 files (every 5th file)
   - Verify `relates_to` links are real
   - Adjust tags if needed
   
3. Batch commits (daily)
   - Day 1: /api/ + /architecture/
   - Day 2: /security/ + /operations/
   - Day 3: /quality/
   - Day 4: /product/ + /governance/
   - Day 5: /ai-context/ + /metadata/ + /experiments/
   - Commit format: `docs(<category>): add YAML frontmatter to <count> files`

### Success criteria
- [ ] 111 files have YAML frontmatter
- [ ] Auto-script tested and working
- [ ] Spot-check completed (20 files reviewed)
- [ ] All `relates_to` links valid
- [ ] Five separate commits (by category/folder)
- [ ] Final validation report generated

---

## Validation & Quality Gates

### Per-Phase Validation
After each phase, run:

```bash
# Check YAML syntax
find knowledge-base -name "*.md" -exec \
  head -20 {} \; | grep -A 5 "^---$" | yamllint - || echo "Manual check OK"

# Verify links
node validate-yaml-links.mjs

# Count progress
echo "ADRs with YAML: $(grep -l '^---' knowledge-base/adr/*.md | wc -l)"
echo "Specs with YAML: $(grep -l '^---' knowledge-base/specifications/**/*.md | wc -l)"
```

### Final Report
Generate `knowledge-base/metadata/migration/YAML_FRONTMATTER_REPORT.md`:
```
## YAML Frontmatter Rollout Report

**Completion Date**: 2026-05-31  
**Total Files Tagged**: 141 / 141 (100%)

### By Phase
| Phase | Files | Status | Date |
|-------|-------|--------|------|
| Phase 1 (ADRs) | 12 | ✅ Complete | 2026-05-20 |
| Phase 2 (Specs) | 18 | ✅ Complete | 2026-05-27 |
| Phase 3 (Remaining) | 111 | ✅ Complete | 2026-05-31 |

### Validation Results
- ✅ All files have valid YAML frontmatter
- ✅ No syntax errors
- ✅ All `relates_to` links verified
- ✅ Avg tags per file: 4.2
- ✅ Avg relates_to per file: 2.8

### Ready for
- Vector embedding pipeline (Month 1)
- Semantic search implementation
- RAG optimization for AI agents
```

---

## Automation Script Outline

**File**: `scripts/add-yaml-frontmatter.mjs`

```javascript
// Pseudocode
import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

async function addYAMLFrontmatter() {
  const mdFiles = await glob('knowledge-base/**/*.md')
  
  for (const file of mdFiles) {
    const content = readFileSync(file, 'utf8')
    
    // Skip if already has frontmatter
    if (content.startsWith('---')) continue
    
    // Extract metadata
    const title = extractFirstHeading(content)
    const domain = inferDomain(file, content)
    const tags = extractTags(content)
    const relatedIds = extractRelatedDocs(content)
    
    // Generate YAML
    const yaml = generateYAML({
      id: generateID(title),
      type: inferType(file, content),
      domain,
      tags,
      relates_to: relatedIds,
      created: getCreatedDate(file),
      updated: new Date().toISOString().split('T')[0]
    })
    
    // Prepend to file
    const newContent = yaml + '\n' + content
    writeFileSync(file, newContent)
  }
}

function generateID(title) {
  // SPEC_BACKEND → id: SPEC-BACKEND
  // ADR-0001 → id: ADR-0001
  // My Guide → id: MY-GUIDE
  return title.toUpperCase().replace(/\s+/g, '-')
}

// ... other helpers
```

---

## Timeline & Resource Allocation

| Week | Task | Owner | Hours | Mon | Tue | Wed | Thu | Fri |
|------|------|-------|-------|-----|-----|-----|-----|-----|
| **Week 2** | Phase 1: ADRs | Tech lead | 4–6 | ■■ | ■■ |   |   |   |
| **Week 3** | Phase 2a: Domain specs | Tech + Back | 4–5 |   |   | ■■■ | ■ |   |
| **Week 3** | Phase 2b: Product specs | Tech + Front | 2–3 |   |   |   | ■■ |   |
| **Week 4** | Phase 3a: API/Arch/Sec | Docs + Tech | 3–4 | ■■ |   |   |   |   |
| **Week 4** | Phase 3b: Quality/Ops | Docs + QA | 4–5 |   | ■■■ |   |   |   |
| **Week 4** | Phase 3c: Product/Gov | Docs + PO | 2–3 |   |   | ■■ |   |   |
| **Week 4** | Phase 3d: AI/Meta/Exp | Docs + AI | 2–3 |   |   |   | ■■ |   |
| **Total** | | | ~30h | — | — | — | — | — |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| YAML syntax errors | Medium | Low | Use automation script + spot-check 20% |
| Broken relates_to links | Low | Medium | Validate all links in script before writing |
| Missing semantic tags | High | Low | Extract automatically, allow manual override |
| Merge conflicts (concurrent work) | Low | Medium | Merge metadata changes frequently to main |
| Incomplete coverage | Low | Medium | Daily checklist + final report |

---

## Success Definition

✅ **When all 141 files have**:
- Valid YAML frontmatter (no syntax errors)
- `id`, `type`, `domain`, `status`, `version`, `owner`, `created`, `updated`
- 3–8 semantic tags
- 2–5 `relates_to` links to other docs/ADRs/reqs
- All links verified to point to existing files
- Final validation report signed off

**Go/No-go Gate**: If >95% coverage + 0 broken links → Ready for vector embedding pipeline.

---

## Follow-up (Post-Rollout)

After YAML frontmatter complete:
1. **Week 5**: Design document relationship graph (optional, high value)
2. **Month 1**: Integrate with vector embedding pipeline for semantic search
3. **Month 2**: Build AI-powered knowledge synthesis tool (agent context optimization)
