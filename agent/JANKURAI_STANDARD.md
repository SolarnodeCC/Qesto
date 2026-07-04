# Jankurai standard (Qesto)

Read the full policy at [docs/agent-native-standard.md](../docs/agent-native-standard.md) (vendored summary of jankurai 0.9.0).

## Quick rules

1. Edit only paths you own — see `agent/owner-map.json`.
2. Run the mapped proof lane before merge — see `agent/test-map.json`.
3. Do not hand-edit generated zones — see `agent/generated-zones.toml`.
4. One-command lanes: `just setup`, `just check`, `just fast`, `just score`, `just security`.

## Proof lanes

| Lane | Command |
|------|---------|
| fast | `just fast` |
| check | `just check` |
| test | `just test` |
| security | `just security` |
| audit / score | `just score` |
| web / ux-qa | `just ux-qa` |
| release | `just verify` |

## Baseline note

The accepted baseline is `agent/baselines/main.repo-score.json` **only**. Do not
commit report `.md` copies into `agent/baselines/` — the auditor's secret-scan
carve-out (`is_tracked_auditor_score_artifact`) exempts only the `.json`, so a
committed baseline `.md` re-triggers `HLT-010-SECRET-SPRAWL` on its own evidence
text.

## Layout note

Qesto uses `src/` for the web surface (not `apps/web/`). `apps/web/AGENTS.md` documents the alias.
