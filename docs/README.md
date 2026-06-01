# Agent documentation hub (`docs/`)

**Product and operations documentation lives in [`/knowledge-base/`](../knowledge-base/README.md).** This folder keeps only what agents and build tooling need at short, stable paths.

## Agent routers (read these first)

| File | Purpose |
|------|---------|
| [architecture.md](./architecture.md) | Runtime stack, session state machine, storage bindings |
| [boundaries.md](./boundaries.md) | Layer ownership (`agent/owner-map.json`) |
| [testing.md](./testing.md) | Vitest, Playwright, proof lanes |
| [ci-local.md](./ci-local.md) | Run CI checks locally |
| [agent-native-standard.md](./agent-native-standard.md) | Jankurai / agent-native policy (vendored) |
| [release.md](./release.md) | Release checklist → [RELEASE_GUIDE](../knowledge-base/product/releases/RELEASE_GUIDE.md) |

## Build artefact (not prose docs)

| Path | Purpose |
|------|---------|
| [spec/design-tokens.json](./spec/design-tokens.json) | Source of truth for `npm run tokens:build` → `src/ui/tokens.ts` |

See [DESIGN_TOKENS_README](../knowledge-base/specifications/domain/DESIGN_TOKENS_README.md) for token governance.

## Migrated locations (2026-06)

Former `docs/*.md` operational guides, sprint specs, and validation docs are in the knowledge base:

- **Specifications & sprints** → [`knowledge-base/specifications/`](../knowledge-base/specifications/), [`knowledge-base/product/planning/sprints/`](../knowledge-base/product/planning/sprints/)
- **Deployment & staging** → [`knowledge-base/operations/deployment/`](../knowledge-base/operations/deployment/)
- **Help assistant** → [`knowledge-base/operations/help-assistant/`](../knowledge-base/operations/help-assistant/)
- **Validation** → [`knowledge-base/architecture/VALIDATION_PATTERNS.md`](../knowledge-base/architecture/VALIDATION_PATTERNS.md), [`VALIDATION_STRATEGY.md`](../knowledge-base/architecture/VALIDATION_STRATEGY.md)
- **Analytics outputs** → [`knowledge-base/operations/monitoring/analytics/`](../knowledge-base/operations/monitoring/analytics/)

Legacy PowerPoint decks may remain in this folder until archived.

**Contributing:** [knowledge-base/CONTRIBUTING.md](../knowledge-base/CONTRIBUTING.md)
