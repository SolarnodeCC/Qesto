# Qesto — QA & Test Strategy (Current)

_Last verified: 2026-04-06 (UTC)_

## 1. Test layers in repository
- **Vitest unit/integration** in `tests/technical`, `tests/data-security`.
- **UI content guards** in `tests/functional/ui` to prevent regressions (e.g., Solutions page image source policy).
- **WebSocket/DO tests** for session state machine.
- **Playwright E2E/a11y** scenarios.
- **Load/perf scripts** under `tests/load` and `scripts/perf`.

## 2. Quality gates
1. `npm run type-check`
2. `npm test`
3. targeted route checks (`npm run check:api`)
4. i18n key checks (`npm run check:i18n`)
5. optional E2E / load validations before release candidates

## 3. Current status summary
- Strong breadth of automated tests exists across API, auth, billing, data security, and realtime flows.
- Realtime ranking coverage includes top-choice aggregation behavior in WebSocket tests (`tests/technical/websockets/sessionRoom.test.ts`).
- Next maturity step: stricter release gates combining smoke E2E + perf budget + a11y checks by default.
