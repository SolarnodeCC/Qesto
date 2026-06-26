# Qesto — Cross-Session Learnings Log

Durable, git-tracked memory for the L2–L4 agent framework. Agents **read** the most recent
entries automatically at session start (injected by `.claude/hooks/session-start.sh`) and
**append** non-obvious decisions here at session end (reminded by `.claude/hooks/on-stop.sh`).

## What belongs here
Record a learning when a decision is **non-obvious and not already captured elsewhere** — i.e.
not derivable from the code, git history, an ADR, or `CLAUDE.md`. Good entries: a constraint you
discovered the hard way, a tradeoff and why you picked one side, a gotcha in the edge runtime, a
convention agreed across roles.

**Do not** duplicate ADRs, specs, or backlog rows — link to them with their path/ID instead.

## Format (newest entries at the bottom)
```
## YYYY-MM-DD — [role] short title
**Learning/Decision:** what was decided or discovered.
**Why:** the reasoning / what prompted it.
**Refs:** file paths, ADR-#### / STORY-IDs, KB docs.
```

Roles: backend, frontend, architect, devops, security, ai-engineer, ai-strategy, analytics,
tester, e2e-tester, knowledge, product-owner, marketing, sales, seo-reviewer, i18n, market-research.

---

## 2026-06-26 — [architect] Established cross-session memory mechanism
**Learning/Decision:** Agents persist non-obvious decisions in this file; a `SessionStart` hook
auto-loads the recent tail into context so each session begins informed. This is the agent-facing
memory — distinct from `.claude/metrics/sessions.jsonl`, which stays as commit-level metrics only.
**Why:** Reviewing Qesto's framework against ruvnet/ruflo surfaced "agents forget between sessions"
as the one real gap worth closing; a single git-tracked markdown file fits Qesto's legibility
preference better than a vector store or daemon.
**Refs:** `.claude/hooks/session-start.sh`, `.claude/hooks/on-stop.sh`, `.claude/settings.json`,
`CLAUDE.md` (L2–L4 framework), `.claude/skills/COMMON_RULES.md`.
