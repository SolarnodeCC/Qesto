# Refactoring Opportunities Audit — 2026-07-08

> **Remediatie-status (2026-07-09):** alle 🟠 High- en 🟡 Medium-findings hieronder zijn
> gefixt op deze branch (zie de commits die dit document vergezellen). Uitzonderingen,
> bewust: `useInsights`/`useMarketingApi` blijven hand-rolled (fan-out/mutatie-clients,
> geen one-shot queries) en de attempt-teller van de WS-reconnect reset bewust niet bij
> een geslaagde verbinding (gedrag van alle vier de originele hooks behouden).
> Ratchets na deze pass: AI-gateway 3 (scan nu incl. `worker/` + `workers/`), D1 313,
> error-envelopes 325.
>
> **Vervolg-pass (PR na #713):** de 🔴 Critical is gefixt — `check-kv-access` draait nu in
> `quality-gates.sh` en de 15 violations zijn door `lib/kv.ts` geleid (baseline 0, groen).
> De 🟢 Low naming-items zijn ook gefixt: `copilot-multiturn.ts` (typo-rename),
> `advance-detail-leaderboard.ts` → `advance.ts`/`detail.ts`/`leaderboard.ts`, en
> `session-room-vote-flow.ts` → `session-room-vote-admission.ts` +
> `session-room-presenter-actions.ts`. Daarmee zijn **alle findings uit deze audit
> afgehandeld.**

**Scope:** `functions/` (Hono API + Durable Objects), `worker/` + `workers/` (cron/queues), `src/` (React/Vite frontend), `scripts/` (quality gates).
**Uitgesloten:** `node_modules`, gegenereerde bestanden, reeds gedraaide migrations, vendored code.
**Methode:** systematische scan per categorie; elke finding is bevestigd met ≥ 2 concrete code-referenties. Style-nitpicks zijn weggelaten.

**Relatie tot eerdere audit (2026-06-28):** de vorige audit + [`REMEDIATION_PLAN.md`](./REMEDIATION_PLAN.md) introduceerden drie CI-ratchets (ADR-0068/0069/0070) die vandaag groen staan op baseline (AI-gateway 3, D1 322, error-envelopes 330). Deze audit meet de **actuele** staat: één gate blijkt geregresseerd én niet aangesloten, en er zijn nieuwe findings die buiten de vorige scope vielen (DO-handler-duplicatie, public-API-drift, frontend WS-hooks, dead code).

---

### 🔴 [Critical] KV-access-gate staat rood (15 violations boven baseline 0) en is niet aangesloten op de CI-gate-runner
**Categorie:** 3. Inconsistente patterns / 9. Cloudflare-specifieke patterns
**Locatie:** `scripts/check-kv-access.mjs` (baseline 0, huidig 15), `ops/ci/quality-gates.sh:36-38`, violations in o.a. `functions/api/routes/billing.ts:71,74,545,578,618,678`, `functions/api/routes/admin/kb-sync.ts:262,387,389,438`, `functions/api/lib/copilot-live-context.ts:58,79,81`, `functions/api/lib/session-room-persistence.ts:113`, `functions/api/routes/team-insights.ts:260`
**Wat:** De KV-abstractie (`lib/kv.ts`, baseline bevroren op 0 — het bewijsstuk van het remediatieplan dat "een afgedwongen abstractie schoon blijft") is geregresseerd: `node scripts/check-kv-access.mjs` exit 1 met 15 directe `env.*_KV.*`-calls. Oorzaak: `ops/ci/quality-gates.sh` draait wél `check-ai-gateway`, `check-d1-access` en `check-error-response`, maar **niet** `check-kv-access` — nieuwe code (o.a. de recente kb-sync-manifest-change, commit `c96671f`) kon er dus ongehinderd langs.
**Bewijs:** `quality-gates.sh` regels 36-38 bevatten exact drie `node scripts/check-*.mjs`-regels, `check-kv-access` ontbreekt; de gate zelf rapporteert "❌ Direct KV access increased: 15 (baseline 0)" en exit 1. `kb-sync.ts:262` schrijft `c.env.ACTIONS_KV.put('kb_sync_metadata', JSON.stringify({...}))` rauw; `billing.ts:545,578` schrijven rauw naar `USERS_KV` in het Stripe-webhook-pad.
**Impact:** Het hele ratchet-mechanisme is alleen geloofwaardig als elke gate ook draait. Deze regressie bewijst het omgekeerde scenario uit het remediatieplan: zonder gate drift het patroon binnen één release train. Bovendien omzeilen deze 15 sites de TTL-/serialisatie-conventies van `lib/kv.ts`.
**Voorstel:** (1) `node scripts/check-kv-access.mjs` toevoegen aan `quality-gates.sh` en `check:rc`; (2) de 15 sites door `lib/kv.ts` routeren (mechanisch, geen gedragswijziging) óf — waar bewust rauw (DO-persistence-pad) — expliciet allowlisten in de gate met motivatie, zodat de baseline weer 0 is.
**Effort:** S

---

### 🟠 [High] Boilerplate (serverMsg / errorMessage / StorageContext / Attachment) is in 8 DO-handlerbestanden gekopieerd terwijl de canonieke modules bestaan
**Categorie:** 1. Duplicatie
**Locatie:** `functions/api/lib/session-room-{townhall,ideate,retro,deliberate,energizer,captions,reactions,xr}-handler.ts` versus `functions/api/lib/session-room-messages.ts:3-13` en `session-room-types.ts:49`
**Wat:** Elke SessionRoom-handlercollaborator herdefinieert lokaal dezelfde vier bouwstenen: `serverMsg()` (8×), `errorMessage()` (6×), `interface StorageContext` (8×) en `type Attachment` (5×) — terwijl `session-room-messages.ts` al `serverMessage()`/`errorMessage()` exporteert (gebruikt door 5 andere session-room-modules) en `session-room-types.ts` al een `Attachment` exporteert.
**Bewijs:** Identieke definities op o.a. `session-room-townhall-handler.ts:36-57`, `session-room-ideate-handler.ts:28-45`, `session-room-retro-handler.ts:18-33`, `session-room-energizer-handler.ts:38-60`, `session-room-xr-handler.ts:44-53`. `session-room-vote-flow.ts:18` importeert dezelfde helpers wél correct uit `session-room-messages.ts`. De `Attachment`-kopieën verschillen bovendien al (townhall/energizer dragen `ipHash`/`permissions`, ideate/retro/deliberate niet) — beginnende drift op het WS-attachment-contract.
**Impact:** Protocolwijzigingen (bv. envelope-versiebump: `LIVE_PROTOCOL_VERSION` zit in elke lokale `serverMsg`) moeten op 8 plekken tegelijk; een gemiste plek betekent inconsistente WS-frames richting clients. De uiteenlopende `StorageContext`-interfaces (mét/zonder `tag`-parameter op `getWebSockets`) maken één gedeelde test-double onmogelijk.
**Voorstel:** Eén `session-room-handler-shared.ts` (of uitbreiden van `session-room-messages.ts` + `session-room-types.ts`): canonieke `serverMsg`/`errorMessage`, één `StorageContext`-interface (superset), en de bestaande `Attachment` uit `session-room-types.ts` gebruiken. Mechanische migratie per handler; geen gedragswijziging, dus geen REV-10-trigger.
**Effort:** S

---

### 🟠 [High] Token-bucket-rate-limiting bestaat byte-identiek dubbel; de "shared" module dekt townhall niet, ondanks eigen claim
**Categorie:** 1. Duplicatie / 6. Naming & leesbaarheid
**Locatie:** `functions/api/lib/board-submit-rate.ts:8-20` versus `functions/api/lib/session-room-townhall.ts:34-47`
**Wat:** `board-submit-rate.ts` opent met "Shared submit rate limiting for retro/ideate/townhall boards", en retro/ideate/deliberate importeren hem inderdaad — maar de townhall-handler importeert `newSubmitBucket`/`consumeSubmitToken` uit `session-room-townhall.ts`, dat een byte-voor-byte identieke implementatie bevat (zelfde capaciteit 3, zelfde refill 1/20 per sec, zelfde algoritme; alleen de constantnamen verschillen: `TOWNHALL_*` vs `BOARD_*`).
**Bewijs:** `session-room-townhall-handler.ts:13-24` importeert uit `./session-room-townhall`; `session-room-ideate-handler.ts:12`, `session-room-retro-handler.ts:6` en `session-room-deliberate-handler.ts:22` importeren uit `./board-submit-rate`. Beide `consumeSubmitToken`-bodies zijn regel-voor-regel gelijk.
**Impact:** Een tuning van de submit-rate (bv. capaciteit omhoog voor grote events) wordt onvermijdelijk op één van de twee plekken vergeten — townhall gedraagt zich dan stilletjes anders dan retro/ideate. De misleidende module-comment verergert dit: een lezer denkt dat aanpassen van `board-submit-rate.ts` townhall dekt.
**Voorstel:** Townhall migreren naar `board-submit-rate.ts` en de kopie (incl. `TOWNHALL_SUBMIT_BUCKET_*`-constanten en het dubbele `TokenBucket`-type) uit `session-room-townhall.ts` verwijderen. De bestaande unit tests op de bucket blijven op één implementatie wijzen.
**Effort:** S

---

### 🟠 [High] Public API `/sessions/:id/results` is 3× verbatim gedupliceerd over v1/v2/v3 — en de drift is al begonnen
**Categorie:** 1. Duplicatie / 3. Inconsistente patterns
**Locatie:** `functions/api/routes/public-api-v1.ts:28-49`, `public-api-v2.ts:47-72`, `public-api-v3.ts:78-103`
**Wat:** De results-handler (sessie ophalen → questions-query → votes-aggregatie-query → envelope) is drie keer gekopieerd. De kopieën zijn al uit elkaar gegroeid: v2 noemt het response-veld `votes` waar v1/v3 `vote_counts` gebruiken; v2 inlinet zijn eigen sessie-fetch (`SELECT id, team_id, title, status ...`) in plaats van het gedeelde `fetchSessionForTeam`; en alleen v3 doet een `apiKeyHasScope`-check.
**Bewijs:** De `questions`- en `votes`-SQL is regel-identiek in alle drie de bestanden (`SELECT question_id, option_id, COUNT(*) as count FROM votes WHERE session_id = ?1 GROUP BY question_id, option_id`); `public-api-v2.ts:70` retourneert `votes:` waar `public-api-v1.ts:47` en `public-api-v3.ts:100` `vote_counts:` retourneren.
**Impact:** Dit is een publiek, versioned API-contract: elke bugfix in de aggregatie (bv. het meenemen van open-response-antwoorden) moet 3× worden aangebracht en 3× worden getest. Het `votes`/`vote_counts`-verschil is vermoedelijk al een onbedoelde contract-inconsistentie die externe integrators raakt.
**Voorstel:** Kern-handlers extraheren naar bv. `lib/public-api-core.ts` (`getSessionResults(db, sessionId, teamId)`) die het datablok teruggeeft; de v1/v2/v3-routes worden dunne wrappers die alleen versie-specifiek gedrag (scope-check, veldnaam-aliassen als bewust contract) toevoegen. Idem voor de gedupliceerde `GET /sessions`-lijst (v1:23, v3:45).
**Effort:** M

---

### 🟠 [High] `isTeamMember` is 6× letterlijk hand-rolled in routes; de centrale `authorizeTeamPermission` heeft maar 2 adopters
**Categorie:** 3. Inconsistente patterns (auth) / 1. Duplicatie
**Locatie:** identieke lokale functie in `functions/api/routes/{sovereign.ts:31,federation.ts:60,team-insights.ts:45,studio.ts:72,studio-library.ts:50,pulse.ts:24}`; variant-checks in `webhook-admin.ts:33`, `webhooks.ts:94`, `sessions/crud.ts:124`, `teams/shared.ts:115-123`; centrale helper: `functions/api/lib/authz-helpers.ts:24`
**Wat:** Zes route-bestanden definiëren regel-identiek `function isTeamMember(team, userId) { return team.ownerId === userId || team.members.some((m) => m.userId === userId) }`, terwijl `authz-helpers.ts` juist is gebouwd (per remediatieplan: "dual-auth consolidation") om team-autorisatie op één plek te doen — maar door slechts 2 bestanden wordt geïmporteerd. Daarnaast bestaan er subtiel afwijkende inline varianten (bv. `webhook-admin.ts:33` met rol-check).
**Bewijs:** `grep` op de exacte expressie levert 6 identieke functiedefinities + ≥ 4 inline varianten; `grep -rl authorizeTeamPermission functions/api/routes` levert 2 bestanden.
**Impact:** Autorisatielogica die per module opnieuw wordt uitgevonden is het klassieke recept voor de volgende IDOR (vgl. de al gefixte #537 in de energizer-routes): wie een nieuwe membership-regel toevoegt (bv. `viewer` uitsluiten van schrijfacties) moet 10+ plekken vinden. De 404/403-semantiek van ADR-0070 wordt nu ook per plek anders toegepast.
**Voorstel:** De 6 identieke helpers vervangen door `authorizeTeamPermission` (of een lichte `requireTeamMember(c, teamId)`-wrapper eromheen voor het simpele lidmaatschapsgeval). De rol-varianten (`webhook-admin.ts`) krijgen een `minRole`-parameter in de helper i.p.v. eigen expressies. Aansluitend: een grep-ratchet op `team.members.some(` in `routes/` analoog aan de bestaande gates.
**Effort:** M

---

### 🟠 [High] Vier frontend WS-hooks dupliceren elk de volledige connect/reconnect/parse-lifecycle (~150 regels per stuk)
**Categorie:** 10. Frontend-specifiek / 1. Duplicatie
**Locatie:** `src/hooks/useLiveSession.ts:292,439-446`, `useIdeateSession.ts:187,287-292`, `useTownhallSession.ts:218,277-282`, `useRetroSession.ts:154,211-216`; gedeeld is alleen `src/hooks/liveSessionWsTransport.ts` (18 regels: URL-bouw + send)
**Wat:** Elk van de vier hooks bouwt zelf de `WebSocket` op, registreert open/message/close-handlers, en implementeert identieke reconnect-logica (`attempt > 5` → failed; backoff `Math.min(16000, 1000 * Math.pow(2, attempt - 1))`), plus per hook een eigen hand-rolled veld-coercion-laag (`toItem`/`toIdea`/`toCluster` met `typeof r.rank === 'number' ? r.rank : 0`-kettingen — in `useIdeateSession` staat de ranking-mapper zelfs 2× binnen hetzelfde bestand, regels 206 en 242).
**Bewijs:** De vier `Math.min(16000, 1000 * Math.pow(2, attempt - 1))`-regels zijn identiek (zie locaties); `useTownhallSession.ts:177`, `useRetroSession.ts:128` en `useIdeateSession.ts:151` bevatten structureel gelijke `toX(raw: Record<string, unknown>)`-coercers.
**Impact:** Een fix in de reconnect-semantiek (bv. jitter toevoegen, of het `retryTimerRef`-lek dat alléén townhall opruimt bij unmount — ideate/retro zetten hun `setTimeout` zonder ref) moet 4× worden aangebracht. De coercion-laag dupliceert bovendien de servercontracten die backend-zijde al als Zod-schema's bestaan (`protocol-schemas.ts`) — dubbele waarheid over het WS-protocol.
**Voorstel:** Conform het al gedocumenteerde deferred issue 6: `liveSessionWsTransport.ts` uitbouwen tot een `createReconnectingWs(url, subprotocols, { onMessage, onStatus })`-primitive die lifecycle + backoff + timer-cleanup één keer implementeert; de vier hooks houden alleen hun reducer en message-switch. De coercers vervangen door gedeelde parsers per messagetype (evt. gegenereerd/gedeeld vanuit `protocol-schemas`).
**Effort:** L

---

### 🟡 [Medium] De god-file-kern blijft staan: `sessions/wizard.ts` (950 regels, 11 handlers) en `routes/billing.ts` (680 regels) combineren validatie, business-logica en D1
**Categorie:** 2. God objects / 7. Testability blockers
**Locatie:** `functions/api/routes/sessions/wizard.ts:39-950` (handlers op regels 48, 162, 323, 383, 474, 527, 548, 644, 756, 895 — o.a. `POST /:id/ai/generate` is ~160 regels, `POST /:id/ai/refine` ~140 regels), `functions/api/routes/billing.ts` (17 inline envelopes gemigreerd, maar Stripe-eventafhandeling nog inline)
**Wat:** De ratchets staan op baseline (D1 322, envelopes 330), maar de grootste massa zit geconcentreerd: `wizard.ts` telt 37 inline envelopes en meerdere handlers die prompt-bouw, AI-call, schemavalidatie, D1-writes en response-shaping in één closure doen. Het referentiepatroon (ADR-0069: `sessionLifecycleRepository`/`Service`) bestaat, maar is na de lifecycle-slice niet verder uitgerold.
**Bewijs:** `grep -c "ok: false" wizard.ts` → 37 (grootste enkele bron in de error-baseline); handler `app.post('/:id/ai/generate')` beslaat regels 162-322 (160 regels in één functie). Vergelijk: het gemigreerde `sessions/lifecycle.ts` heeft zijn D1 in `repositories/sessionLifecycleRepository.ts`.
**Impact:** Deze handlers zijn alleen integraal te testen met een volledige `Env`-mock (D1 + AI + KV); de AI-wizard is nota bene REV-10-plichtig maar zijn prompt/parse-logica is niet los te unit-testen van de route. Elke wijziging aan het wizard-contract raakt een 950-regel-bestand.
**Voorstel:** Volgens het bestaande deferred issue 3: per domein een service extraheren (`wizardGenerationService`: prompt-bouw + `runAI` + schema-parse als pure, injecteerbare functie; D1 naar een `wizardRepository`). Dit draineert tegelijk de error- en D1-baselines. Startpunt: de twee AI-handlers (grootste testability-winst, want REV-10-oppervlak).
**Effort:** L

---

### 🟡 [Medium] Stripe-webhook-events zijn `any` door de hele money-path-dispatch
**Categorie:** 8. Type safety gaps
**Locatie:** `functions/api/routes/billing.ts:490,529,565,605,626,645` (zes handler-functies met `event: any`) en `billing.ts:152` (`Variables: any` op de webhook-mount)
**Wat:** Alle zes Stripe-event-handlers (checkout completed, subscription updated/deleted, invoice paid/failed, …) nemen het event als `any` aan; veldtoegang op het betaalpad (`event.data.object.customer` e.d.) is dus volledig ongetypeerd.
**Bewijs:** Zes `event: any`-parameters op de genoemde regels; er bestaat geen lokaal `StripeEvent`-type, terwijl `lib/stripe-client.ts` al als abstractie is geëxtraheerd en de natuurlijke plek voor die types is.
**Impact:** Een typo in een event-veldnaam (of een Stripe-API-versiewijziging) faalt pas op runtime in productie-webhooks — het duurste soort bug (stille plan-desync). De `Variables: any` op de mount schakelt bovendien de context-typing (trace_id, user) voor het hele webhook-subrouter uit.
**Voorstel:** Minimale discriminated union definiëren in `lib/stripe-client.ts` voor precies de zes afgehandelde event-types (`type: 'checkout.session.completed', data: { object: {...} }`, …) — geen externe Stripe-SDK-dependency nodig, alleen de velden die de handlers echt lezen. `Variables: any` vervangen door het bestaande `AuthVariables`-type.
**Effort:** S

---

### 🟡 [Medium] `worker/` en `workers/` vallen buiten álle quality gates — rauwe `AI.run` zonder facade in de cron-workers
**Categorie:** 9. Cloudflare-specifieke patterns / 3. Inconsistente patterns
**Locatie:** `scripts/check-ai-gateway.mjs:17` (`SCAN_DIR = functions`), `worker/index.ts:60`, `workers/linkedin-scheduler/index.ts:130`
**Wat:** De gates scannen uitsluitend `functions/`. De cron-worker (`worker/index.ts:60`, KB-health-sentinel-embedding) en de LinkedIn-scheduler (`workers/linkedin-scheduler/index.ts:130`, volledige llama-3.1-8b-generatie) roepen `env.AI.run` rauw aan — zonder de retry/timeout/sanitatie van `runAI()` (ADR-0068) en onzichtbaar voor de ratchet.
**Bewijs:** `SCAN_DIR = resolve(ROOT, 'functions')` in zowel `check-ai-gateway.mjs` als `check-kv-access.mjs`; de twee genoemde `env.AI.run`-call-sites staan buiten die boom.
**Impact:** Precies de call-sites die 's nachts onbemand draaien (cron) missen de resilience-laag; een hangende AI-call in de scheduler heeft geen timeout. En het gerapporteerde "baseline 3, geen regressie" geeft een vals-compleet beeld van de AI-call-inventaris.
**Voorstel:** `SCAN_DIR` uitbreiden naar `['functions', 'worker', 'workers']` (baseline eenmalig ophogen met de gevonden sites) en de twee workers naar `runAI()` migreren — de facade neemt al een kale `env` aan, dus dit is een import-wissel. REV-10: modellen/prompts wijzigen niet, alleen de transportlaag; eval-run als bewijs meeleveren.
**Effort:** S

---

### 🟡 [Medium] `functions/api/types.ts` is een 468-regel hub die door 222 bestanden wordt geïmporteerd
**Categorie:** 4. Coupling issues
**Locatie:** `functions/api/types.ts` (regels 4-221 `Env`; 223-295 sessie-domein; 297-350 embed; 352-461 user/plan/quota incl. `PLAN_QUOTAS`-dataconstante; 463-468 API-envelope)
**Wat:** Eén module bundelt de `Env`-bindingsdefinitie, het sessie-domeinmodel, embed-widget-contracten, plan/quota-configuratie (inclusief runtime-data `PLAN_QUOTAS`) en de API-envelope-types. 222 bestanden in `functions/api` importeren hem.
**Bewijs:** `grep -c "^export"` toont de vijf ongerelateerde clusters; `grep -rl "from '../types'" functions/api | wc -l` → 222.
**Impact:** Elke domein-wijziging (bv. een nieuw `SessionMode`) raakt hetzelfde bestand als een nieuwe binding in `Env` → merge-conflict-magneet; het bestand mengt bovendien types met runtime-constanten (`PLAN_QUOTAS`), waardoor "types-only" imports stilletjes code meetrekken.
**Voorstel:** Het al gedocumenteerde deferred issue 5 uitvoeren: splitsen naar `types/{env,session,billing,embed,api}.ts` met een barrel-re-export op de oude locatie (geen import-churn); `PLAN_QUOTAS` naar `lib/entitlements.ts` of `config/plan-quotas.ts` verplaatsen zodat het typebestand puur declaratief wordt.
**Effort:** M

---

### 🟡 [Medium] Zeven data-hooks hand-rollen loading/error-state terwijl `useApiQuery` bestaat
**Categorie:** 10. Frontend-specifiek / 3. Inconsistente patterns
**Locatie:** `src/hooks/{useInsights.ts,useMarketingApi.ts,useQuotaUsage.ts,useTeamInsights.ts,useWorkspaceTrends.ts,useWorkspaces.ts,useAdminAnalyticsAdvanced.ts}` versus `src/hooks/useApiQuery.ts`
**Wat:** `useApiQuery` (gedeelde fetch/loading/error/refetch-abstractie, in het remediatiepad juist ingevoerd voor de admin-hooks) heeft maar 4 gebruikers; zeven andere hooks bouwen hun eigen `loading`/`error`-`useState`-machinerie met per hook nét andere semantiek (wel/geen refetch, wel/geen abort).
**Bewijs:** `grep -l "setLoading(true)" src/hooks/*.ts` → de 7 genoemde bestanden; `grep -rl useApiQuery src/` → 4 bestanden. `useMarketingApi.ts` (356 regels) is de grootste hand-rolled variant.
**Impact:** Inconsistente UX (sommige hooks tonen stale data tijdens refetch, andere flippen naar spinner), en elke cross-cutting verbetering (bv. 401-afhandeling of aborten bij unmount) moet 7× worden aangebracht. De twee al bestaande halve abstracties (`useApiQuery`, `usePolledApi`) verliezen hun waarde zolang adoptie optioneel blijft.
**Voorstel:** Migratie per hook naar `useApiQuery` (en `useParallelApiQuery` toevoegen voor het `Promise.all`-geval van `useAdminAnalyticsAdvanced` — bestaand deferred issue 8). Mechanisch; per hook een kleine Vitest-snapshot van de state-overgangen.
**Effort:** M

---

### 🟡 [Medium] Dead code: vijf lib-modules zonder één import
**Categorie:** 5. Dead code & unused exports
**Locatie:** `functions/api/lib/api-abuse.ts` (39 regels), `d1-write-context.ts` (21), `perf-optimize.ts` (160), `workflow-templates.ts` (32), `seed-help.ts` (142)
**Wat:** Repo-brede import-analyse (functions/src/worker/workers/tests/scripts) vindt nul importeurs voor de eerste vier; `seed-help.ts` wordt uitsluitend genoemd in een docstring-comment van `scripts/sync-help-docs.ts:7` ("this script and the in-worker seeder"), maar door niets aangeroepen.
**Bewijs:** `grep -r "<module>"` over alle source-trees levert per module geen import-statements op; alleen de comment-referentie voor seed-help.
**Impact:** 394 regels die onderhouden lijken te moeten worden (perf-optimize suggereert een actieve optimalisatielaag die er niet is); onboarding-ruis; en dode security-gerelateerde code (`api-abuse.ts`) wekt de indruk dat er abuse-detectie draait die er in werkelijkheid niet is.
**Voorstel:** Verwijderen na een laatste check op dynamische verwijzingen; als `seed-help.ts` bewust als "nog te activeren" wordt bewaard, verplaats hem naar `scripts/` naast zijn tweeling of documenteer de activatieroute. Overweeg `knip`/`ts-prune` als periodieke check in `check:rc`.
**Effort:** S

---

### 🟢 [Low] Naming: `copilot-multturn.ts` (typo), `session-room-vote.ts` vs `session-room-vote-flow.ts`, en grab-bag `advance-detail-leaderboard.ts`
**Categorie:** 6. Naming & leesbaarheid
**Locatie:** `functions/api/lib/copilot-multturn.ts` (+ `tests/unit/copilot-multturn.test.ts`), `functions/api/lib/session-room-vote.ts` vs `session-room-vote-flow.ts`, `functions/api/routes/energizers/advance-detail-leaderboard.ts`
**Wat:** (a) "multturn" is een typo voor "multiturn" die inmiddels in drie bestanden (module, test, import in `routes/copilot-context.ts:22`) is gepropageerd. (b) Het paar `session-room-vote.ts` ("vote accumulation rules") en `session-room-vote-flow.ts` ("vote admission/mutation flow, presenter navigation, copilot injection, sentiment") maakt uit de namen niet op te maken waar wat hoort — `-flow` bevat drie niet-vote-verantwoordelijkheden. (c) `advance-detail-leaderboard.ts` is een opsomming van drie ongerelateerde endpoints als bestandsnaam — een teken dat het bestand op regelaantal (318) is gesplitst i.p.v. op verantwoordelijkheid.
**Bewijs:** Zie de drie locaties; header-comment van `session-room-vote-flow.ts:2-5` somt zelf de vier verantwoordelijkheden op ("Extracted … to keep files under 500 LOC").
**Impact:** Zoek-/grep-kosten (wie "multiturn" zoekt vindt niets) en verkeerde eerste indruk van modulegrenzen; geen directe bugbron.
**Voorstel:** (a) rename naar `copilot-multiturn.ts` (drie bestanden). (b) `-flow` splitsen langs zijn eigen comment: presenter-navigatie en copilot-injectie naar eigen modules, rest hernoemen naar `session-room-vote-admission.ts`. (c) bij de eerstvolgende energizer-wijziging splitsen naar `advance.ts` / `detail.ts` / `leaderboard.ts` onder `routes/energizers/`.
**Effort:** S

---

## Slotsectie

### Top 3 quick wins (impact/effort)
1. **KV-gate aansluiten + 15 violations wegwerken** (🔴, S) — herstelt de integriteit van het hele ratchet-systeem en is grotendeels mechanisch.
2. **DO-handler-boilerplate dedupliceren** (🟠, S) — één import-wissel per handler elimineert 8 kopieën van het WS-envelope-contract; directe bescherming van de protocol-versionering.
3. **Token-bucket-duplicaat verwijderen + townhall op `board-submit-rate.ts`** (🟠, S) — één bestand minder dat stilletjes kan driften, en de module-comment klopt weer.

### Top 1 structurele investering
**De frontend WS-transport-primitive (`createReconnectingWs`) + gedeelde message-parsers.** Dit is de enige finding waar duplicatie, type-onveiligheid (hand-rolled coercers naast bestaande Zod-schema's) en een reëel bug-oppervlak (timer-lek bij unmount, 4× reconnect-semantiek) samenkomen, en elk nieuw sessietype (het vijfde, deliberate, heeft al een eigen hook) maakt het erger. De backend heeft dit patroon al voorgedaan met de handler-extracties; de frontend mist zijn equivalent.

### Onderliggend patroon
De meeste findings delen één gewoonte: **abstracties worden gebouwd als eindpunt van een refactor, niet als afgedwongen startpunt van nieuw werk.** `session-room-messages.ts`, `board-submit-rate.ts`, `authz-helpers.ts`, `useApiQuery` en `lib/kv.ts` bestaan allemaal — maar hun adoptie is per module vrijwillig, dus nieuwe code (townhall-handler, kb-sync, de vierde WS-hook, zes `isTeamMember`-kopieën) kopieert het oude patroon in plaats van de abstractie te importeren. Waar wél een gate draait (AI-gateway, D1, error-envelopes) blijft de lijn vlak of daalt; waar de gate ontbreekt of niet is aangesloten (KV, worker-trees, frontend) groeit de debt terug. De remedie is consequent dezelfde: elke gedeelde abstractie krijgt óf een ratchet, óf hij zal genegeerd worden.
