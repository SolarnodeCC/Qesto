# Qesto — QA & Test Strategy (Current)

_Hub: [Documentation map](./README.md)._

_Last verified: 2026-05-01 (UTC)_

## 1. Test layers in repository
- **Vitest unit/integration** in `tests/unit` and `tests/integration`.
- **A11y/stress coverage** in `tests/a11y` and `tests/stress`.
- **WebSocket/DO tests** for session state machine.
- **Playwright E2E/a11y** scenarios.
- **Perf scripts** under `scripts/perf`.

## 2. Quality gates
1. `npm run typecheck`
2. `npm test`
3. baseline checks (`npm run check:baseline`)
4. i18n key checks (`npm run check:i18n`)
5. design-token checks (`npm run check:design-tokens` and `npm run check:tokens-drift`)
6. optional E2E / stress / a11y validations before release candidates

## 3. Current status summary
- Strong breadth of automated tests exists across API, auth, billing, data security, and realtime flows.
- Realtime ranking coverage includes top-choice aggregation behavior in WebSocket tests (`tests/technical/websockets/sessionRoom.test.ts`).
- Next maturity step: stricter release gates combining smoke E2E + perf budget + a11y checks by default.
