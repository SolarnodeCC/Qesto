# Qesto — Claude Code Configuration (`.claude/`)

This is the prompt-asset layer for Qesto's AI agent framework (L2–L4 in `CLAUDE.md`).
It is **deliberately lean and convention-driven**: a small, owned, versioned set of
agents and skills, with every convention enforced in CI so it cannot silently drift.

## Layout

| Path | What | Count |
|---|---|---|
| `agents/*.md` | Role sub-agents (thin dispatchers). Frontmatter: `name`, `description`, `model`, `version`, `owner`. Each references `COMMON_RULES.md`. | 17 |
| `skills/*.md` | Role knowledge packs (the depth behind each agent). | 26 |
| `skills/COMMON_RULES.md` | **Single source of truth** for global invariants + the prompt-injection defense baseline. Agents inherit it by reference — never by copy. | 1 |
| `skills/HANDOFFS.md` | Cross-role **edge ownership** graph (producer → artifact → consumer → owner). | 1 |
| `skills/OWNERS.md` | Ownership matrix: every agent/skill → a DRI role. | 1 |
| `hooks/*.sh` | L3 safety + observability hooks (PreToolUse / PostToolUse / Stop). | 5 |
| `schemas/*.json` | Structured-output schemas (ADR, API contract, story). | 3 |
| `settings.json` | Hook wiring (committed). `settings.local.json` is per-developer (gitignored). |

## Conventions (enforced)

`scripts/check-claude-config.mjs` (run via `npm run check:claude-config`, in `check:rc`
and `ops/ci/quality-gates.sh`) fails the build unless:

1. Every agent has `name` + `model` (`opus|sonnet|haiku`) + `version` + `owner` frontmatter.
2. Every agent body references `COMMON_RULES.md` (the safety baseline).
3. `OWNERS.md` and the filesystem are in sync **both ways** for agents and skills.
4. No agent or skill links to a non-existent `.claude/skills/<x>.md`.
5. `COMMON_RULES.md` and `HANDOFFS.md` carry `VERSION` + `OWNER` headers.
6. `COMMON_RULES.md` still contains the prompt-injection / untrusted-content defense.

**Adding an agent or skill?** Add the file, list it in `OWNERS.md`, (for agents) add the
`COMMON_RULES.md` reference and full frontmatter, then run `npm run check:claude-config`.

## Safety & governance

- **Single-source policy.** Global rules live once in `COMMON_RULES.md`; agents reference
  it. The prompt-injection defense baseline (rule 13) propagates to all agents with no
  per-file copies — the anti-drift pattern, enforced by check #6 above.
- **Safety hooks** (`pre-bash.sh`, `pre-edit.sh`, `post-edit.sh`) block force-push to main,
  inline secrets, destructive D1 ops, and `rm -rf` of source dirs.
- **Versioning.** `COMMON_RULES.md` / `HANDOFFS.md` are semver'd with a change log; agents
  carry a `version`. Bump on change.

## Observability

The `session-metrics.sh` Stop hook appends one JSON line per session to
`.claude/metrics/sessions.jsonl` (gitignored, local only): branch, HEAD sha, files changed,
TS/TSX touches, insertions/deletions. Summarize with:

```bash
npm run claude:metrics
```

This gives the config layer a usage/activity signal for spotting unused assets and
sizing change.
