# Backlog Items: Knowledge-Base Migration Follow-up

These items should be created in the project backlog to track the continuation of knowledge-base work after Week 1 migration is complete and merged to main.

---

## Week 2: YAML Frontmatter Phase 1 (ADRs)

**Item ID**: WEEK2-YAML-ADR  
**Type**: Technical debt / Infrastructure  
**Points**: 2  
**Owner**: Tech lead + Documentation lead  
**Sprint**: Week 2 (May 19–23, 2026)

### Acceptance Criteria
- [ ] All 12 ADRs in `knowledge-base/adr/` have YAML frontmatter with:
  - id, type, domain, status, version, owner, created, updated
  - 3–5 semantic tags
  - 2–3 `relates_to` links to related specs/ADRs
- [ ] No YAML syntax errors (validated by script or manual check)
- [ ] All `relates_to` links point to existing files
- [ ] Single commit: `docs(adr): add YAML frontmatter to 12 ADRs (Phase 1)`
- [ ] Validation report generated

### Description
After the knowledge-base migration to main (Week 1), add standardized YAML metadata headers to all 12 Architecture Decision Records for RAG optimization and semantic discovery. This is Phase 1 of the 3-phase YAML frontmatter rollout.

See `knowledge-base/metadata/YAML_ROLLOUT_PLAN.md` Phase 1 for detailed template and process.

### Notes
- Use templates from YAML_ROLLOUT_PLAN.md
- Effort: ~4–6 hours (15–20 min per file)
- Can be parallelized with other work
- Unblocks Phase 2 (specs) for Week 3

---

## Week 3: YAML Frontmatter Phase 2 (Specs)

**Item ID**: WEEK3-YAML-SPEC  
**Type**: Technical debt / Infrastructure  
**Points**: 3  
**Owner**: Tech lead + Backend/Frontend leads  
**Sprint**: Week 3 (May 26–30, 2026)

### Acceptance Criteria
- [ ] All 18 domain specifications (SPEC_CORE, SPEC_BACKEND, etc.) have YAML frontmatter
- [ ] All 8 product specifications (SPEC_PRODUCT, WEBSITE_DESIGN_SPEC, etc.) have YAML frontmatter
- [ ] All SPEC_INDEX.md and specifications/ README have YAML
- [ ] Domain field accurately categorizes each spec (backend|frontend|data|realtime|etc.)
- [ ] Audience field identifies 2–3 primary roles per spec
- [ ] All `relates_to` links verified
- [ ] Two commits:
  - `docs(spec): add YAML frontmatter to domain specs (Phase 2a)`
  - `docs(spec): add YAML frontmatter to product specs (Phase 2b)`
- [ ] Validation report generated

### Description
Phase 2 of YAML frontmatter rollout: tag all specifications with metadata for discoverability and RAG integration. These are critical docs for architecture and feature understanding.

See `knowledge-base/metadata/YAML_ROLLOUT_PLAN.md` Phase 2 for templates.

### Notes
- Effort: ~6–8 hours (20–30 min per file due to complexity)
- Split into domain specs (Monday–Tuesday) and product specs (Wednesday)
- Requires understanding of spec content to map audience and tags accurately
- Unblocks Phase 3 (remaining docs) for Week 4

---

## Week 4: YAML Frontmatter Phase 3 (Remaining Docs)

**Item ID**: WEEK4-YAML-REMAINING  
**Type**: Technical debt / Infrastructure  
**Points**: 5  
**Owner**: Documentation lead + cross-functional (QA, DevOps, PO, AI)  
**Sprint**: Week 4 (Jun 2–6, 2026)

### Acceptance Criteria
- [ ] All 111 remaining markdown files have YAML frontmatter:
  - 3 API docs
  - 3 Architecture guides
  - 17 Security/compliance docs
  - 30 Quality/audit/testing docs
  - 20 Operations/runbook docs
  - 30 Product/roadmap/planning docs
  - 8 Governance docs
  - 12 AI context docs
  - 10 Metadata templates
  - 1 Experiment checklist
- [ ] No files skipped; 141/141 total coverage
- [ ] Five commits by category (API/Arch/Sec, Quality/Ops, Product/Gov, AI/Meta/Exp, etc.)
- [ ] Automation script (`scripts/add-yaml-frontmatter.mjs`) tested and documented
- [ ] 20 files spot-checked for quality (coverage: one per 5-6 files)
- [ ] All `relates_to` links verified
- [ ] Final validation + coverage report signed off

### Description
Phase 3: Complete YAML frontmatter coverage across all remaining 111 markdown files in knowledge-base/. Includes runbooks, audit reports, quality checklists, product planning, governance, and AI reference docs.

See `knowledge-base/metadata/YAML_ROLLOUT_PLAN.md` Phase 3 for templates and automation script outline.

### Notes
- Effort: ~8–12 hours (10–15 min per file with automation)
- Create automation script in Week 3 and test on 5 files
- Daily commits (Monday through Friday, different categories each day)
- Spot-check 20 files to ensure quality
- High-value follow-up: enables vector embedding pipeline

---

## Month 1: Vector Embedding & Semantic Search

**Item ID**: MONTH1-VECTOR-SEARCH  
**Type**: Feature / Infrastructure  
**Points**: 5  
**Owner**: Backend engineer + AI lead  
**Sprint**: Month 1 (Week of Jun 9, 2026) — after YAML complete

### Acceptance Criteria
- [ ] YAML frontmatter validation complete (all 141 files tagged)
- [ ] Vector embedding pipeline designed (choice of embedding model)
- [ ] Integration with Cloudflare Vectorize confirmed (768d vectors, cosine)
- [ ] Semantic chunking strategy for knowledge-base/ documents implemented
- [ ] Batch embedding job created and tested on 10 sample docs
- [ ] Query interface (search by intent + filter by domain/type) working
- [ ] Results ranked by cosine similarity + relevance
- [ ] Integration with agent context window confirmed (docs returned ordered by relevance)
- [ ] Performance baseline: <500ms P95 for typical queries

### Description
After YAML frontmatter is complete, implement vector embedding for knowledge-base/ documents to enable semantic search and AI-powered knowledge synthesis. Agents will be able to find relevant docs by meaning, not just keywords.

**Related to**: YAML_ROLLOUT_PLAN, WEEK2-4 tasks

### Notes
- Depends on: All YAML frontmatter complete
- Uses existing: Cloudflare Vectorize (DECISIONS_VECTORIZE pool can be extended or new pool)
- Unblocks: AI-powered documentation synthesis, agent context optimization
- Timeline: 1–2 weeks design + implementation
- High impact: Enables agents to find docs by semantic meaning

---

## Month 1: Split Large Documents for RAG

**Item ID**: MONTH1-SPLIT-BACKLOG  
**Type**: Technical debt  
**Points**: 3  
**Owner**: Documentation lead  
**Sprint**: Month 1 (Week of Jun 9, 2026) — concurrent with vector work

### Acceptance Criteria
- [ ] BACKLOG_MASTER.md analyzed for optimal chunk boundaries
- [ ] BACKLOG_MASTER.md split into:
  - BACKLOG_OVERVIEW.md (metadata, version, stats)
  - BACKLOG_P0.md (priority 0 items)
  - BACKLOG_P1.md (priority 1 items)
  - BACKLOG_P2_FEATURES.md (P2 features)
  - BACKLOG_P2_TECHNICAL.md (P2 technical debt)
- [ ] Cross-references updated in BACKLOG_OVERVIEW
- [ ] SPRINT_PLAN_MASTER.md analyzed for natural splits (by quarter or by category)
- [ ] Any other oversized docs (>2000 tokens) split by semantic boundaries
- [ ] Links verified post-split
- [ ] All original content preserved (no loss)

### Description
Large documents (BACKLOG_MASTER.md 67K, SPRINT_PLAN_MASTER.md 52K) don't chunk well for vector search. Split by semantic boundaries (priority level, time period, category) to create smaller, focused documents that RAG systems can embed and retrieve more effectively.

**Related to**: YAML_ROLLOUT_PLAN, MONTH1-VECTOR-SEARCH

### Notes
- Improves RAG effectiveness: smaller chunks = better relevance
- Preserves discoverability: overview docs link to all pieces
- Unblocks: Better semantic search for backlog + planning queries
- Effort: ~4–6 hours (analysis + splitting + link updates)

---

## Month 2+: Advanced Features (Optional)

### Document Relationship Graph
**Estimated Points**: 5  
**Owner**: Documentation lead + Architect  
**Purpose**: Create visual map of how docs relate (ADRs → Specs → Implementation → Roadmap)

### AI-Powered Knowledge Synthesis
**Estimated Points**: 8  
**Owner**: AI lead + Backend  
**Purpose**: Build agent skill that synthesizes knowledge from multiple docs to answer "why" questions

### Auto-Generated API Docs
**Estimated Points**: 5  
**Owner**: Backend + Documentation  
**Purpose**: Generate API reference from code annotations + link to specs

---

## Definitions

### Story Points (Agile scale)
- **1 pt**: <1 hour (simple, no dependencies)
- **2 pts**: 2–4 hours (straightforward, 1 file/area)
- **3 pts**: 4–8 hours (moderate, 2–3 files, some uncertainty)
- **5 pts**: 8–16 hours (complex, multiple files, coordination)
- **8 pts**: 16–32 hours (very complex, team effort)

### Acceptance Criteria Keys
- All YAML frontmatter MUST be valid (no syntax errors)
- All links MUST be verified before commit
- All changes MUST be tested/reviewed before merge
- Reports MUST be generated and included in commit message

---

## Success Metrics

| Milestone | Target | Completion |
|-----------|--------|------------|
| Week 1: Migration to main | May 15 | ✅ In progress |
| Week 2: YAML ADRs | May 23 | ⏳ Pending merge |
| Week 3: YAML Specs | May 30 | ⏳ Pending merge |
| Week 4: YAML Remaining | Jun 6 | ⏳ Pending merge |
| Month 1: Vector pipeline | Jun 20 | ⏳ Pending YAML complete |
| Month 1: Split large docs | Jun 20 | ⏳ Pending YAML complete |
| **Goal**: 100% docs tagged + searchable | Jun 30 | ⏳ On track |

---

## Related Documentation

- [YAML_ROLLOUT_PLAN.md](../YAML_ROLLOUT_PLAN.md) — Detailed 3-phase rollout schedule
- [WEEK1_INTEGRATION_SUMMARY.md](./WEEK1_INTEGRATION_SUMMARY.md) — Week 1 completion report
- [MIGRATION_MAP.md](./MIGRATION_MAP.md) — Old → new path mapping
- [knowledge-base/README.md](../../README.md) — Navigation hub

---

## Next Steps

1. **Merge Week 1 branch** (`claude/migrate-knowledge-base-I0PpQ` → `main`)
2. **Create backlog items** from this document (WEEK2-YAML-ADR, WEEK3-YAML-SPEC, WEEK4-YAML-REMAINING, MONTH1-VECTOR-SEARCH, MONTH1-SPLIT-BACKLOG)
3. **Start Phase 1** (Week 2): Apply YAML frontmatter to 12 ADRs
4. **Monitor progress**: Daily standups during Week 2–4
5. **Complete by end of Month 1**: All docs tagged + vector search ready

