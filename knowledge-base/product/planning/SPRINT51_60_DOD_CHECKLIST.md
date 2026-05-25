# Sprint 51–60 — Definition of Done Checklist

_Automated file gates: `npm run check:sprint-51-60`. Staging: [`STAGING_RITUALS_S51_60.md`](../../operations/STAGING_RITUALS_S51_60.md)._

## Sprint 50 (v3.0 RC)

- [x] Merged to `main` (PR #332)
- [x] `PARTNER_TIERS.md`, `v3.0.0-RC.md`

## Sprint 51

- [x] `OBSIDIAN_KB_STANDARD.md`, Notion archive
- [x] ADR-0022 Phase 2, `resolveWriteRegion`, failover admin
- [x] LDAP sync (mock/bridge)
- [x] Write telemetry on create/patch/start/close
- [ ] Staging: failover drill signed
- [ ] `npm run check:pii-log` on CI

## Sprint 52

- [x] LDAP group map + deprovision
- [x] `MULTI_REGION_DRILL_CHECKLIST.md`
- [x] RES-DO-02 energizer KV mirror
- [x] `GET /api/ldap/onboard`
- [ ] Background LDAP sync cron (ops)

## Sprint 53

- [x] Webhook rate limit + AE events
- [x] `PUBLIC_API_PATH_PREFIXES` + auth exempt for public routes
- [x] Workday/BambooHR templates
- [ ] Webhook admin UI (stretch)

## Sprint 54

- [x] Partner apps + secret rotation
- [x] Webhook test runner
- [x] API v2 POST sessions + results
- [x] Partner integration status API
- [ ] Full OAuth2 authorize flow (stretch)

## Sprint 55

- [x] LIVE bracket/battle royale progression
- [x] CoachingCard + i18n
- [x] `tournament.*` AE events
- [x] Unit tests `tournament-live`, `session-room-cross-region`
- [ ] 40+ integration tournament tests (stretch)

## Sprint 56

- [x] Coaching profile + RAG in prompts
- [x] Agent grounding AE
- [x] Tournament markdown export
- [ ] PDF winner cert (stretch)

## Sprint 57

- [x] Coaching actions + email export
- [x] Compliance admin prep routes
- [x] Coaching i18n (5 locales)
- [ ] Pentest vendor SOW (ops)

## Sprint 58

- [x] Marketplace + SLA public pages
- [x] Partner branding API
- [x] SOC2 evidence KB folder
- [ ] SOC2 audit execution (ops)

## Sprint 59

- [x] `/trust/soc2`
- [x] Partner secret rotation
- [ ] SOC2 report signed (ops)

## Sprint 60

- [x] Similar sessions panel
- [x] `COMPETITIVE_MOAT_V35.md`
- [x] `v3.5.0.md` release notes
- [ ] Sales moat sign-off (GTM)

## Merge gate

- [ ] PR `feat/sprint-60-v35-moat` → `main` CI green
- [ ] Staging rituals pass
- [ ] Release notes v3.1–v3.5 published
