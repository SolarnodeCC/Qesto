---
id: AI-CONTEXT
type: reference
domain: ai
category: agents
status: active
version: 1.0
created: 2026-04-01
updated: 2026-05-11
tags:
  - ai
  - agents
  - skills
  - research
relates_to:
  - AGENT_SYSTEM_OVERVIEW
---

# Agent & Skill Scorecard Spec

_Hub: [Documentation map](../README.md)._

## Reporting cadence
- Monthly, published in `docs/` with date-stamped snapshot.

## KPIs
1. Escaped defect rate
   - Formula: production defects / total shipped stories.
2. PR rework rounds
   - Formula: avg revision rounds per merged PR.
3. Review turnaround
   - Formula: median hours PR-open to approved.
4. Test failure recurrence
   - Formula: repeated CI failures on same test area per month.
5. Accessibility regression count
   - Formula: count of new a11y defects introduced post-merge.
6. Security finding recurrence
   - Formula: repeated security class findings within rolling 90 days.

## Thresholds
- Green: target met.
- Yellow: watchlist, action item required.
- Red: trigger corrective sprint action.

## Data sources
- CI logs, test reports, backlog defect tags, release audit notes.

## Monthly retro output
- Top 3 regressions
- Top 3 improvements
- Next month remediation actions (owner + due date)
