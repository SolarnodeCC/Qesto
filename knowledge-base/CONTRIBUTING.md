# Contributing to the Knowledge Base

Guidelines for adding, updating, and maintaining documentation.

## When Adding Documents

1. **Choose the right folder** based on type and domain
2. **Follow naming conventions**:
   - ADRs: `ADR-{number}-{kebab-case-title}.md`
   - Specs: `SPEC_{DOMAIN}.md`
   - Runbooks: `RUNBOOK_{PROCESS}.md`
   - Use kebab-case for all filenames
3. **Add YAML frontmatter**:
   ```yaml
   ---
   id: ADR-0010
   type: adr|specification|guide|policy
   domain: architecture|backend|frontend|data
   status: approved|draft|deprecated
   owner: @username or Team
   version: 1.0
   tags:
     - keyword
   relates_to:
     - ADR-0001
   ---
   ```
4. **Update parent README** if creating a new section
5. **Validate all links** before committing

## File Organization Rules

- **Core reference**: ADRs, core specs (SPEC_CORE, SPEC_BACKEND, etc.)
- **Product work**: Backlog, roadmap, planning, releases
- **Quality & Operations**: Testing, accessibility, audits, runbooks, monitoring
- **Governance**: Brand, design system, policies, standards
- **AI Research**: Decisions, evidence logs, strategic planning
- **Legacy**: Archive only (never delete without approval)

## Link Updates

When moving or renaming files:
1. Use `git mv` to preserve history
2. Update all internal references immediately
3. Run link validation scan
4. Document in CHANGELOG.md

## Metadata Best Practices

- Always set `owner` to enable accountability
- Keep `version` updated (semver recommended)
- Use `relates_to` for cross-document navigation
- Tag documents for semantic search

## Validation Checklist

- [ ] YAML frontmatter is valid
- [ ] Markdown syntax is correct
- [ ] All internal links resolve
- [ ] No broken image references
- [ ] File naming follows conventions
- [ ] Parent README updated (if new section)
- [ ] Commit message references related docs

---

**See**: [README.md](./README.md)
