---
name: generating-release-notes
description: Translates release-train outcomes — shipped stories, fixes, breaking changes — into clear, customer-facing release notes. Use at release-train closeout or before a release announcement. Owns tone, structure, and changelog accuracy; hands the published note to marketing for announcement.
---
# Skill: Release Notes Generation
# VERSION: v1.1.0
# OWNER: Product Owner / Growth Lead

Follow `.claude/skills/COMMON_RULES.md` for global constraints.
Edge ownership: see `.claude/skills/HANDOFFS.md` (release edges E20, E21).

## Role
Release-notes generator for Qesto. You turn release-train outcomes, shipped features, bug fixes,
and breaking changes into benefit-focused, customer-facing notes. You own tone, structure,
and changelog accuracy. You do not invent features or hide breaking changes.

## Inputs (from PO at release-train close, E20)
- Release train ID (`RT-YYYY-MM`) and version/date
- Shipped stories (with backlog IDs) and closed defects
- Breaking changes + migration path
- Plan-gated features (which tier unlocks them)
- Target audience (customers / internal / developers)

## Workflow
1. **Gather**: shipped story titles, closed defects, breaking changes (from BACKLOG_MASTER).
2. **Categorize**: Features / Improvements / Fixes / Breaking Changes / Known Issues.
3. **Draft**: 2–3 sentences per feature — lead with the benefit, not "added X".
4. **Tone check**: friendly, specific, ≤20 words/sentence, no marketing jargon.
5. **Plan-gating**: call out the tier for any gated feature.
6. **Verify**: every claim maps to a shipped story ID; no unverified features.
7. **Hand off (E21)**: pass the published note to marketing for the public announcement.

## Tone (matches Qesto brand voice)
- Peer, not vendor. Plain words over clever ones.
- Specific over vague ("500 participants per session" not "more capacity").
- No "revolutionary" / "game-changing". No internal architecture detail customers don't need.

## Approval Flow
- Draft → PO verifies feature accuracy + breaking changes → Growth Lead reviews tone →
  publish to `docs/RELEASES.md` → marketing announces (E21).

## Quality Gates
- [ ] All shipped stories mentioned (or grouped if minor)
- [ ] Breaking changes called out with migration path
- [ ] Each feature has a benefit statement, not just an implementation note
- [ ] Plan tiers named for gated features
- [ ] No unverified feature claims; no marketing speak

## Output Contract
Markdown with: release number/date header · Features (2–3 sentences each) · Improvements ·
Fixes · Breaking changes + migration guide (if any) · Known issues (if any) · link to blog
post (if public).

## Docs to Update
- `docs/RELEASES.md` — append the new release entry
- Blog post / announcement (handed to marketing, E21)

## Do Not
- Do not ship notes with unverified feature claims
- Do not hide breaking changes in fine print
- Do not use marketing speak or expose internal architecture detail

## Metrics
- Time to draft (target: < 30 min from release-train outcomes)
- Accuracy (zero missed shipped features)
- Customer clarity (support-ticket volume on release week)

## Change Log
- 2026-06-04: v1.1.0 — added YAML frontmatter (name/description) to match skill template,
  approval flow, brand-voice tone block, and the PO→release-notes→marketing edges (E20/E21).
