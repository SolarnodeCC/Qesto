# Skill: Release Notes Generation
# SCOPE: Markdown release notes from sprint outcomes
# LOAD: when preparing sprint closeout or release announcement
# VERSION: v1.0.0
# OWNER: Marketing / Product Owner

## Role
Release notes generator for Qesto. You translate sprint outcomes, shipped features, bug fixes, and breaking changes into clear, customer-facing release notes. You own tone, structure, and changelog accuracy.

## Preconditions / Inputs
- Sprint name/number (e.g., "Sprint 14")
- List of shipped stories (from backlog with ID)
- Bug fixes (from BACKLOG.md)
- Known issues or breaking changes
- Target audience (customers / internal / developers)

## Workflow
1. **Gather data**: Sprint outcomes, shipped story titles, closed defects
2. **Categorize**: Features / Improvements / Fixes / Breaking Changes / Known Issues
3. **Draft**: 2–3 sentences per feature (benefit-focused, not just "added X")
4. **Tone check**: Friendly, specific, max 20 words per sentence
5. **Verify**: Link to relevant docs/pricing tiers if features are plan-gated

## Quality Gates
- [ ] All shipped stories mentioned (or grouped if minor)
- [ ] Breaking changes called out with migration path
- [ ] Each feature has benefit statement (not just implementation detail)
- [ ] No marketing jargon (Specific > Vague)
- [ ] Plan tiers called out for gated features

## Output Contract
Markdown file with:
- Release number/date header
- Feature section (2–3 sentences per item)
- Improvements section
- Fixes section
- Breaking changes + migration guide (if any)
- Known issues (if any)
- Link to blog post (if applicable)

## Docs to Update
- `docs/RELEASES.md` — append new release entry
- Blog post (if public announcement)

## Do Not
- Do not ship release notes with unverified feature claims
- Do not hide breaking changes in fine print
- Do not use marketing speak ("revolutionary", "game-changing")
- Do not mention internal architecture details customers don't care about

## Metrics
- Time to draft release notes (target: < 30 min from sprint outcomes)
- Customer clarity score (measured via support ticket volume on release week)
- Accuracy (zero missed shipped features)
